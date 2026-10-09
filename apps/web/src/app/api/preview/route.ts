import type { NextRequest } from "next/server";
import { STYLES, type Language, type StyleId } from "@flock/templates";
import { existsSync } from "node:fs";
import { previewHtml, type PreviewPiece } from "@/lib/preview";
import { keyVisualPath, keyVisualUrl, readReference } from "@/lib/reference";

const HEX = /^#[0-9a-f]{6}$/i;

// Vista previa en vivo de un estilo aplicado a los datos del formulario
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const styleId = q.get("style") as StyleId;
  if (!STYLES[styleId]) return new Response("Estilo inválido", { status: 400 });
  const accent = q.get("accent") ?? "";
  const accent2 = q.get("accent2") ?? "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(q.get("date") ?? "") ? q.get("date")! : new Date().toISOString().slice(0, 10);

  // Estilo "Tu referencia": se arma con la lectura guardada de la subida
  const ref = q.get("ref");
  const stored = styleId === "referencia" && ref ? await readReference(ref).catch(() => null) : null;
  const withKeyVisual = stored && ref && q.get("kv") === "1" && existsSync(keyVisualPath(ref));

  const html = await previewHtml(
    {
      event: {
        name: q.get("name")?.trim() || "Nombre del evento",
        date,
        location: q.get("location") || undefined,
        hashtag: q.get("hashtag") || undefined,
        tagline: q.get("tagline") || undefined,
        description: q.get("description") || undefined,
        language: (q.get("language") === "en" ? "en" : "es") as Language,
      },
      styleId,
      seeds: HEX.test(accent) ? { accent, accent2: HEX.test(accent2) ? accent2 : undefined } : undefined,
      seed: Number(q.get("seed")) || 1,
      reference: stored?.style,
      keyVisual: withKeyVisual ? { file: "keyvisual.png", fit: "object" } : undefined,
    },
    (q.get("piece") as PreviewPiece) ?? "linkedin",
    withKeyVisual && ref ? keyVisualUrl(ref) : undefined,
  );
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
