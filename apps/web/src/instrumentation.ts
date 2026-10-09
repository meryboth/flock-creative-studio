/**
 * Despachador de publicaciones programadas: cada minuto publica en Slack o LinkedIn lo que ya venció.
 * Corre mientras la app está levantada (la app es local; ver docs/informes/12).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as { __flockDispatcher?: ReturnType<typeof setInterval> };
  if (g.__flockDispatcher) return; // una sola vez, aunque el dev server recargue el módulo
  const { dispatchDue } = await import("./lib/schedule");
  const tick = () => dispatchDue().catch((err) => console.warn("[publicaciones]", err instanceof Error ? err.message : err));
  g.__flockDispatcher = setInterval(tick, 60_000);
  setTimeout(tick, 5_000);
}
