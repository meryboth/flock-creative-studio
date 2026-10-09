import { mkdir, rm } from "node:fs/promises";
import { generateKeyVisual, generateStyleElements, imagePromptVersion, loadPrompt, reportLlmCall } from "@flock/agents";
import { track } from "@/lib/telemetry";
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

  const t0 = Date.now();
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
  // Las imágenes no pasan por invokeStructured: se registran acá
  const kvPrompt = imagePromptVersion(kv.ok && kv.provider === "gemini");
  if (kv.ok)
    reportLlmCall({ task: "keyvisual", provider: kv.provider, model: kv.model, attempt: 1, ok: true, latencyMs: Math.round(kv.seconds * 1000), images: 1, promptId: kvPrompt.id, promptVersion: kvPrompt.version });
  else reportLlmCall({ task: "keyvisual", provider: "?", model: "?", attempt: 1, ok: false, latencyMs: Date.now() - t0, error: kv.error.slice(0, 300) });
  // Elementos: una imagen por sujeto con el prompt "elements" (Gemini)
  if (elements.files.length)
    reportLlmCall({
      task: "elements",
      provider: "gemini",
      model: process.env.GEMINI_IMAGE_MODELS?.split(",")[0]?.trim() ?? "gemini-image",
      attempt: 1,
      ok: true,
      latencyMs: Date.now() - t0,
      images: elements.files.length,
      promptId: "elements",
      promptVersion: loadPrompt("elements").version,
    });
  track("graphics.generated", {
    ok: kv.ok || elements.files.length > 0,
    durationMs: Date.now() - t0,
    props: { keyVisual: kv.ok, provider: kv.ok ? kv.provider : null, elements: elements.files.length, elementErrors: elements.errors.length, medium: reference.medium },
  });

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
