/** @jsxRuntime automatic @jsxImportSource @flock/templates */
import type { Html } from "./jsx-runtime.js";
import type { Motif, RenderContext } from "./kit.js";

// Motivos como formas matemáticas en [-1, 1]²: se rasterizan (pixel) o se trazan (doodle)

type Inside = (x: number, y: number) => boolean;

const circle = (cx: number, cy: number, r: number): Inside => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const union = (...fs: Inside[]): Inside => (x, y) => fs.some((f) => f(x, y));

const SHAPES: Record<Exclude<Motif, "squiggle">, { inside: Inside; fill: boolean }> = {
  // flor: cinco pétalos y centro, solo contorno (como en el pixel art de referencia)
  flower: {
    inside: union(
      ...Array.from({ length: 5 }, (_, k) => circle(Math.cos((k * 2 * Math.PI) / 5 - Math.PI / 2) * 0.48, Math.sin((k * 2 * Math.PI) / 5 - Math.PI / 2) * 0.48, 0.4)),
      circle(0, 0, 0.3),
    ),
    fill: false,
  },
  cloud: { inside: union(circle(-0.45, 0.15, 0.35), circle(0.02, -0.12, 0.47), circle(0.48, 0.15, 0.33), (x, y) => Math.abs(x) <= 0.78 && y >= 0.12 && y <= 0.45), fill: true },
  heart: {
    inside: (x, y) => {
      const X = x * 1.25;
      const Y = -(y * 1.25 - 0.2);
      return (X * X + Y * Y - 1) ** 3 - X * X * Y ** 3 <= 0;
    },
    fill: true,
  },
  star: {
    inside: (x, y) => {
      // estrella de 5 puntas: comparar el radio con el borde del polígono en ese ángulo
      const a = Math.atan2(y, x) + Math.PI / 2;
      const k = ((a % ((2 * Math.PI) / 5)) + (2 * Math.PI) / 5) % ((2 * Math.PI) / 5);
      const t = Math.abs(k - Math.PI / 5) / (Math.PI / 5);
      return Math.hypot(x, y) <= 0.42 + 0.53 * t ** 1.6;
    },
    fill: true,
  },
  sparkle: { inside: (x, y) => Math.sqrt(Math.abs(x)) + Math.sqrt(Math.abs(y)) <= 0.95, fill: true },
};

// ─── Pixel art con oficio: regiones, contorno de 1 px y sombreado ───────────

/** Región de cada punto del motivo: 0 = afuera, 1 = color principal, 2 = color secundario (ej. centro de la flor). */
type Regions = (x: number, y: number) => 0 | 1 | 2;

const REGIONS: Record<Motif, Regions> = {
  flower: (x, y) => {
    if (circle(0, 0, 0.26)(x, y)) return 2;
    const petals = Array.from({ length: 5 }, (_, k) => {
      const a = (k * 2 * Math.PI) / 5 - Math.PI / 2;
      return circle(Math.cos(a) * 0.52, Math.sin(a) * 0.52, 0.4);
    });
    return petals.some((p) => p(x, y)) ? 1 : 0;
  },
  cloud: (x, y) => (SHAPES.cloud.inside(x, y) ? 1 : 0),
  heart: (x, y) => (SHAPES.heart.inside(x, y) ? 1 : 0),
  star: (x, y) => (SHAPES.star.inside(x, y) ? 1 : 0),
  sparkle: (x, y) => (SHAPES.sparkle.inside(x, y) ? 1 : 0),
  squiggle: (x, y) => (Math.abs(y - Math.sin(x * Math.PI * 2) * 0.35) < 0.16 && Math.abs(x) < 0.9 ? 1 : 0),
};

export type SpriteColors = { main: string; secondary: string; outline: string };

/** Mezcla dos colores hex (t = 0 → a, t = 1 → b). */
function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Sprite en pixel art: grilla de N×N celdas con contorno de tinta de 1 px, luz arriba a la izquierda
 * y sombra abajo a la derecha (como los sprites de videojuego), en vez de una forma plana.
 */
export function PixelMotif({ motif, x, y, size, colors, cells = 20 }: { motif: Motif; x: number; y: number; size: number; colors: SpriteColors; cells?: number }): Html {
  const region = REGIONS[motif];
  const c = size / cells;
  const coord = (i: number) => ((i + 0.5) / cells) * 2 - 1;
  const grid: number[][] = Array.from({ length: cells }, (_, i) => Array.from({ length: cells }, (_, j) => region(coord(i), coord(j))));
  const at = (i: number, j: number) => (i < 0 || j < 0 || i >= cells || j >= cells ? 0 : grid[i][j]);
  const tones = (base: string) => ({ base, light: mix(base, "#ffffff", 0.45), dark: mix(base, "#000000", 0.28) });
  const palette = { 1: tones(colors.main), 2: tones(colors.secondary) } as const;

  const rects: Html[] = [];
  for (let i = 0; i < cells; i++)
    for (let j = 0; j < cells; j++) {
      const r = grid[i][j];
      if (!r) continue;
      // contorno: borde con el afuera o con otra región
      const edge = [at(i - 1, j), at(i + 1, j), at(i, j - 1), at(i, j + 1)].some((n) => n !== r);
      let fill: string;
      if (edge) fill = colors.outline;
      else {
        const t = palette[r as 1 | 2];
        // luz: el contorno queda arriba o a la izquierda; sombra: abajo o a la derecha
        const nearTopLeft = at(i - 2, j) !== r || at(i, j - 2) !== r;
        const nearBottomRight = at(i + 2, j) !== r || at(i, j + 2) !== r;
        fill = nearTopLeft && !nearBottomRight ? t.light : nearBottomRight && !nearTopLeft ? t.dark : t.base;
      }
      rects.push(<rect x={x + i * c} y={y + j * c} width={c + 0.5} height={c + 0.5} fill={fill} />);
    }
  return <g>{rects}</g>;
}

