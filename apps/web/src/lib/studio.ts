import "server-only";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@flock/db";
import { writeEventCopy } from "@flock/agents";
import { adjustFrom, generateFamily, loadRoster, manualMinutes, outputsOf, type OutputId, type Overrides, type RosterSource } from "@flock/studio";
import { buildKit, type DesignedPieceId, type DesignedTemplate, type AgendaItem, type Attendee, type EventContent, type Language, type ReferenceStyle, type StyleId } from "@flock/templates";
import { REPO_ROOT, STORAGE_DIR } from "./paths";
import { flushTelemetry, setTelemetryContext, track, withTelemetry } from "./telemetry";
import { sql } from "drizzle-orm";

export type StyleChoice = {
  styleId: StyleId;
  seeds: { accent: string; accent2?: string };
  seed: number;
  // Estilo "referencia": lectura de la imagen y, opcional, key visual generado (ruta relativa a storage/)
  reference?: ReferenceStyle;
  referenceUpload?: string;
  libraryStyleId?: string; // si vino de la biblioteca de estilos
  keyVisual?: string;
  elements?: string[]; // elementos decorativos generados (rutas relativas a storage/)
  // Plantillas diseñadas por IA (copia propia del evento): reemplazan a las de código en esas piezas
  templates?: Partial<Record<DesignedPieceId, DesignedTemplate>>;
};

export type NewEventInput = {
  name: string;
  date: string;
  location?: string;
  language: Language;
  hashtag?: string;
  tagline?: string;
  description?: string;
  style: StyleChoice;
  moodboard?: unknown;
  agenda: AgendaItem[];
  attendees: Attendee[];
  outputs: OutputId[];
};

export async function createEvent(input: NewEventInput) {
  return db.transaction(async (tx) => {
    const [event] = await tx
      .insert(schema.events)
      .values({
        name: input.name,
        date: input.date,
        location: input.location || null,
        language: input.language,
        hashtag: input.hashtag || null,
        tagline: input.tagline || null,
        brief: input.description || null,
        style: input.style,
        moodboard: input.moodboard ?? null,
        outputs: input.outputs,
        status: "producing",
      })
      .returning({ id: schema.events.id });
    if (input.agenda.length)
      await tx.insert(schema.agendaItems).values(
        input.agenda.map((a, position) => ({ eventId: event.id, startsAt: a.start, endsAt: a.end, title: a.title, speaker: a.speaker, room: a.room, position })),
      );
    if (input.attendees.length)
      await tx.insert(schema.attendees).values(input.attendees.map((a) => ({ eventId: event.id, ...a })));
    return event.id;
  });
}

export async function getEvent(id: string) {
  const [event] = await db.select().from(schema.events).where(eq(schema.events.id, id));
  if (!event) return null;
  const [run] = await db.select().from(schema.runs).where(eq(schema.runs.eventId, id)).orderBy(desc(schema.runs.createdAt)).limit(1);
  const pieces = await db.select().from(schema.pieces).where(eq(schema.pieces.eventId, id)).orderBy(asc(schema.pieces.createdAt));
  return { event, run: run ?? null, pieces };
}

export async function listEvents() {
  return db.select().from(schema.events).orderBy(desc(schema.events.createdAt));
}

async function loadEventData(id: string) {
  const [event] = await db.select().from(schema.events).where(eq(schema.events.id, id));
  const agenda = await db.select().from(schema.agendaItems).where(eq(schema.agendaItems.eventId, id)).orderBy(asc(schema.agendaItems.position));
  const people = await db.select().from(schema.attendees).where(eq(schema.attendees.eventId, id));
  return {
    event,
    agenda: agenda.map((a): AgendaItem => ({ start: a.startsAt, end: a.endsAt ?? undefined, title: a.title, speaker: a.speaker ?? undefined, room: a.room ?? undefined })),
    attendees: people.map(
      (p): Attendee => ({
        firstName: p.firstName,
        lastName: p.lastName,
        area: p.area ?? undefined,
        role: p.role ?? undefined,
        email: p.email ?? undefined,
        attendance: (p.attendance as Attendee["attendance"]) ?? undefined,
      }),
    ),
  };
}

