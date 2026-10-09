import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { costOf, setLlmObserver } from "@flock/agents";
import { db, schema } from "@flock/db";

/**
 * Telemetría local: qué se hace en la app (usage_events) y cada llamada a un modelo (llm_calls).
 * Taxonomía de eventos y consultas: docs/metricas-y-evals.md. Nunca guarda datos personales
 * (ni nombres ni correos de la nómina): solo cantidades, ids y parámetros.
 */

type Context = { eventId?: string; runId?: string };

// En globalThis: Next puede cargar este módulo más de una vez y el contexto tiene que ser uno solo
const g = globalThis as { __flockTelemetry?: AsyncLocalStorage<Context> };
const als = (g.__flockTelemetry ??= new AsyncLocalStorage<Context>());

/** Corre `fn` con un contexto (evento, corrida): lo que se registre adentro queda asociado. */
export function withTelemetry<T>(ctx: Context, fn: () => Promise<T>) {
  return als.run({ ...als.getStore(), ...ctx }, fn);
}

/** Suma datos al contexto en curso (ej. el id de la corrida, que se conoce después de empezar). */
export function setTelemetryContext(ctx: Context) {
  const store = als.getStore();
  if (store) Object.assign(store, ctx);
}

// Sin login todavía: el actor es la instalación (se puede nombrar con FLOCK_ACTOR)
const ACTOR = process.env.FLOCK_ACTOR ?? "local";

// Inserciones en curso: se esperan antes de sumar el costo de una corrida
const pending = new Set<Promise<unknown>>();
const keep = (p: Promise<unknown>) => {
  pending.add(p);
  p.finally(() => pending.delete(p));
};
export const flushTelemetry = () => Promise.allSettled([...pending]);

// Cada llamada a un modelo (incluidos los intentos que fallaron y los respaldos) queda en llm_calls
setLlmObserver((r) => {
  const ctx = als.getStore();
  // "images" solo sirve para calcular el costo
  const row = { ...r, images: undefined };
  keep(
    db
      .insert(schema.llmCalls)
      .values({ ...row, costUsd: costOf(r), eventId: ctx?.eventId, runId: ctx?.runId })
      .catch((err) => console.warn("[telemetría] llm_calls:", err.message)),
  );
});

type TrackData = { eventId?: string; runId?: string; ok?: boolean; durationMs?: number; props?: Record<string, unknown> };

/** Registra una acción. No bloquea ni rompe el flujo si la base falla. */
export function track(kind: string, data: TrackData = {}) {
  const ctx = als.getStore();
  db.insert(schema.usageEvents)
    .values({
      kind,
      actor: ACTOR,
      eventId: data.eventId ?? ctx?.eventId,
      runId: data.runId ?? ctx?.runId,
      ok: data.ok ?? true,
      durationMs: data.durationMs != null ? Math.round(data.durationMs) : undefined,
      props: data.props,
    })
    .catch((err) => console.warn("[telemetría] usage_events:", err.message));
}

/** Mide una acción: registra `kind` con su duración y si salió bien o mal (y relanza el error). */
export async function timed<T>(kind: string, data: TrackData, fn: () => Promise<T>, props?: (result: T) => Record<string, unknown>) {
  const t0 = Date.now();
  try {
    const result = await fn();
    track(kind, { ...data, durationMs: Date.now() - t0, props: { ...data.props, ...props?.(result) } });
    return result;
  } catch (err) {
    track(kind, { ...data, ok: false, durationMs: Date.now() - t0, props: { ...data.props, error: err instanceof Error ? err.message.slice(0, 300) : String(err) } });
    throw err;
  }
}
