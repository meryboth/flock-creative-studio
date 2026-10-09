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

// Flor pixel: un anillo por pétalo más el centro (los contornos se cruzan, como en el pixel art clásico)
const FLOWER_RINGS = [
  ...Array.from({ length: 5 }, (_, k) => [Math.cos((k * 2 * Math.PI) / 5 - Math.PI / 2) * 0.5, Math.sin((k * 2 * Math.PI) / 5 - Math.PI / 2) * 0.5, 0.36] as const),
  [0, 0, 0.22] as const,
];

/**
 * Motivo en pixel art: grilla de N×N celdas. Relleno, solo contorno, o relleno claro con contorno de tinta
 * (`outline`, como las nubes de los videojuegos).
 */
export function PixelMotif({ motif, x, y, size, color, outline, cells = 16 }: { motif: Motif; x: number; y: number; size: number; color: string; outline?: string; cells?: number }): Html {
  const c = size / cells;
  const coord = (i: number) => ((i + 0.5) / cells) * 2 - 1;
  const rects: Html[] = [];
  const cell = (i: number, j: number, fill: string) => rects.push(<rect x={x + i * c} y={y + j * c} width={c + 0.5} height={c + 0.5} fill={fill} />);

  if (motif === "flower") {
    const half = 1 / cells; // medio ancho de celda en coordenadas normalizadas
    for (let i = 0; i < cells; i++)
      for (let j = 0; j < cells; j++)
        if (FLOWER_RINGS.some(([cx, cy, r]) => Math.abs(Math.hypot(coord(i) - cx, coord(j) - cy) - r) <= half * 1.1)) cell(i, j, color);
    return <g>{rects}</g>;
  }

  const shape = motif === "squiggle" ? SHAPES.sparkle : SHAPES[motif];
  const at = (i: number, j: number) => i >= 0 && j >= 0 && i < cells && j < cells && shape.inside(coord(i), coord(j));
  for (let i = 0; i < cells; i++)
    for (let j = 0; j < cells; j++) {
      if (!at(i, j)) continue;
      const edge = !at(i - 1, j) || !at(i + 1, j) || !at(i, j - 1) || !at(i, j + 1);
      if (outline) cell(i, j, edge ? outline : color);
      else if (shape.fill || edge) cell(i, j, color);
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
  const placed: { motif: Motif; size: number; x: number; y: number; color: string; outline?: string }[] = [];

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
    placed.push({
      motif,
      size,
      ...best,
      color: cloud ? (ctx.kit.style.palette.scheme === "light" ? "#ffffff" : ground) : (vivid[i % vivid.length] ?? ink),
      outline: cloud ? ink : undefined,
    });
  }
  return placed;
}
