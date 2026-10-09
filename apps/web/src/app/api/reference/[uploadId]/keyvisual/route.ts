import { generateKeyVisual } from "@flock/agents";
import { buildKit } from "@flock/templates";
import { REPO_ROOT } from "@/lib/paths";
import { clearProgress, getProgress, setProgress } from "@/lib/progress";
import { keyVisualPath, keyVisualUrl, readReference, referenceImages } from "@/lib/reference";

// Genera un key visual original inspirado en la referencia (modelo de imagen)
export async function POST(req: Request, ctx: RouteContext<"/api/reference/[uploadId]/keyvisual">) {
  const { uploadId } = await ctx.params;
  let reference;
  try {
    reference = await readReference(uploadId);
  } catch {
    return Response.json({ error: "Subida inválida" }, { status: 400 });
  }
  if (!reference) return Response.json({ error: "Primero hay que analizar la referencia" }, { status: 404 });

  // El visual se pide sobre el color de fondo final, para que se funda con las piezas
  const kit = buildKit({ event: { name: "-", date: "2026-01-01", language: "es" }, styleId: "referencia", reference: reference.style });
  const result = await generateKeyVisual({
    references: await referenceImages(uploadId),
    prompt: reference.keyVisualPrompt,
    ground: kit.style.palette.ground,
    outFile: keyVisualPath(uploadId),
    repoRoot: REPO_ROOT,
    medium: reference.medium,
    // ?provider=gemini|comfyui fuerza un proveedor; sin parámetro, el orden configurado
    providers: ["gemini", "comfyui"].includes(new URL(req.url).searchParams.get("provider") ?? "")
      ? [new URL(req.url).searchParams.get("provider")!]
      : undefined,
    onProgress: (p) => setProgress(`keyvisual:${uploadId}`, p),
  });
  clearProgress(`keyvisual:${uploadId}`);
  if (!result.ok) return Response.json({ error: result.error, quota: result.quota ?? false }, { status: result.quota ? 402 : 502 });
  return Response.json({ url: `${keyVisualUrl(uploadId)}?v=${Date.now()}`, provider: result.provider, model: result.model, seconds: result.seconds });
}

// Progreso de la generación en curso (la interfaz lo consulta cada segundo)
export async function GET(_req: Request, ctx: RouteContext<"/api/reference/[uploadId]/keyvisual">) {
  const { uploadId } = await ctx.params;
  return Response.json(getProgress(`keyvisual:${uploadId}`), { headers: { "Cache-Control": "no-store" } });
}
