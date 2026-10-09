import type { NextRequest } from "next/server";
import { STYLES, type Language, type StyleId } from "@flock/templates";
import { existsSync } from "node:fs";
import { previewHtml, type PreviewPiece } from "@/lib/preview";
import { keyVisualPath, keyVisualUrl, readReference, readTemplates, uploadElements } from "@/lib/reference";
import { getLibraryStyle } from "@/lib/style-library";
import { STORAGE_DIR } from "@/lib/paths";
import { join } from "node:path";

const HEX = /^#[0-9a-f]{6}$/i;

// Vista previa en vivo de un estilo aplicado a los datos del formulario
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const styleId = q.get("style") as StyleId;
  if (!STYLES[styleId]) return new Response("Estilo inválido", { status: 400 });
  const accent = q.get("accent") ?? "";
  const accent2 = q.get("accent2") ?? "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(q.get("date") ?? "") ? q.get("date")! : new Date().toISOString().slice(0, 10);

  // Estilo "Tu referencia": lectura guardada de una subida (?ref) o un estilo de la biblioteca (?lib)
  const ref = q.get("ref");
  const lib = q.get("lib");
  const library = styleId === "referencia" && lib ? await getLibraryStyle(lib) : null;
  const stored = library
    ? { style: library.reference }
    : styleId === "referencia" && ref
      ? await readReference(ref).catch(() => null)
      : null;
  const libraryKv = library?.keyVisual && existsSync(join(STORAGE_DIR, library.keyVisual)) ? `/api/storage/${library.keyVisual}` : null;
  const uploadKv = !library && stored && ref && q.get("kv") === "1" && existsSync(keyVisualPath(ref)) ? keyVisualUrl(ref) : null;
  const kvUrl = libraryKv ?? uploadKv;
  // Elementos generados: los de la biblioteca o, con ?el=1, los de la subida
  const elementUrls = library
    ? library.elements.filter((e) => existsSync(join(STORAGE_DIR, e))).map((e) => `/api/storage/${e}`)
    : stored && ref && q.get("el") === "1"
      ? (await uploadElements(ref)).map((e) => `/api/storage/${e}`)
      : [];

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
      keyVisual: kvUrl ? { file: "keyvisual.png", fit: "object" } : undefined,
    },
    (q.get("piece") as PreviewPiece) ?? "linkedin",
    kvUrl ?? undefined,
    elementUrls,
    // Plantillas diseñadas por IA: las de la biblioteca o, con ?tpl=1, las de la subida
    library?.templates ?? (stored && ref && q.get("tpl") === "1" ? ((await readTemplates(ref)) ?? undefined) : undefined),
  );
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
