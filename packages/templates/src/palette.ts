import { converter, formatHex, wcagContrast } from "culori";
import type { Palette, ReferenceStyle, StyleId } from "./kit.js";

const toOklch = converter("oklch");

type Oklch = { l: number; c: number; h: number };

function parse(hex: string): Oklch {
  const c = toOklch(hex);
  if (!c) throw new Error(`Color inválido: ${hex}`);
  return { l: c.l, c: c.c ?? 0, h: c.h ?? 0 };
}

const hex = (l: number, c: number, h: number) =>
  formatHex({ mode: "oklch", l: clamp(l, 0, 1), c: Math.max(0, c), h: ((h % 360) + 360) % 360 })!;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Ajusta la luminosidad de `fg` hasta lograr el contraste pedido sobre `bg`. */
export function ensureContrast(fg: string, bg: string, min = 4.5) {
  if (wcagContrast(fg, bg) >= min) return fg;
  const f = parse(fg);
  const lighter = parse(bg).l < 0.5;
  for (let i = 1; i <= 40; i++) {
    const candidate = hex(f.l + (lighter ? 1 : -1) * i * 0.02, f.c, f.h);
    if (wcagContrast(candidate, bg) >= min) return candidate;
  }
  return lighter ? "#ffffff" : "#000000";
}

export const contrast = (a: string, b: string) => wcagContrast(a, b);

// Colores institucionales de Flock (brand/brand.json)
const FLOCK = { orange: "#FF5102", violet: "#7F07C5", deep: "#44016B", violeta3: "#180026" };

/**
 * Deriva la paleta completa de un estilo a partir de uno o dos colores semilla
 * (elegidos a mano o extraídos del moodboard). Garantiza contraste AA del texto.
 */
export function derivePalette(style: StyleId, seeds: { accent: string; accent2?: string }): Palette {
  const a = parse(seeds.accent);
  const a2 = seeds.accent2 ? parse(seeds.accent2) : { ...a, h: a.h + 150 };

  let p: Palette;
  switch (style) {
    case "iridiscente": {
      const ground = hex(0.16, Math.min(a.c, 0.09), a.h);
      p = {
        scheme: "dark",
        ground,
        groundDeep: hex(0.1, Math.min(a.c, 0.06), a.h),
        ink: "#ffffff",
        muted: hex(0.86, 0.05, a.h),
        accent: hex(0.62, Math.max(a.c, 0.2), a.h),
        accent2: hex(0.7, Math.max(a2.c, 0.16), a2.h),
        line: "#ffffff",
        shapes: [hex(0.58, 0.24, a.h), hex(0.66, 0.2, a.h + 40), hex(0.74, 0.16, a.h - 50), hex(0.55, 0.22, a2.h)],
      };
      break;
    }
    case "grilla": {
      // papel casi neutro: con acentos cálidos, un tinte más fuerte se lee como crema genérico
      const ground = hex(0.985, 0.003, a.h);
      p = {
        scheme: "light",
        ground,
        groundDeep: hex(0.93, 0.012, a.h),
        ink: hex(0.2, 0.02, a.h),
        muted: hex(0.42, 0.02, a.h),
        accent: hex(clamp(a.l, 0.5, 0.64), Math.max(a.c, 0.17), a.h),
        accent2: hex(clamp(a2.l, 0.62, 0.8), Math.max(a2.c, 0.13), a2.h),
        line: hex(0.2, 0.02, a.h),
        shapes: [
          hex(clamp(a.l, 0.5, 0.64), Math.max(a.c, 0.17), a.h),
          hex(clamp(a2.l, 0.62, 0.8), Math.max(a2.c, 0.13), a2.h),
          hex(0.2, 0.02, a.h),
          hex(0.86, 0.06, a.h + 30),
        ],
      };
      break;
    }
    case "flock": {
      p = {
        scheme: "dark",
        ground: FLOCK.violeta3,
        groundDeep: "#0d0118",
        ink: "#ffffff",
        muted: "#d9c6ec",
        accent: FLOCK.orange,
        accent2: FLOCK.violet,
        line: "#ffffff",
        shapes: [FLOCK.orange, FLOCK.violet, FLOCK.deep],
      };
      break;
    }
    case "referencia":
      // sin referencia (ej. vista previa vacía) se comporta como Iridiscente
      return derivePalette("iridiscente", seeds);
    case "organico": {
      const ground = hex(0.3, clamp(a.c, 0.04, 0.08), a.h);
      p = {
        scheme: "dark",
        ground,
        groundDeep: hex(0.24, clamp(a.c, 0.04, 0.07), a.h),
        ink: hex(0.97, 0.02, a.h + 60),
        muted: hex(0.86, 0.04, a.h + 40),
        accent: hex(0.8, 0.12, a2.h),
        accent2: hex(0.6, 0.1, a.h + 25),
        line: hex(0.97, 0.02, a.h + 60),
        shapes: [hex(0.42, 0.09, a.h), hex(0.52, 0.1, a.h + 25), hex(0.66, 0.1, a.h - 20), hex(0.8, 0.12, a2.h)],
      };
      break;
    }
  }

  p.ink = ensureContrast(p.ink, p.ground, 7);
  p.muted = ensureContrast(p.muted, p.ground, 4.5);
  return p;
}