/**
 * Genera la familia de piezas de un evento. Pensada para correr en segundo plano (after()):
 * va dejando el progreso en `runs` para que la UI lo muestre.
 * @param rewriteCopy si es false, reutiliza los textos ya generados (ej. al cambiar solo la variante)
 */
export function runGeneration(eventId: string, opts: { rewriteCopy?: boolean } = {}) {
  // Todo lo que pase adentro (llamadas a modelos, acciones) queda asociado al evento y a la corrida
  return withTelemetry({ eventId }, () => generate(eventId, opts));
}

async function generate(eventId: string, { rewriteCopy = true }: { rewriteCopy?: boolean }) {
  const t0 = Date.now();
  const [run] = await db
    .insert(schema.runs)
    .values({ eventId, graph: "family", threadId: randomUUID(), status: "running", stage: "Preparando" })
    .returning({ id: schema.runs.id });
  const update = (values: Partial<typeof schema.runs.$inferInsert>) => db.update(schema.runs).set(values).where(eq(schema.runs.id, run.id));
  setTelemetryContext({ runId: run.id });
  track("generation.started", { props: { rewriteCopy } });
  // Pasos de la corrida con su duración (tabla run_steps)
  const step = (node: string, durationMs: number, output?: unknown) =>
    db.insert(schema.runSteps).values({ runId: run.id, node, durationMs: Math.round(durationMs), output: output ?? null }).catch(() => undefined);

  try {
    const { event, agenda, attendees: own } = await loadEventData(eventId);

    // Nómina: si el evento no tiene asistentes propios, se lee de la fuente configurada
    // (hoy, la nómina de ejemplo; a futuro, el Excel de SharePoint) y se guarda como snapshot.
    let attendees = own;
    if (!attendees.length) {
      await update({ stage: "Leyendo la nómina" });
      const roster = await loadRoster({ kind: "mock" }, REPO_ROOT);
      attendees = roster.attendees;
      await db.transaction(async (tx) => {
        if (attendees.length) await tx.insert(schema.attendees).values(attendees.map((a) => ({ eventId, ...a })));
        await tx.update(schema.events).set({ roster: { source: roster.source, fetchedAt: roster.fetchedAt } }).where(eq(schema.events.id, eventId));
      });
    }
    const style = event.style as StyleChoice;
    const kit = buildKit({
      event: {
        name: event.name,
        date: event.date!,
        location: event.location ?? undefined,
        hashtag: event.hashtag ?? undefined,
        tagline: event.tagline ?? undefined,
        description: event.brief ?? undefined,
        language: event.language as Language,
      },
      styleId: style.styleId,
      seeds: style.seeds,
      seed: style.seed,
      reference: style.reference,
      // el key visual es opcional: si el archivo ya no está, se genera sin él
      keyVisual: style.keyVisual && existsSync(join(STORAGE_DIR, style.keyVisual)) ? { file: style.keyVisual, fit: "object" } : undefined,
    });

    let content = event.content as EventContent | null;
    let lastCopyError: string | null = null;
    // Eventos anteriores a Slack y a los momentos (antes / durante / después): se redactan de nuevo
    if (rewriteCopy || !content || !content.slack) {
      await update({ stage: "Redactando los textos con IA" });
      const tCopy = Date.now();
      const copy = await writeEventCopy({ event: kit.event, agenda });
      if (copy.error) console.warn(`[textos] ${copy.source}: ${copy.error}`);
      lastCopyError = copy.error ?? null;
      await step("copy", Date.now() - tCopy, { source: copy.source, model: copy.model ?? null });
      content = copy.content;
      await db.update(schema.events).set({ content, contentSource: copy.source === "llm" ? (copy.model ?? "llm") : "fallback", hashtag: kit.event.hashtag }).where(eq(schema.events.id, eventId));
    }

    await update({ stage: "Generando las piezas" });
    const result = await generateFamily({
      kit,
      content,
      agenda,
      attendees,
      repoRoot: REPO_ROOT,
      outDir: join(STORAGE_DIR, eventId),
      keyVisualPath: style.keyVisual && existsSync(join(STORAGE_DIR, style.keyVisual)) ? join(STORAGE_DIR, style.keyVisual) : undefined,
      elementPaths: (style.elements ?? []).map((e) => join(STORAGE_DIR, e)).filter((p) => existsSync(p)),
      // cambios pedidos en el editor conversacional
      adjust: adjustFrom(kit, event.overrides as Overrides | null),
      outputs: outputsOf(event.outputs),
      designed: style.templates,
      onProgress: async (progress, total, label) => {
        await update({ progress, total, stage: `Generando: ${label}` });
      },
    });

    await db.transaction(async (tx) => {
      const [kitRow] = await tx.insert(schema.eventKits).values({ eventId, kit }).returning({ id: schema.eventKits.id });
      await tx.delete(schema.pieces).where(eq(schema.pieces.eventId, eventId));
      await tx.insert(schema.pieces).values(
        result.pieces.map((p) => {
          // Control de calidad: problemas que quedaron (texto recortado, lectura distinta) y correcciones automáticas
          const check = result.checks[p.file];
          const pending = check ? check.issues.length + (check.reading?.length ?? 0) : 0;
          return {
            eventId,
            eventKitId: kitRow.id,
            type: p.type,
            template: p.template,
            data: { label: p.label },
            file: p.file,
            qaScore: pending ? 0 : 1,
            qaReport: check ?? null,
          };
        }),
      );
      await tx.update(schema.events).set({ status: "done" }).where(eq(schema.events.id, eventId));
    });
    const [{ contentSource }] = await db.select({ contentSource: schema.events.contentSource }).from(schema.events).where(eq(schema.events.id, eventId));
    await update({
      status: "done",
      stage: `Piezas generadas en ${result.seconds.toFixed(0)} s · ${qaSummary(result)} · QA de diseño: ${result.qaReport.split("\n").pop()}`,
      error: contentSource === "fallback" ? lastCopyError : null,
    });
    const checks = Object.values(result.checks);
    await step("render", result.seconds * 1000, { pieces: result.pieces.length, verified: result.verified });
    // Costo de la corrida (suma de sus llamadas a modelos) y tiempo ahorrado contra la línea base manual
    const manual = manualMinutes(result.pieces);
    const machineSeconds = (Date.now() - t0) / 1000;
    await flushTelemetry();
    const [{ cost }] = (await db.execute(sql`select coalesce(sum(cost_usd), 0) as cost from llm_calls where run_id = ${run.id}`)) as unknown as { cost: string }[];
    await update({ costUsd: Number(cost), manualMinutes: manual, machineSeconds });
    track("generation.finished", {
      durationMs: Date.now() - t0,
      props: {
        rewriteCopy,
        pieces: result.pieces.length,
        verified: result.verified,
        review: checks.filter((c) => c.issues.length || c.reading?.length).length,
        autoFixed: checks.filter((c) => c.autoFixed).length,
        readingProblems: checks.reduce((n, c) => n + (c.reading?.length ?? 0), 0),
        contentSource,
        costUsd: Number(cost),
        manualMinutes: manual,
        machineSeconds: Math.round(machineSeconds),
        layout: kit.style.layout,
        styleId: style.styleId,
      },
    });
  } catch (err) {
    track("generation.failed", { ok: false, durationMs: Date.now() - t0, props: { error: err instanceof Error ? err.message.slice(0, 300) : String(err) } });
    console.error("Generación fallida", err);
    await update({ status: "failed", error: err instanceof Error ? err.message : String(err) });
    // Sale de "producing" para que la página muestre el error y permita reintentar
    await db.update(schema.events).set({ status: "done" }).where(eq(schema.events.id, eventId));
  }
}

