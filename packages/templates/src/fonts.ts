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

// Catálogo cerrado de fuentes locales con licencia OFL (paquetes @fontsource), todas con latin-ext (ñ, tildes).
// `file` es el patrón del archivo por subset; `weight` el rango que declara el @font-face
// (las de un solo peso declaran todo el rango para que el navegador nunca invente una negrita).
type FontEntry = { pkg: string; file: (subset: string) => string; weight: string; format: "woff2" };

/** Ficha de cada fuente: la usan la lectura de referencias, el crítico y las combinaciones de los estilos. */
export type FontMeta = {
  category: "geometrica" | "grotesca" | "extendida" | "condensada" | "serif-display" | "serif-editorial" | "slab" | "manuscrita" | "mono" | "pixel";
  roles: ("display" | "body")[];
  character: string; // en una frase, para que el modelo elija por carácter y no por nombre
  maxWeight: number;
  width: "condensed" | "normal" | "extended";
  stretchAxis?: boolean; // tiene eje de ancho (font-stretch)
  weakNumerals?: boolean; // dibuja mal números o "#": horarios y hashtag van con la de texto
  upperOnly?: boolean; // solo tiene mayúsculas
};

const v = (pkg: string, base: string, axis = "wght", weight = "100 900"): FontEntry => ({
  pkg: `@fontsource-variable/${pkg}`,
  file: (s) => `${base}-${s}-${axis}-normal.woff2`,
  weight,
  format: "woff2",
});
const one = (pkg: string, base: string, w = 400): FontEntry => ({
  pkg: `@fontsource/${pkg}`,
  file: (s) => `${base}-${s}-${w}-normal.woff2`,
  weight: "100 900",
  format: "woff2",
});

