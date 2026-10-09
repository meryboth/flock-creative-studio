import { fontMeta } from "./fonts.js";
import type { Devices, DisplayTreatment, EventKit, Generator, Layout, Palette, PieceOptions, ReferenceStyle, StyleId } from "./kit.js";

/** Combinación de fuentes de un estilo, con su ajuste del tratamiento de títulos. */
export type FontPair = { display: string; body: string; treatment?: Partial<DisplayTreatment> };

export type StyleDef = {
  id: StyleId;
  name: string;
  description: string;
  // Combinaciones de fuentes: la variante elige una (la primera es la de la variante 1)
  fontPairs: FontPair[];
  fonts: { display: string; body: string }; // la primera combinación
  // Tratamiento tipográfico y de componentes del estilo
  display: DisplayTreatment;
  radius: number; // radio de cajas; las pastillas usan 999px salvo que el estilo sea recto
  pillRadius: string;
  stroke: number;
  // Composiciones posibles: la variante rota entre ellas (la primera es la de la variante 1)
  layouts: Layout[];
  devices: Devices;
  // Pintura del fondo a partir de la paleta
  ground: (p: Palette) => string;
  // Si el usuario puede elegir el color semilla (Flock usa los institucionales)
  customColors: boolean;
  // Ajustes propios del estilo sobre las plantillas
  css?: string;
  generator: Generator;
};

const def = (s: Omit<StyleDef, "fonts">): StyleDef => ({ ...s, fonts: { display: s.fontPairs[0].display, body: s.fontPairs[0].body } });

/*
 * Marca y campaña van separadas: lo de Flock (logo, versiones, zona de respeto, contraste) vive en assets y
 * plantillas; lo que era propio del AI Day 2026 (esferas, Unbounded, la caja "hora | título") es un estilo
 * más ("Iridiscente · AI Day") y una composición más ("clasico"), no la base de todo.
 */
export const STYLES: Record<StyleId, StyleDef> = {
  iridiscente: def({
    id: "iridiscente",
    generator: "orbs",
    name: "Iridiscente · AI Day",
    description: "El estilo del AI Day 2026: fondo profundo con esferas de luz en los tonos del acento. Tecnología, innovación, noche.",
    fontPairs: [
      { display: "Unbounded", body: "Manrope" },
      { display: "Syne", body: "Manrope", treatment: { weight: 800, transform: "lowercase", tracking: "-0.02em", leading: 0.92 } },
      { display: "Krona One", body: "Manrope", treatment: { weight: 400, tracking: "-0.01em", leading: 1.02 } },
    ],
    display: { weight: 800, transform: "uppercase", tracking: "0.005em", stretch: "100%", leading: 1.04 },
    radius: 18,
    pillRadius: "999px",
    stroke: 2,
    layouts: ["clasico", "tipografico", "bloques"],
    devices: { pills: false, halftone: false },
    ground: (p) => `radial-gradient(ellipse 80% 90% at 70% 25%, ${p.ground} 0%, ${p.groundDeep} 80%)`,
    customColors: true,
  }),
  grilla: def({
    id: "grilla",
    generator: "grid",
    name: "Grilla",
    description: "Fondo claro, tipografía ancha y una composición geométrica sobre grilla. Claridad y energía.",
    fontPairs: [
      { display: "Archivo", body: "Archivo" },
      { display: "Archivo Black", body: "Archivo", treatment: { weight: 400, tracking: "-0.02em", stretch: "100%", leading: 0.92 } },
      { display: "Big Shoulders Display", body: "DM Sans", treatment: { weight: 800, tracking: "0", stretch: "100%", leading: 0.9 } },
    ],
    display: { weight: 800, transform: "uppercase", tracking: "-0.01em", stretch: "125%", leading: 0.98 },
    radius: 0,
    pillRadius: "0px",
    stroke: 3,
    layouts: ["bloques", "tipografico", "clasico"],
    devices: { pills: true, halftone: true },
    ground: (p) => p.ground,
    customColors: true,
  }),
  flock: def({
    id: "flock",
    generator: "pieces",
    name: "Flock",
    description: "La marca institucional: Violeta 3, degradado naranja → violeta y las piezas del isotipo.",
    fontPairs: [
      { display: "Bricolage Grotesque", body: "Figtree" },
      { display: "Familjen Grotesk", body: "Figtree", treatment: { weight: 700, tracking: "-0.035em", leading: 0.95 } },
      { display: "Epilogue", body: "DM Sans", treatment: { weight: 800, tracking: "-0.04em", leading: 0.94 } },
    ],
    display: { weight: 800, transform: "none", tracking: "-0.025em", stretch: "100%", leading: 1 },
    radius: 20,
    pillRadius: "999px",
    stroke: 2,
    layouts: ["tipografico", "bloques", "clasico"],
    devices: { pills: true, halftone: false },
    ground: (p) => `linear-gradient(160deg, ${p.ground} 30%, ${p.groundDeep} 100%)`,
    customColors: false,
  }),
  organico: def({
    id: "organico",
    generator: "blobs",
    name: "Orgánico",
    description: "Tonos profundos, formas suaves superpuestas y una serif con carácter. Naturaleza, aire libre, cercanía.",
    fontPairs: [
      { display: "Gloock", body: "Figtree" },
      { display: "Young Serif", body: "DM Sans", treatment: { weight: 400, tracking: "-0.02em", leading: 1 } },
      { display: "DM Serif Display", body: "Figtree", treatment: { weight: 400, tracking: "-0.02em", leading: 0.98 } },
    ],
    display: { weight: 400, transform: "none", tracking: "-0.01em", stretch: "100%", leading: 1.02 },
    radius: 28,
    pillRadius: "999px",
    stroke: 2,
    layouts: ["bloques", "clasico", "tipografico"],
    devices: { pills: true, halftone: false },
    ground: (p) => p.ground,
    customColors: true,
  }),
  referencia: def({
    id: "referencia",
    generator: "orbs",
    name: "Tu referencia",
    description: "Armado a partir de tu imagen: sus colores, el carácter de su tipografía, su composición y sus recursos gráficos.",
    fontPairs: [{ display: "Archivo", body: "Figtree" }],
    display: { weight: 800, transform: "uppercase", tracking: "0", stretch: "100%", leading: 1.02 },
    radius: 16,
    pillRadius: "999px",
    stroke: 2,
    layouts: ["tipografico", "bloques", "clasico"],
    devices: { pills: false, halftone: false },
    ground: (p) => p.ground,
    customColors: false,
  }),
};