/** Apunta el estilo del evento a sus copias propias del key visual y de los elementos. */
export async function setEventGraphics(eventId: string, graphics: { keyVisual?: string; elements?: string[] }) {
  const [event] = await db.select({ style: schema.events.style }).from(schema.events).where(eq(schema.events.id, eventId));
  await db.update(schema.events).set({ style: { ...(event.style as StyleChoice), ...graphics } }).where(eq(schema.events.id, eventId));
}

export type RosterInfo = {
  source: string;
  fetchedAt: string;
  url?: string;
  fileName?: string;
  count?: number; // personas confirmadas
  presencial?: number; // credenciales impresas
  error?: string;
};

/**
 * Carga la nómina del evento desde un link de SharePoint / OneDrive o un Excel / CSV subido:
 * reemplaza el snapshot de asistentes. La regeneración de piezas la dispara quien llama.
 */
export async function syncRoster(eventId: string, input: { url: string } | { file: Buffer; fileName: string }) {
  const [event] = await db.select({ roster: schema.events.roster }).from(schema.events).where(eq(schema.events.id, eventId));
  if (!event) throw new Error("Evento inexistente");
  const source: RosterSource =
    "url" in input
      ? { kind: "sharepoint-excel", url: input.url }
      : /\.csv$/i.test(input.fileName)
        ? { kind: "csv", text: input.file.toString("utf8") }
        : { kind: "xlsx", data: input.file, fileName: input.fileName };
  try {
    const roster = await loadRoster(source, REPO_ROOT);
    const presencial = roster.attendees.filter((a) => a.attendance !== "remoto").length;
    await db.transaction(async (tx) => {
      await tx.delete(schema.attendees).where(eq(schema.attendees.eventId, eventId));
      await tx.insert(schema.attendees).values(roster.attendees.map((a) => ({ eventId, ...a })));
      const info: RosterInfo = {
        source: roster.source,
        fetchedAt: roster.fetchedAt,
        ...("url" in input ? { url: input.url } : { fileName: input.fileName }),
        count: roster.attendees.length,
        presencial,
      };
      await tx.update(schema.events).set({ roster: info, status: "producing" }).where(eq(schema.events.id, eventId));
    });
    track("roster.loaded", { eventId, props: { source: roster.source, count: roster.attendees.length, presencial } });
    return { count: roster.attendees.length, presencial };
  } catch (err) {
    track("roster.loaded", { eventId, ok: false, props: { source: source.kind, error: err instanceof Error ? err.message.slice(0, 200) : String(err) } });
    // Se recuerda el link aunque falle, para reintentar sin volver a pegarlo
    const error = err instanceof Error ? err.message : String(err);
    const prev = event.roster as RosterInfo | null;
    await db
      .update(schema.events)
      .set({ roster: { ...prev, ...("url" in input ? { url: input.url } : {}), error } })
      .where(eq(schema.events.id, eventId));
    throw new Error(error);
  }
}

