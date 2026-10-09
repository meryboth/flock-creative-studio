import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

// Resolución de los paquetes de fuentes: desde este módulo (Node, CLI) o, si el código fue
// empaquetado por Next, desde el @flock/templates instalado en la app que lo usa.
const resolvers = [
  createRequire(import.meta.url),
  createRequire(join(process.cwd(), "node_modules/@flock/templates/package.json")),
];

function packageDir(pkg: string) {
  for (const r of resolvers) {
    try {
      return dirname(r.resolve(`${pkg}/package.json`));
    } catch {
      // probar el siguiente
    }
  }
  throw new Error(`No se encontró el paquete de fuentes ${pkg}`);
}

// Catálogo cerrado de fuentes locales con licencia OFL (paquetes @fontsource).
// `file` es el patrón del archivo por subset; `weight` el rango que declara el @font-face.
type FontEntry = { pkg: string; file: (subset: string) => string; weight: string; format: "woff2" };

export const FONT_CATALOG: Record<string, FontEntry> = {
  Unbounded: { pkg: "@fontsource-variable/unbounded", file: (s) => `unbounded-${s}-wght-normal.woff2`, weight: "200 900", format: "woff2" },
  Manrope: { pkg: "@fontsource-variable/manrope", file: (s) => `manrope-${s}-wght-normal.woff2`, weight: "200 800", format: "woff2" },
  Archivo: { pkg: "@fontsource-variable/archivo", file: (s) => `archivo-${s}-standard-normal.woff2`, weight: "100 900", format: "woff2" },
  "Bricolage Grotesque": {
    pkg: "@fontsource-variable/bricolage-grotesque",
    file: (s) => `bricolage-grotesque-${s}-standard-normal.woff2`,
    weight: "200 800",
    format: "woff2",
  },
  Figtree: { pkg: "@fontsource-variable/figtree", file: (s) => `figtree-${s}-wght-normal.woff2`, weight: "300 900", format: "woff2" },
  Gloock: { pkg: "@fontsource/gloock", file: (s) => `gloock-${s}-400-normal.woff2`, weight: "400", format: "woff2" },
  "Pixelify Sans": { pkg: "@fontsource-variable/pixelify-sans", file: (s) => `pixelify-sans-${s}-wght-normal.woff2`, weight: "400 700", format: "woff2" },
  // Silkscreen solo tiene 400 y 700: se usa la negrita para todos los pesos
  Silkscreen: { pkg: "@fontsource/silkscreen", file: (s) => `silkscreen-${s}-700-normal.woff2`, weight: "400 900", format: "woff2" },
  Caveat: { pkg: "@fontsource-variable/caveat", file: (s) => `caveat-${s}-wght-normal.woff2`, weight: "400 700", format: "woff2" },
  "Bebas Neue": { pkg: "@fontsource/bebas-neue", file: (s) => `bebas-neue-${s}-400-normal.woff2`, weight: "400 900", format: "woff2" },
  "Instrument Serif": { pkg: "@fontsource/instrument-serif", file: (s) => `instrument-serif-${s}-400-normal.woff2`, weight: "400", format: "woff2" },
  "JetBrains Mono": { pkg: "@fontsource-variable/jetbrains-mono", file: (s) => `jetbrains-mono-${s}-wght-normal.woff2`, weight: "100 800", format: "woff2" },
};

const SUBSETS = [
  {
    name: "latin-ext",
    range:
      "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
  },
  {
    name: "latin",
    range:
      "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
  },
];

/** Ruta absoluta del archivo de una fuente (para servirla desde la app). */
export function fontFilePath(family: string, subset: string) {
  const entry = FONT_CATALOG[family];
  if (!entry) throw new Error(`Fuente "${family}" no está en el catálogo local`);
  return join(packageDir(entry.pkg), "files", entry.file(subset));
}

/**
 * @font-face para una familia.
 * @param url cómo referenciar cada archivo: data URI (render final) o URL de la app (preview)
 */
export async function fontFaceCss(family: string, url: (family: string, subset: string) => Promise<string> | string) {
  const entry = FONT_CATALOG[family];
  if (!entry) throw new Error(`Fuente "${family}" no está en el catálogo local`);
  const faces = await Promise.all(
    SUBSETS.map(
      async (s) => `@font-face {
  font-family: "${family}";
  font-style: normal;
  font-display: block;
  font-weight: ${entry.weight};
  src: url(${await url(family, s.name)}) format("${entry.format}");
  unicode-range: ${s.range};
}`,
    ),
  );
  return faces.join("\n");
}

export async function fontDataUri(family: string, subset: string) {
  return `data:font/woff2;base64,${(await readFile(fontFilePath(family, subset))).toString("base64")}`;
}
