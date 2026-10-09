import type { EventKit, Generator, Palette, ReferenceStyle, StyleId } from "./kit.js";

export type StyleDef = {
  id: StyleId;
  name: string;
  description: string;
  fonts: { display: string; body: string };
  // Tratamiento tipográfico y de componentes del estilo
  display: { weight: number; transform: "uppercase" | "none"; tracking: string; stretch: string; leading: number };
  radius: number; // radio de cajas; las pastillas usan 999px salvo que el estilo sea recto
  pillRadius: string;
  stroke: number;
  // Pintura del fondo a partir de la paleta
  ground: (p: Palette) => string;
  // Si el usuario puede elegir el color semilla (Flock usa los institucionales)
  customColors: boolean;
  // Ajustes propios del estilo sobre las plantillas
  css?: string;
  generator: Generator;
};

export const STYLES: Record<StyleId, StyleDef> = {
  iridiscente: {
    id: "iridiscente",
    generator: "orbs",
    name: "Iridiscente",
    description: "Fondo profundo con esferas de luz en los tonos del acento. Tecnología, innovación, noche.",
    fonts: { display: "Unbounded", body: "Manrope" },
    display: { weight: 800, transform: "uppercase", tracking: "0.005em", stretch: "100%", leading: 1.04 },
    radius: 18,
    pillRadius: "999px",
    stroke: 2,
    ground: (p) => `radial-gradient(ellipse 80% 90% at 70% 25%, ${p.ground} 0%, ${p.groundDeep} 80%)`,
    customColors: true,
  },
  grilla: {
    id: "grilla",
    generator: "grid",
    name: "Grilla",
    description: "Fondo claro, tipografía ancha y una composición geométrica sobre grilla. Claridad y energía.",
    fonts: { display: "Archivo", body: "Archivo" },
    display: { weight: 800, transform: "uppercase", tracking: "-0.01em", stretch: "125%", leading: 0.98 },
    radius: 0,
    pillRadius: "0px",
    stroke: 3,
    ground: (p) => p.ground,
    customColors: true,
  },
  flock: {
    id: "flock",
    generator: "pieces",
    name: "Flock",
    description: "La marca institucional: Violeta 3, degradado naranja → violeta y las piezas del isotipo.",
    fonts: { display: "Bricolage Grotesque", body: "Figtree" },
    display: { weight: 800, transform: "none", tracking: "-0.025em", stretch: "100%", leading: 1 },
    radius: 20,
    pillRadius: "999px",
    stroke: 2,
    ground: (p) => `linear-gradient(160deg, ${p.ground} 30%, ${p.groundDeep} 100%)`,
    customColors: false,
  },
  organico: {
    id: "organico",
    generator: "blobs",
    name: "Orgánico",
    description: "Tonos profundos, formas suaves superpuestas y una serif con carácter. Naturaleza, aire libre, cercanía.",
    fonts: { display: "Gloock", body: "Figtree" },
    display: { weight: 400, transform: "none", tracking: "-0.01em", stretch: "100%", leading: 1.02 },
    radius: 28,
    pillRadius: "999px",
    stroke: 2,
    ground: (p) => p.ground,
    customColors: true,
    // La serif display dibuja mal números y "#": horarios, fechas y hashtag van con la fuente de cuerpo
    css: `.canvas .hashtag, .canvas .slot b, .canvas .time { font-family: var(--font-body); font-weight: 800; letter-spacing: 0; }
.canvas .slot .sep { font-family: var(--font-body); font-weight: 300; }`,
  },
  referencia: {
    id: "referencia",
    generator: "orbs",
    name: "Tu referencia",
    description: "Armado a partir de tu imagen: sus colores, el carácter de su tipografía y su tipo de formas.",
    fonts: { display: "Archivo", body: "Figtree" },
    display: { weight: 800, transform: "uppercase", tracking: "0", stretch: "100%", leading: 1.02 },
    radius: 16,
    pillRadius: "999px",
    stroke: 2,
    ground: (p) => p.ground,
    customColors: false,
  },
};

/** Estilos fijos del catálogo (el de referencia se arma por evento). */
export const STYLE_LIST = Object.values(STYLES).filter((s) => s.id !== "referencia");

// Pesos disponibles por familia (Gloock solo tiene 400)
const MAX_WEIGHT: Record<string, number> = { Gloock: 400, Unbounded: 900, Archivo: 900, "Bricolage Grotesque": 800 };

/** Estilo efectivo de un kit: el del catálogo o el derivado de la referencia. */
export function resolveStyle(kit: EventKit): StyleDef {
  const base = STYLES[kit.style.id];
  const ref = kit.style.reference;
  if (kit.style.id !== "referencia" || !ref) return base;
  return styleFromReference(ref);
}

export function styleFromReference(ref: ReferenceStyle): StyleDef {
  const t = ref.typography;
  const weight = Math.min({ regular: 400, bold: 700, black: 850 }[t.weight], MAX_WEIGHT[t.display] ?? 800);
  const radius = { sharp: 0, soft: 14, round: 28 }[ref.corners];
  return {
    ...STYLES.referencia,
    generator: ref.generator,
    fonts: { display: t.display, body: t.body },
    display: {
      weight,
      transform: t.case === "upper" ? "uppercase" : "none",
      tracking: t.case === "upper" ? "0.01em" : "-0.02em",
      // solo las familias con eje de ancho (Archivo, Bricolage) lo aplican
      stretch: { condensed: "75%", normal: "100%", extended: "125%" }[t.width],
      leading: t.case === "upper" ? 1 : 1.04,
    },
    radius,
    pillRadius: ref.corners === "sharp" ? "0px" : "999px",
    ground: (p) =>
      ref.ground === "gradient"
        ? `radial-gradient(ellipse 85% 90% at 70% 25%, ${p.ground} 0%, ${p.groundDeep} 85%)`
        : p.ground,
    // Gloock dibuja mal números y "#"
    css:
      t.display === "Gloock"
        ? `.canvas .hashtag, .canvas .slot b, .canvas .time { font-family: var(--font-body); font-weight: 800; letter-spacing: 0; }
.canvas .slot .sep { font-family: var(--font-body); font-weight: 300; }`
        : undefined,
  };
}
