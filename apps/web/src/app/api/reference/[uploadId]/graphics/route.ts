import { mkdir, rm } from "node:fs/promises";
import { generateKeyVisual, generateStyleElements } from "@flock/agents";
import { buildKit } from "@flock/templates";
import { REPO_ROOT } from "@/lib/paths";
import { clearProgress, getProgress, setProgress } from "@/lib/progress";
import { elementsDir, keyVisualPath, keyVisualUrl, readReference, referenceImages, uploadElements } from "@/lib/reference";

const MOTIF_SUBJECT: Record<string, string> = {
  flower: "flower",
  cloud: "cloud",
  heart: "heart",
  star: "star",
  sparkle: "sparkle",
  squiggle: "squiggle line",
};

/**
 * Genera los gráficos del estilo a partir de la referencia, en paralelo:
 * el key visual (Gemini o ComfyUI) y 3–4 elementos decorativos (Gemini).
 */
export async function POST(_req: Request, ctx: RouteContext<"/api/reference/[uploadId]/graphics">) {
  const { uploadId } = await ctx.params;
  let reference;
  try {
    reference = await readReference(uploadId);
  } catch {
    return Response.json({ error: "Subida inválida" }, { status: 400 });
  }
  if (!reference) return Response.json({ error: "Primero hay que analizar la referencia" }, { status: 404 });

  const key = `graphics:${uploadId}`;
  const references = await referenceImages(uploadId);
  const kit = buildKit({ event: { name: "-", date: "2026-01-01", language: "es" }, styleId: "referencia", reference: reference.style });
  // Lecturas anteriores no traían sujetos: se arman con los motivos
  const subjects =
    reference.elements?.length
      ? reference.elements
      : (reference.style.motifs ?? ["flower", "star", "heart"]).map((m) => `${reference.medium === "pixel-art" ? "pixel art " : ""}${MOTIF_SUBJECT[m] ?? m}`);

  await rm(elementsDir(uploadId), { recursive: true, force: true });
  await mkdir(elementsDir(uploadId), { recursive: true });
  setProgress(key, { keyVisual: { phase: "queued" }, elements: { done: 0, total: Math.min(4, subjects.length) } });

  const [kv, elements] = await Promise.all([
    generateKeyVisual({
      references,
      prompt: reference.keyVisualPrompt,
      ground: kit.style.palette.ground,
      outFile: keyVisualPath(uploadId),
      repoRoot: REPO_ROOT,
      medium: reference.medium,
      onProgress: (p) => setProgress(key, { keyVisual: p }),
    }),
    generateStyleElements({
      references,
      subjects,
      medium: reference.medium,
      outDir: elementsDir(uploadId),
      onDone: (done, total) => setProgress(key, { elements: { done, total } }),
    }),
  ]);
  clearProgress(key);

  if (!kv.ok && !elements.files.length) {
    return Response.json({ error: kv.error, quota: kv.quota ?? false }, { status: kv.quota ? 402 : 502 });
  }
  return Response.json({
    keyVisual: kv.ok ? { url: `${keyVisualUrl(uploadId)}?v=${Date.now()}`, provider: kv.provider, seconds: kv.seconds } : null,
    keyVisualError: kv.ok ? null : kv.error,
    elements: (await uploadElements(uploadId)).map((p) => `/api/storage/${p}?v=${Date.now()}`),
    elementErrors: elements.errors,
  });
}

// Progreso en curso (la interfaz lo consulta cada segundo)
export async function GET(_req: Request, ctx: RouteContext<"/api/reference/[uploadId]/graphics">) {
  const { uploadId } = await ctx.params;
  return Response.json(getProgress(`graphics:${uploadId}`), { headers: { "Cache-Control": "no-store" } });
}
