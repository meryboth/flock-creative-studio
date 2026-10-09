import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { dailyActivity, generationStats, latestEvals, llmStats, recentActivity, usageByKind } from "@/lib/metrics";

const KIND_LABEL: Record<string, string> = {
  "event.created": "Evento creado",
  "generation.started": "Generación iniciada",
  "generation.finished": "Piezas generadas",
  "generation.failed": "Generación fallida",
  "variant.requested": "Otra variante",
  "copy.rewritten": "Textos reescritos",
  "change.proposed": "Pedido en el chat",
  "change.applied": "Cambio aplicado",
  "change.discarded": "Cambio descartado",
  "change.undone": "Cambio deshecho",
  "post.scheduled": "Publicación programada",
  "post.published": "Publicación hecha",
  "post.cancelled": "Publicación cancelada",
  "roster.loaded": "Nómina cargada",
  "outputs.changed": "Piezas del evento cambiadas",
  "reference.analyzed": "Referencia leída",
  "graphics.generated": "Gráficos con IA",
  "download.zip": "Descarga .zip",
  "style.created": "Estilo creado",
  "style.deleted": "Estilo borrado",
};
const SUITE_LABEL: Record<string, string> = { copy: "Textos", editor: "Chat de edición", reference: "Lectura de referencias", design: "Diseño y diversidad", verifier: "Verificador de lectura" };
const TASK_LABEL: Record<string, string> = { copy: "textos", editor: "chat", reference: "referencias", critic: "crítico", verifier: "verificador", keyvisual: "key visual", elements: "elementos" };

const secs = (ms: number) => (ms >= 10_000 ? `${Math.round(ms / 1000)} s` : `${(ms / 1000).toFixed(1)} s`);
const usd = (n: number) => `US$ ${n < 1 ? n.toFixed(3) : n.toFixed(2)}`;
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

