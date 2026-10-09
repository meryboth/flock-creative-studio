import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fontDataUri, fontFaceCss } from "./fonts.js";
import type { EventKit, ResolvedAssets } from "./kit.js";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

export async function dataUri(file: string) {
  const mime = MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
  return `data:${mime};base64,${(await readFile(file)).toString("base64")}`;
}

type BrandManifest = { logos: { id: string; file: string }[]; elements?: { id: string; file: string }[] };

export type AssetMode =
  // Render final: todo embebido como data URI (piezas y landing autocontenidas)
  | { kind: "inline"; brandDir: string; keyVisualPath?: string }
  // Previews en la app: los archivos se piden por URL, el HTML queda liviano
  | {
      kind: "linked";
      brandDir: string;
      brandUrl: (file: string) => string;
      fontUrl: (family: string, subset: string) => string;
      keyVisualUrl?: string;
    };

export async function resolveAssets(kit: EventKit, mode: AssetMode): Promise<ResolvedAssets> {
  const manifest: BrandManifest = JSON.parse(await readFile(join(mode.brandDir, "brand.json"), "utf8"));
  const brandFile = (id: string, list: { id: string; file: string }[] = []) => {
    const entry = list.find((l) => l.id === id);
    if (!entry) throw new Error(`"${id}" no existe en brand.json`);
    return entry.file;
  };

  // Logo según el esquema del estilo: blanco sobre oscuro, color sobre claro
  const logoFile = brandFile(kit.style.palette.scheme === "dark" ? kit.logo.onDark : kit.logo.onLight, manifest.logos);
  const pieceFile = brandFile("pieza-outline-gradient", manifest.elements);
  const families = [...new Set([kit.style.fonts.display, kit.style.fonts.body])];

  if (mode.kind === "inline") {
    const [logo, brandPiece, keyVisual, ...faces] = await Promise.all([
      dataUri(join(mode.brandDir, logoFile)),
      dataUri(join(mode.brandDir, pieceFile)),
      mode.keyVisualPath ? dataUri(mode.keyVisualPath) : undefined,
      ...families.map((f) => fontFaceCss(f, fontDataUri)),
    ]);
    return { logo, brandPiece, keyVisual, fontCss: faces.join("\n") };
  }

  const faces = await Promise.all(families.map((f) => fontFaceCss(f, mode.fontUrl)));
  return {
    logo: mode.brandUrl(logoFile),
    brandPiece: mode.brandUrl(pieceFile),
    keyVisual: mode.keyVisualUrl,
    fontCss: faces.join("\n"),
  };
}