export const FONT_CATALOG: Record<string, FontEntry & { meta: FontMeta }> = {
  // ─── Geométricas y extendidas ───
  Unbounded: { ...v("unbounded", "unbounded", "wght", "200 900"), meta: { category: "extendida", roles: ["display"], character: "geométrica muy ancha y redonda, tecnológica (la del AI Day)", maxWeight: 900, width: "extended" } },
  "Krona One": { ...one("krona-one", "krona-one"), meta: { category: "extendida", roles: ["display"], character: "grotesca extendida y plana, tipo Monument Extended; afiches de diseño, estudios creativos", maxWeight: 400, width: "extended" } },
  "Lexend Zetta": { ...v("lexend-zetta", "lexend-zetta"), meta: { category: "extendida", roles: ["display"], character: "sans extendida con mucho aire entre letras; minimal, técnica", maxWeight: 900, width: "extended" } },
  Syne: { ...v("syne", "syne", "wght", "400 800"), meta: { category: "extendida", roles: ["display"], character: "grotesca de arte contemporáneo que se ensancha al subir el peso; galerías, cultura, experimental", maxWeight: 800, width: "extended" } },
  "Dela Gothic One": { ...one("dela-gothic-one", "dela-gothic-one"), meta: { category: "extendida", roles: ["display"], character: "ultra negra y ancha de esquinas suaves; impacto, streetwear, gráfica japonesa", maxWeight: 400, width: "extended" } },
  "Rubik Mono One": { ...one("rubik-mono-one", "rubik-mono-one"), meta: { category: "extendida", roles: ["display"], character: "negra, redondeada y monoespaciada, solo mayúsculas; juguetona, gamer", maxWeight: 400, width: "extended", upperOnly: true } },
  // ─── Grotescas ───
  Archivo: { ...v("archivo", "archivo", "standard"), meta: { category: "grotesca", roles: ["display", "body"], character: "grotesca neutra con eje de ancho (condensada a extendida); editorial, suiza", maxWeight: 900, width: "normal", stretchAxis: true } },
  "Archivo Black": { ...one("archivo-black", "archivo-black"), meta: { category: "grotesca", roles: ["display"], character: "grotesca ultra negra y compacta; titulares contundentes, estilo suizo", maxWeight: 400, width: "normal" } },
  "Space Grotesk": { ...v("space-grotesk", "space-grotesk", "wght", "300 700"), meta: { category: "grotesca", roles: ["display"], character: "grotesca con detalles de monoespaciada; tech, startup, producto digital", maxWeight: 700, width: "normal" } },
  "Familjen Grotesk": { ...v("familjen-grotesk", "familjen-grotesk", "wght", "400 700"), meta: { category: "grotesca", roles: ["display", "body"], character: "grotesca escandinava compacta con carácter; moderna, cálida", maxWeight: 700, width: "normal" } },
  "Bricolage Grotesque": { ...v("bricolage-grotesque", "bricolage-grotesque", "standard", "200 800"), meta: { category: "grotesca", roles: ["display"], character: "grotesca con irregularidad y mucha personalidad; cercana, lúdica", maxWeight: 800, width: "normal", stretchAxis: true } },
  Epilogue: { ...v("epilogue", "epilogue"), meta: { category: "grotesca", roles: ["display", "body"], character: "grotesca de afiche con contrastes marcados entre pesos; editorial contemporánea", maxWeight: 900, width: "normal" } },
  "Inter Tight": { ...v("inter-tight", "inter-tight"), meta: { category: "grotesca", roles: ["display"], character: "neo-grotesca neutra y apretada; interfaz, corporativo moderno", maxWeight: 900, width: "normal" } },
  // ─── Condensadas ───
  "Bebas Neue": { ...one("bebas-neue", "bebas-neue"), meta: { category: "condensada", roles: ["display"], character: "condensada de afiche, alta, solo mayúsculas; deporte, cine", maxWeight: 400, width: "condensed", upperOnly: true } },
  Anton: { ...one("anton", "anton"), meta: { category: "condensada", roles: ["display"], character: "condensada negra de titular de diario; urgente, potente", maxWeight: 400, width: "condensed" } },
  "Big Shoulders Display": { ...v("big-shoulders-display", "big-shoulders-display"), meta: { category: "condensada", roles: ["display"], character: "condensada industrial de señalética urbana; Chicago, ingeniería", maxWeight: 900, width: "condensed" } },
  // ─── Serif ───
  Gloock: { ...one("gloock", "gloock"), meta: { category: "serif-display", roles: ["display"], character: "serif display de alto contraste, elegante y cálida", maxWeight: 400, width: "normal", weakNumerals: true } },
  "DM Serif Display": { ...one("dm-serif-display", "dm-serif-display"), meta: { category: "serif-display", roles: ["display"], character: "serif de revista de moda, alto contraste y curvas generosas", maxWeight: 400, width: "normal" } },
  Fraunces: { ...v("fraunces", "fraunces"), meta: { category: "serif-display", roles: ["display"], character: "serif 'old style' blanda y con humor, de negra a fina; retro setentas, cálida", maxWeight: 900, width: "normal" } },
  "Instrument Serif": { ...one("instrument-serif", "instrument-serif"), meta: { category: "serif-editorial", roles: ["display"], character: "serif editorial fina y condensada; moderna, sobria", maxWeight: 400, width: "condensed", weakNumerals: true } },
  "Young Serif": { ...one("young-serif", "young-serif"), meta: { category: "slab", roles: ["display"], character: "serif robusta de pie corto, amigable; libros infantiles, comida, artesanal", maxWeight: 400, width: "normal" } },
  // ─── Otras voces ───
  Caveat: { ...v("caveat", "caveat", "wght", "400 700"), meta: { category: "manuscrita", roles: ["display"], character: "manuscrita informal, notas a mano", maxWeight: 700, width: "normal", weakNumerals: true } },
  "JetBrains Mono": { ...v("jetbrains-mono", "jetbrains-mono", "wght", "100 800"), meta: { category: "mono", roles: ["display", "body"], character: "monoespaciada de código; terminal, desarrolladores", maxWeight: 800, width: "normal" } },
  "Pixelify Sans": { ...v("pixelify-sans", "pixelify-sans", "wght", "400 700"), meta: { category: "pixel", roles: ["display"], character: "pixel 8-bit redondeada; videojuego, retro digital", maxWeight: 700, width: "normal" } },
  // Silkscreen solo tiene 400 y 700: se usa la negrita para todos los pesos
  Silkscreen: { ...one("silkscreen", "silkscreen", 700), meta: { category: "pixel", roles: ["display"], character: "bitmap muy marcada y ancha, en mayúsculas; computadora retro", maxWeight: 700, width: "extended" } },
  // ─── Texto ───
  Manrope: { ...v("manrope", "manrope", "wght", "200 800"), meta: { category: "geometrica", roles: ["body"], character: "sans geométrica técnica y legible", maxWeight: 800, width: "normal" } },
  Figtree: { ...v("figtree", "figtree", "wght", "300 900"), meta: { category: "geometrica", roles: ["body"], character: "sans geométrica amable", maxWeight: 900, width: "normal" } },
  "DM Sans": { ...v("dm-sans", "dm-sans", "wght", "100 1000"), meta: { category: "geometrica", roles: ["body"], character: "sans geométrica de bajo contraste, clara y redonda", maxWeight: 1000, width: "normal" } },
};

export const DISPLAY_FONTS = Object.keys(FONT_CATALOG).filter((f) => FONT_CATALOG[f].meta.roles.includes("display"));
export const BODY_FONTS = Object.keys(FONT_CATALOG).filter((f) => FONT_CATALOG[f].meta.roles.includes("body"));
export const fontMeta = (family: string): FontMeta | undefined => FONT_CATALOG[family]?.meta;

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
