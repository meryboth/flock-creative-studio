import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { after } from "next/server";
import { designStyleTemplates } from "@flock/studio";
import { PIECE_SPECS } from "@flock/templates";
import { REPO_ROOT } from "@/lib/paths";
import { getProgress, setProgress } from "@/lib/progress";
import { readReference, referenceImages, templatesDir } from "@/lib/reference";
import { track } from "@/lib/telemetry";

const ROUNDS = Number(process.env.DESIGN_ROUNDS ?? 2);

/**
 * Diseña con IA las plantillas del estilo (posteos, slide y resumen del cronograma) a partir de la referencia.
 * Tarda unos minutos: responde enseguida y el trabajo sigue en segundo plano; la interfaz consulta el progreso.
 */
export async function POST(_req: Request, ctx: RouteContext<"/api/reference/[uploadId]/templates">) {
  const { uploadId } = await ctx.params;
  let reference;
  try {
    reference = await readReference(uploadId);
  } catch {
    return Response.json({ error: "Subida inválida" }, { status: 400 });
  }
  if (!reference) return Response.json({ error: "Primero hay que analizar la referencia" }, { status: 404 });
  const key = `templates:${uploadId}`;
  if (getProgress(key)?.status === "working") return Response.json({ ok: true, already: true });

  const pieces = Object.fromEntries(Object.keys(PIECE_SPECS).map((p) => [p, { status: "queued", round: 0, score: null }]));
  setProgress(key, { status: "working", pieces, startedAt: Date.now(), error: null });
  const references = await referenceImages(uploadId);

  after(async () => {
    const t0 = Date.now();
    const state = pieces as Record<string, { status: string; round: number; score: number | null }>;
    try {
      const result = await designStyleTemplates({
        references,
        reading: reference.style,
        repoRoot: REPO_ROOT,
        rounds: ROUNDS,
        onProgress: (piece, step) => {
          state[piece] =
            typeof step === "string" ? { ...state[piece], status: step } : { status: "working", round: step.round + 1, score: step.score };
          setProgress(key, { pieces: { ...state } });
        },
      });
      const dir = templatesDir(uploadId);
      await rm(dir, { recursive: true, force: true });
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "templates.json"), JSON.stringify(result.templates, null, 2));
      for (const [piece, png] of Object.entries(result.previews)) await writeFile(join(dir, `${piece}.png`), png!);
      const designed = Object.keys(result.templates).length;
      setProgress(key, { status: designed ? "done" : "failed", error: result.errors.join(" | ") || null, finishedAt: Date.now() });
      track("templates.designed", {
        ok: designed > 0,
        durationMs: Date.now() - t0,
        props: {
          pieces: designed,
          errors: result.errors.length,
          scores: Object.fromEntries(Object.entries(result.templates).map(([p, t]) => [p, t?.score ?? null])),
          rounds: ROUNDS,
        },
      });
    } catch (err) {
      setProgress(key, { status: "failed", error: err instanceof Error ? err.message : String(err) });
      track("templates.designed", { ok: false, durationMs: Date.now() - t0, props: { error: String(err).slice(0, 300) } });
    }
  });
  return Response.json({ ok: true }, { status: 202 });
}

// Progreso (la interfaz lo consulta cada 2 segundos)
export async function GET(_req: Request, ctx: RouteContext<"/api/reference/[uploadId]/templates">) {
  const { uploadId } = await ctx.params;
  return Response.json(getProgress(`templates:${uploadId}`), { headers: { "Cache-Control": "no-store" } });
}
