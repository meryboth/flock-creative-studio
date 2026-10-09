import "server-only";
import { db } from "@flock/db";
import { sql } from "drizzle-orm";

/**
 * Consultas del tablero de métricas (página /metricas). Todas sobre las tablas de telemetría
 * (usage_events, llm_calls, runs, run_steps, eval_runs). Documentadas en docs/metricas-y-evals.md.
 */

type Row = Record<string, unknown>;
const rows = async <T extends Row>(q: ReturnType<typeof sql>) => (await db.execute(q)) as unknown as T[];
const num = (v: unknown) => (v == null ? 0 : Number(v));

/** Cantidad de cada acción en el período, con cuántas salieron mal. */
export async function usageByKind(days: number) {
  const r = await rows<{ kind: string; total: string; failed: string }>(sql`
    select kind, count(*) as total, count(*) filter (where not ok) as failed
    from usage_events where at > now() - make_interval(days => ${days})
    group by kind order by kind`);
  return Object.fromEntries(r.map((x) => [x.kind, { total: num(x.total), failed: num(x.failed) }]));
}

/** Generaciones: duración (p50, p95), piezas, y cuántas dejaron algo para revisar. */
export async function generationStats(days: number) {
  const [r] = await rows(sql`
    select count(*) as total,
      count(*) filter (where not ok) as failed,
      percentile_cont(0.5) within group (order by duration_ms) filter (where ok) as p50,
      percentile_cont(0.95) within group (order by duration_ms) filter (where ok) as p95,
      avg((props->>'pieces')::int) filter (where ok) as pieces,
      count(*) filter (where ok and (props->>'review')::int > 0) as with_review,
      sum((props->>'autoFixed')::int) filter (where ok) as auto_fixed,
      sum((props->>'readingProblems')::int) filter (where ok) as reading_problems,
      sum((props->>'verified')::int) filter (where ok) as verified,
      sum((props->>'manualMinutes')::real) filter (where ok) as manual_minutes,
      sum((props->>'machineSeconds')::real) filter (where ok) as machine_seconds,
      sum((props->>'costUsd')::real) filter (where ok) as cost
    from usage_events
    where kind in ('generation.finished', 'generation.failed') and at > now() - make_interval(days => ${days})`);
  return {
    total: num(r.total),
    failed: num(r.failed),
    p50: num(r.p50),
    p95: num(r.p95),
    pieces: num(r.pieces),
    withReview: num(r.with_review),
    autoFixed: num(r.auto_fixed),
    readingProblems: num(r.reading_problems),
    verified: num(r.verified),
    manualMinutes: num(r.manual_minutes),
    machineSeconds: num(r.machine_seconds),
    cost: num(r.cost),
  };
}

/** Modelos: llamadas, éxito, uso de respaldos, latencia y tokens, por tarea y modelo. */
export async function llmStats(days: number) {
  const r = await rows<Row>(sql`
    select task, provider, model,
      count(*) as calls,
      count(*) filter (where ok) as ok,
      count(*) filter (where ok and attempt > 1) as fallback,
      percentile_cont(0.5) within group (order by latency_ms) filter (where ok) as p50,
      percentile_cont(0.95) within group (order by latency_ms) filter (where ok) as p95,
      coalesce(sum(input_tokens), 0) as tokens_in,
      coalesce(sum(output_tokens), 0) as tokens_out,
      coalesce(sum(cost_usd), 0) as cost,
      string_agg(distinct prompt_id || ' v' || prompt_version, ', ') as prompts
    from llm_calls where at > now() - make_interval(days => ${days})
    group by task, provider, model order by task, calls desc`);
  return r.map((x) => ({
    task: String(x.task),
    provider: String(x.provider),
    model: String(x.model),
    calls: num(x.calls),
    ok: num(x.ok),
    fallback: num(x.fallback),
    p50: num(x.p50),
    p95: num(x.p95),
    tokensIn: num(x.tokens_in),
    tokensOut: num(x.tokens_out),
    cost: num(x.cost),
    prompts: x.prompts ? String(x.prompts) : null,
  }));
}

/** Actividad por día (para el gráfico de barras). */
export async function dailyActivity(days: number) {
  const r = await rows<{ day: string; total: string }>(sql`
    select to_char(d, 'YYYY-MM-DD') as day, count(u.id) as total
    from generate_series((now() - make_interval(days => ${days - 1}))::date, now()::date, interval '1 day') d
    left join usage_events u on u.at::date = d::date
    group by d order by d`);
  return r.map((x) => ({ day: x.day, total: num(x.total) }));
}

/** Última corrida de cada suite de evals, con la tendencia de las anteriores. */
export async function latestEvals() {
  const r = await rows<Row>(sql`
    select suite, started_at, duration_ms, git_sha, cases, passed, score,
      (select array_agg(score order by started_at desc) from (select score, started_at from eval_runs e2 where e2.suite = e.suite order by started_at desc limit 6) t) as history
    from eval_runs e
    where started_at = (select max(started_at) from eval_runs e3 where e3.suite = e.suite)
    order by suite`);
  return r.map((x) => ({
    suite: String(x.suite),
    at: new Date(String(x.started_at)),
    durationMs: num(x.duration_ms),
    gitSha: x.git_sha ? String(x.git_sha) : null,
    cases: num(x.cases),
    passed: num(x.passed),
    score: num(x.score),
    history: ((x.history as number[] | null) ?? []).map(num).reverse(),
  }));
}

/** Últimas acciones, con el nombre del evento. */
export async function recentActivity(limit = 20) {
  const r = await rows<Row>(sql`
    select u.at, u.kind, u.ok, u.duration_ms, u.props, e.name as event_name, e.id as event_id
    from usage_events u left join events e on e.id = u.event_id
    order by u.at desc limit ${limit}`);
  return r.map((x) => ({
    at: new Date(String(x.at)),
    kind: String(x.kind),
    ok: Boolean(x.ok),
    durationMs: x.duration_ms == null ? null : num(x.duration_ms),
    props: (x.props as Record<string, unknown> | null) ?? {},
    eventName: x.event_name ? String(x.event_name) : null,
    eventId: x.event_id ? String(x.event_id) : null,
  }));
}