/** Estilos fijos del catálogo (el de referencia se arma por evento). */
// La marca primero; el estilo del AI Day queda como una opción más, al final
export const STYLE_LIST = [STYLES.flock, STYLES.grilla, STYLES.organico, STYLES.iridiscente];

/** Elemento de una lista según la variante (la variante 1 es el primero). */
export const byVariant = <T>(list: T[], seed: number) => list[(((seed - 1) % list.length) + list.length) % list.length];

/** Estilo efectivo de un kit: el del catálogo o el derivado de la referencia. */
export function resolveStyle(kit: EventKit): StyleDef {
  const base = STYLES[kit.style.id];
  const ref = kit.style.reference;
  if (kit.style.id !== "referencia" || !ref) return base;
  return styleFromReference(ref);
}

/** Composición de una pieza: la pedida en el editor o la del kit. */
export function layoutOf(kit: EventKit, options?: PieceOptions): Layout {
  return options?.layout ?? kit.style.layout ?? "clasico";
}

export function styleFromReference(ref: ReferenceStyle): StyleDef {
  const t = ref.typography;
  const meta = fontMeta(t.display);
  const weight = Math.min({ regular: 400, bold: 700, black: 850 }[t.weight], meta?.maxWeight ?? 800);
  const radius = { sharp: 0, soft: 14, round: 28 }[ref.corners];
  // La composición leída va primero; "otra variante" prueba las demás
  // (el clásico, que es el del AI Day, queda último)
  const order: Layout[] = ["tipografico", "bloques", "clasico"];
  const layouts = ref.layout ? [ref.layout, ...order.filter((l) => l !== ref.layout)] : STYLES.referencia.layouts;
  return {
    ...STYLES.referencia,
    generator: ref.generator,
    fontPairs: [{ display: t.display, body: t.body }],
    fonts: { display: t.display, body: t.body },
    display: {
      weight,
      transform: t.case === "upper" ? "uppercase" : t.case === "lower" ? "lowercase" : "none",
      tracking: t.case === "upper" ? "0.01em" : "-0.03em",
      // solo las familias con eje de ancho (Archivo, Bricolage) lo aplican
      stretch: { condensed: "75%", normal: "100%", extended: "125%" }[t.width],
      leading: t.case === "upper" ? 1 : 0.98,
    },
    radius,
    pillRadius: ref.corners === "sharp" ? "0px" : "999px",
    layouts,
    devices: ref.devices ?? STYLES.referencia.devices,
    ground: (p) => {
      const base =
        ref.ground === "gradient" ? `radial-gradient(ellipse 85% 90% at 70% 25%, ${p.ground} 0%, ${p.groundDeep} 85%)` : p.ground;
      return texture(ref.texture ?? "none", p.ink) + base;
    },
  };
}

/** Capas de textura (cuadrícula, puntos, renglones) que van delante del fondo, terminadas en coma. */
function texture(kind: NonNullable<ReferenceStyle["texture"]>, ink: string) {
  const line = `color-mix(in srgb, ${ink} 12%, transparent)`;
  switch (kind) {
    case "grid":
      return `linear-gradient(${line} 1.5px, transparent 1.5px) 0 0 / 40px 40px, linear-gradient(90deg, ${line} 1.5px, transparent 1.5px) 0 0 / 40px 40px, `;
    case "dots":
      return `radial-gradient(circle, ${line.replace("12%", "30%")} 2px, transparent 2.5px) 0 0 / 32px 32px, `;
    case "lines":
      return `linear-gradient(transparent 38px, ${line} 40px) 0 0 / 100% 40px, `;
    default:
      return "";
  }
}