/** Motivo dibujado a mano: el contorno de la forma como trazo, con un leve temblor. */
export function DoodleMotif({ motif, x, y, size, color, rand }: { motif: Motif; x: number; y: number; size: number; color: string; rand: () => number }): Html {
  const stroke = Math.max(3, size * 0.035);
  const jitter = () => (rand() - 0.5) * size * 0.025;
  const pt = (px: number, py: number) => `${(x + ((px + 1) / 2) * size + jitter()).toFixed(1)},${(y + ((py + 1) / 2) * size + jitter()).toFixed(1)}`;
  const paths: string[] = [];
  const loop = (fn: (t: number) => [number, number], n = 48) =>
    paths.push(`M${Array.from({ length: n + 1 }, (_, i) => pt(...fn((i / n) * 2 * Math.PI))).join(" L")}`);

  switch (motif) {
    case "flower":
      for (let k = 0; k < 5; k++) {
        const a = (k * 2 * Math.PI) / 5 - Math.PI / 2;
        loop((t) => [Math.cos(a) * 0.48 + Math.cos(t) * 0.38, Math.sin(a) * 0.48 + Math.sin(t) * 0.38], 28);
      }
      loop((t) => [Math.cos(t) * 0.24, Math.sin(t) * 0.24], 20);
      break;
    case "heart":
      loop((t) => [(16 * Math.sin(t) ** 3) / 17, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17]);
      break;
    case "star":
      paths.push(`M${Array.from({ length: 11 }, (_, i) => {
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        const r = i % 2 ? 0.4 : 0.95;
        return pt(Math.cos(a) * r, Math.sin(a) * r);
      }).join(" L")}`);
      break;
    case "sparkle":
      loop((t) => [Math.sign(Math.cos(t)) * Math.abs(Math.cos(t)) ** 3 * 0.9, Math.sign(Math.sin(t)) * Math.abs(Math.sin(t)) ** 3 * 0.9]);
      break;
    case "cloud":
      loop((t) => {
        const bumps = 1 + 0.18 * Math.max(0, Math.sin(t * 5)) * (Math.sin(t) < 0.2 ? 1 : 0);
        return [Math.cos(t) * 0.85 * bumps, Math.sin(t) * 0.45 * bumps];
      }, 72);
      break;
    case "squiggle":
      paths.push(`M${Array.from({ length: 40 }, (_, i) => pt(-0.9 + (i / 39) * 1.8, Math.sin((i / 39) * Math.PI * 4) * 0.3)).join(" L")}`);
      break;
  }
  return (
    <g fill="none" stroke={color} stroke-width={stroke} stroke-linecap="round" stroke-linejoin="round">
      {paths.map((d) => (
        <path d={d} />
      ))}
    </g>
  );
}

export const DEFAULT_MOTIFS: Motif[] = ["flower", "cloud", "heart", "star"];

/**
 * Elige y ubica motivos dentro de la zona del visual (con semilla), sin que se pisen
 * y sin salirse del lienzo: prueba posiciones al azar y se queda con la primera libre.
 */
export function layoutMotifs(
  ctx: RenderContext,
  area: { x: number; y: number; w: number; h: number },
  canvas: { width: number; height: number },
  rand: () => number,
) {
  const motifs = ctx.kit.style.reference?.motifs?.length ? ctx.kit.style.reference.motifs : DEFAULT_MOTIFS;
  const { shapes, ground, ink } = ctx.kit.style.palette;
  const vivid = shapes.filter((c) => c.toLowerCase() !== ground.toLowerCase());
  const margin = Math.min(canvas.width, canvas.height) * 0.03;
  // la zona útil es la parte de la zona del visual que cae dentro del lienzo
  const zone = {
    x0: Math.max(area.x, margin),
    y0: Math.max(area.y, margin),
    x1: Math.min(area.x + area.w, canvas.width - margin),
    y1: Math.min(area.y + area.h, canvas.height - margin),
  };
  const base = Math.min(zone.x1 - zone.x0, zone.y1 - zone.y0);
  const placed: { motif: Motif; size: number; x: number; y: number; color: string; colors: SpriteColors }[] = [];

  for (let i = 0; i < 4; i++) {
    const motif = motifs[i % motifs.length];
    const cloud = motif === "cloud";
    const size = base * (i === 0 ? 0.55 : cloud ? 0.4 : 0.28 + rand() * 0.14);
    let best: { x: number; y: number } | null = null;
    for (let attempt = 0; attempt < 40 && !best; attempt++) {
      const x = zone.x0 + rand() * Math.max(1, zone.x1 - zone.x0 - size);
      const y = zone.y0 + rand() * Math.max(1, zone.y1 - zone.y0 - size);
      const free = placed.every((p) => Math.hypot(p.x + p.size / 2 - (x + size / 2), p.y + p.size / 2 - (y + size / 2)) > (p.size + size) / 2);
      if (free) best = { x, y };
    }
    if (!best) continue; // no hay lugar: mejor un motivo menos que motivos encimados
    const main = cloud ? (ctx.kit.style.palette.scheme === "light" ? "#ffffff" : mix(ground, "#ffffff", 0.85)) : (vivid[i % vivid.length] ?? ink);
    placed.push({
      motif,
      size,
      ...best,
      color: main,
      colors: { main, secondary: vivid[(i + 1) % vivid.length] ?? ctx.kit.style.palette.accent2, outline: ink },
    });
  }
  return placed;
}