/**
 * Paleta tomada de una imagen de referencia. Respeta sus colores y solo corrige
 * lo necesario para que el texto cumpla contraste AA.
 */
export function paletteFromReference(ref: ReferenceStyle): Palette {
  const g = parse(ref.colors.ground);
  const groundDeep = hex(g.l + (ref.scheme === "dark" ? -0.06 : -0.04), g.c, g.h);
  const ink = ensureContrast(ref.colors.ink, ref.colors.ground, 7);
  return {
    scheme: ref.scheme,
    ground: ref.colors.ground,
    groundDeep,
    ink,
    // Texto secundario teñido con el tono del fondo (nunca gris sobre color)
    muted: ensureContrast(hex(parse(ink).l + (ref.scheme === "dark" ? -0.1 : 0.18), Math.max(g.c * 0.5, 0.035), g.h), ref.colors.ground, 4.5),
    accent: ref.colors.accent,
    accent2: ref.colors.accent2,
    line: ink,
    shapes: shapesFor(ref),
  };
}

/**
 * Colores para las formas: los que se despegan del fondo. Si una referencia tiene pocos colores
 * distintos del fondo, los demás se aclaran u oscurecen lo justo para que se vean.
 */
function shapesFor(ref: ReferenceStyle) {
  const raw = ref.colors.shapes.length ? ref.colors.shapes : [ref.colors.accent, ref.colors.accent2];
  const g = parse(ref.colors.ground);
  const distinct = raw.filter((c) => Math.abs(parse(c).l - g.l) >= 0.12);
  return distinct.length >= 2 ? distinct : raw.map((c) => separateFrom(c, ref.colors.ground));
}

/** Garantiza una diferencia mínima de luminosidad (OKLCH) entre un color y el fondo. */
function separateFrom(color: string, ground: string, minDelta = 0.22) {
  const c = parse(color);
  const g = parse(ground);
  if (Math.abs(c.l - g.l) >= minDelta) return color;
  const l = g.l < 0.5 ? g.l + minDelta : g.l - minDelta;
  return hex(l, Math.max(c.c, 0.08), c.h);
}

/** Color por defecto de cada estilo cuando no hay semillas. */
export const DEFAULT_SEEDS: Record<StyleId, { accent: string; accent2?: string }> = {
  iridiscente: { accent: "#2b3bff", accent2: "#c35cff" },
  grilla: { accent: "#ff5102", accent2: "#3d7cff" },
  flock: { accent: FLOCK.orange, accent2: FLOCK.violet },
  organico: { accent: "#2f6b4f", accent2: "#f2b84b" },
  referencia: { accent: "#2b3bff", accent2: "#c35cff" },
};