export default function MetricsPage({ searchParams }: PageProps<"/metricas">) {
  return (
    <main className="px-5 py-12 sm:px-10">
      <Suspense fallback={<p className="font-hand text-2xl text-muted">sumando números…</p>}>
        <Metrics searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Metrics({ searchParams }: { searchParams: PageProps<"/metricas">["searchParams"] }) {
  const params = await searchParams;
  await connection();
  const days = [7, 30, 90].includes(Number(params.dias)) ? Number(params.dias) : 30;
  const [usage, gen, llm, daily, evals, recent] = await Promise.all([
    usageByKind(days),
    generationStats(days),
    llmStats(days),
    dailyActivity(Math.min(days, 30)),
    latestEvals(),
    recentActivity(),
  ]);
  const n = (k: string) => usage[k]?.total ?? 0;
  const proposed = n("change.proposed");
  const applied = n("change.applied");
  const maxDay = Math.max(1, ...daily.map((d) => d.total));
  const llmCalls = llm.reduce((a, x) => a + x.calls, 0);
  const llmOk = llm.reduce((a, x) => a + x.ok, 0);
  const llmFallback = llm.reduce((a, x) => a + x.fallback, 0);
  const llmCost = llm.reduce((a, x) => a + x.cost, 0);
  const savedHours = (gen.manualMinutes - gen.machineSeconds / 60) / 60;

  return (
    <>
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Métricas</h1>
          <p className="mt-3 max-w-2xl text-muted">
            Cómo se usa la app y cómo rinden los agentes: cada acción y cada llamada a un modelo queda registrada en la base local, sin datos personales.
          </p>
        </div>
        <nav aria-label="Período" className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <Link key={d} href={`/metricas?dias=${d}`} aria-current={d === days ? "true" : undefined} className={`border-[1.5px] border-ink px-3 py-1.5 text-xs ${d === days ? "bg-ink text-white" : "bg-surface hover:bg-yellow"}`}>
              {d} días
            </Link>
          ))}
        </nav>
      </header>

      {/* ─── Indicadores ───────────────────────────────────────── */}
      <section aria-label="Indicadores" className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Eventos creados" value={n("event.created")} />
        <Kpi label="Familias generadas" value={gen.total - gen.failed} note={gen.failed ? `${gen.failed} fallaron` : "ninguna falló"} />
        <Kpi label="Tiempo de generación" value={gen.p50 ? secs(gen.p50) : "—"} note={gen.p95 ? `p95 ${secs(gen.p95)} · ${Math.round(gen.pieces)} piezas en promedio` : undefined} />
        <Kpi label="Generaciones con algo para revisar" value={pct(gen.withReview, gen.total - gen.failed)} note={`${gen.verified} piezas leídas por el verificador · ${gen.autoFixed} ajustadas solas`} />
        <Kpi label="Pedidos en el chat" value={proposed} note={`${pct(applied, proposed)} aplicados · ${n("change.undone")} deshechos`} />
        <Kpi label="Publicaciones" value={n("post.scheduled")} note={`programadas · ${n("post.published")} publicadas · ${n("post.cancelled")} canceladas`} />
        <Kpi label="Referencias leídas" value={n("reference.analyzed")} note={`${n("graphics.generated")} con gráficos de IA · ${n("style.created")} estilos guardados`} />
        <Kpi label="Llamadas a modelos" value={llmCalls} note={`${pct(llmOk, llmCalls)} bien · ${llmFallback} resueltas por un modelo de respaldo`} />
        <Kpi
          label="Tiempo ahorrado (estimado)"
          value={gen.manualMinutes ? `${savedHours.toFixed(1)} h` : "—"}
          note={gen.manualMinutes ? `${Math.round(gen.manualMinutes / 60)} h de diseño manual según la línea base, contra ${secs(gen.machineSeconds * 1000)} de máquina` : undefined}
        />
        <Kpi
          label="Costo de IA (estimado)"
          value={usd(llmCost)}
          note={`${gen.total - gen.failed ? `${usd(gen.cost / (gen.total - gen.failed))} por familia generada · ` : ""}precios de referencia, ver docs`}
        />
      </section>

      {/* ─── Actividad ─────────────────────────────────────────── */}
      <section className="mb-12" aria-labelledby="actividad">
        <h2 id="actividad" className="boxed mb-5 text-lg font-semibold">
          actividad por día
        </h2>
        <div className="flex h-36 items-end gap-1 border-b-[1.5px] border-ink" role="img" aria-label={`Acciones por día en los últimos ${daily.length} días`}>
          {daily.map((d) => (
            <div key={d.day} className="group relative flex-1" title={`${d.day}: ${d.total} acciones`}>
              <div className="bg-ink transition group-hover:bg-orange" style={{ height: `${(d.total / maxDay) * 136}px`, minHeight: d.total ? 3 : 0 }} />
            </div>
          ))}
        </div>
        <p className="mt-2 flex justify-between font-mono text-[11px] text-muted">
          <span>{daily[0]?.day}</span>
          <span>{daily.at(-1)?.day}</span>
        </p>
      </section>

      <div className="grid gap-12 xl:grid-cols-2">
        {/* ─── Modelos ─────────────────────────────────────────── */}
        <section aria-labelledby="modelos" className="min-w-0">
          <h2 id="modelos" className="boxed mb-5 text-lg font-semibold">
            modelos
          </h2>
          {llm.length ? (
            <div className="overflow-x-auto border-[1.5px] border-ink bg-surface">
              <table className="w-full text-sm">
                <thead className="label-mono border-b-[1.5px] border-ink bg-background text-left text-muted">
                  <tr>
                    <th className="px-3 py-2">tarea</th>
                    <th className="px-3 py-2">modelo</th>
                    <th className="px-3 py-2 text-right">llamadas</th>
                    <th className="px-3 py-2 text-right">bien</th>
                    <th className="px-3 py-2 text-right">p50</th>
                    <th className="px-3 py-2 text-right">p95</th>
                    <th className="px-3 py-2 text-right">tokens</th>
                    <th className="px-3 py-2 text-right">costo</th>
                  </tr>
                </thead>
                <tbody>
                  {llm.map((x) => (
                    <tr key={`${x.task}-${x.model}`} className="border-t border-border">
                      <td className="px-3 py-2">
                        {TASK_LABEL[x.task] ?? x.task}
                        {x.prompts && <span className="block font-mono text-[10px] text-muted">{x.prompts}</span>}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{x.model}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{x.calls}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${x.ok < x.calls ? "text-orange" : ""}`}>{pct(x.ok, x.calls)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{x.ok ? secs(x.p50) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{x.ok ? secs(x.p95) : "—"}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                        {x.tokensIn || x.tokensOut ? `${(x.tokensIn / 1000).toFixed(1)}k / ${(x.tokensOut / 1000).toFixed(1)}k` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">{x.cost ? usd(x.cost) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted">Todavía no hay llamadas registradas en este período.</p>
          )}
        </section>

        {/* ─── Evals ───────────────────────────────────────────── */}
        <section aria-labelledby="evals" className="min-w-0">
          <h2 id="evals" className="boxed mb-5 text-lg font-semibold">
            evals
          </h2>
          {evals.length ? (
            <ul className="divide-y divide-border border-[1.5px] border-ink bg-surface">
              {evals.map((e) => (
                <li key={e.suite} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-semibold">{SUITE_LABEL[e.suite] ?? e.suite}</p>
                    <p className="text-xs text-muted">
                      {e.passed} de {e.cases} casos · {e.at.toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {e.gitSha && ` · ${e.gitSha.slice(0, 7)}`}
                    </p>
                  </div>
                  <div className="flex items-end gap-3">
                    <span className="flex h-8 items-end gap-0.5" aria-hidden>
                      {e.history.map((h, i) => (
                        <span key={i} className="w-1.5 bg-ink/40 last:bg-ink" style={{ height: `${Math.max(2, h * 32)}px` }} />
                      ))}
                    </span>
                    <span className={`text-2xl font-semibold tabular-nums ${e.score < 0.8 ? "text-orange" : ""}`}>{Math.round(e.score * 100)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">
              Todavía no se corrieron evals. Corré <code className="font-mono text-sm">pnpm evals</code> (ver docs/metricas-y-evals.md).
            </p>
          )}
        </section>
      </div>

      {/* ─── Actividad reciente ────────────────────────────────── */}
      <section className="mt-12" aria-labelledby="reciente">
        <h2 id="reciente" className="boxed mb-5 text-lg font-semibold">
          últimas acciones
        </h2>
        {recent.length ? (
          <ol className="divide-y divide-border border-[1.5px] border-ink bg-surface text-sm">
            {recent.map((r, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2">
                <span className="w-28 shrink-0 font-mono text-xs text-muted">{r.at.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                <span className={r.ok ? "" : "text-orange"}>{KIND_LABEL[r.kind] ?? r.kind}</span>
                {r.eventName && (
                  <Link href={`/eventos/${r.eventId}`} className="text-muted underline underline-offset-4 hover:text-ink">
                    {r.eventName}
                  </Link>
                )}
                {r.durationMs != null && <span className="ml-auto font-mono text-xs text-muted">{secs(r.durationMs)}</span>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted">Todavía no hay acciones registradas.</p>
        )}
      </section>
    </>
  );
}

function Kpi({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return (
    <div className="border-[1.5px] border-ink bg-surface p-4">
      <p className="label-mono text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </div>
  );
}
