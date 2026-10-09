import { Vibrant } from "node-vibrant/node";
import type { StyleId } from "@flock/templates";
import { converter } from "culori";
import sharp from "sharp";

const toOklch = converter("oklch");

export type MoodboardAnalysis = {
  colors: string[]; // dominantes, de más a menos presentes
  background: string; // color que más superficie ocupa (probable fondo), medido por píxeles
  seeds: { accent: string; accent2: string };
  suggestedStyle: StyleId;
  reason: string;
  stats: { lightness: number; chroma: number; warmth: number };
};

/** Analiza las imágenes del moodboard por código (sin IA): colores dominantes y estilo sugerido. */
export async function analyzeMoodboard(files: string[]): Promise<MoodboardAnalysis> {
  const swatches = (
    await Promise.all(
      files.map(async (file) => {
        // PNG en memoria: el extractor no lee WebP
        const png = await sharp(file).resize(800, 800, { fit: "inside" }).png().toBuffer();
        const palette = await Vibrant.from(png).quality(3).getPalette();
        return Object.values(palette).filter((s): s is NonNullable<typeof s> => Boolean(s));
      }),
    )
  ).flat();
  if (!swatches.length) throw new Error("No se pudieron leer colores de las imágenes");

  const total = swatches.reduce((n, s) => n + s.population, 0);
  const weighted = swatches.map((s) => ({ hex: s.hex, w: s.population / total, c: toOklch(s.hex)! }));
  const stats = {
    lightness: weighted.reduce((n, s) => n + s.c.l * s.w, 0),
    chroma: weighted.reduce((n, s) => n + (s.c.c ?? 0) * s.w, 0),
    // proporción de colores cálidos (rojos, naranjas, amarillos)
    warmth: weighted.reduce((n, s) => n + ((s.c.h ?? 0) < 90 || (s.c.h ?? 0) > 330 ? s.w : 0), 0),
  };

  const colors = [...weighted].sort((a, b) => b.w - a.w).map((s) => s.hex);
  // Acento: el más saturado con presencia; segundo acento: el saturado de tono más lejano
  const vivid = [...weighted].filter((s) => s.w > 0.02).sort((a, b) => (b.c.c ?? 0) - (a.c.c ?? 0));
  const accent = vivid[0] ?? weighted[0];
  const hueDistance = (h1 = 0, h2 = 0) => Math.min(Math.abs(h1 - h2), 360 - Math.abs(h1 - h2));
  const accent2 = [...vivid.slice(1)].sort((a, b) => hueDistance(b.c.h, accent.c.h) - hueDistance(a.c.h, accent.c.h))[0] ?? accent;

  const { style, reason } = suggestStyle(stats, accent.c.h ?? 0);
  // El extractor prioriza colores vivos; el fondo real (a veces casi negro) se mide aparte
  const { dominant } = await sharp(files[0]).stats();
  const background = `#${[dominant.r, dominant.g, dominant.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  return { colors: colors.slice(0, 8), background, seeds: { accent: accent.hex, accent2: accent2.hex }, suggestedStyle: style, reason, stats };
}

function suggestStyle(s: MoodboardAnalysis["stats"], accentHue: number): { style: StyleId; reason: string } {
  const greenish = accentHue > 90 && accentHue < 200;
  if (s.lightness < 0.42 && s.chroma > 0.08) return { style: "iridiscente", reason: "imágenes oscuras con colores intensos" };
  if (greenish || (s.chroma < 0.08 && s.warmth > 0.35)) return { style: "organico", reason: "tonos naturales y cálidos" };
  if (s.lightness > 0.6) return { style: "grilla", reason: "imágenes claras y luminosas" };
  return { style: "iridiscente", reason: "contraste alto y colores saturados" };
}