/** Último link de nómina usado en cualquier evento: se sugiere para los próximos. */
export async function lastRosterUrl() {
  const rows = await db.select({ roster: schema.events.roster }).from(schema.events).orderBy(desc(schema.events.createdAt)).limit(50);
  return rows.map((r) => (r.roster as RosterInfo | null)?.url).find(Boolean) ?? null;
}

/** Cambia los grupos de piezas del evento (sumar certificados, sacar la landing…). La regeneración la dispara quien llama. */
export async function setOutputs(eventId: string, outputs: OutputId[]) {
  if (!outputs.length) throw new Error("Elegí al menos un tipo de pieza");
  await db.update(schema.events).set({ outputs, status: "producing" }).where(eq(schema.events.id, eventId));
  track("outputs.changed", { eventId, props: { outputs } });
}

/** Resumen del control de calidad para la línea de estado del evento. */
function qaSummary(result: { checks: Record<string, { issues: unknown[]; autoFixed: number; reading?: unknown[] }>; verified: number }) {
  const checks = Object.values(result.checks);
  const review = checks.filter((c) => c.issues.length || c.reading?.length).length;
  const fixed = checks.filter((c) => c.autoFixed && !c.issues.length).length;
  return [
    review ? `${review} ${review === 1 ? "pieza" : "piezas"} para revisar` : "control de lectura sin problemas",
    fixed ? `${fixed} ajustadas solas` : "",
    result.verified ? `${result.verified} leídas por el verificador` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
