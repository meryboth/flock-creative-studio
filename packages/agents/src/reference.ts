import { HumanMessage } from "@langchain/core/messages";
import { BODY_FONTS, DISPLAY_FONTS, fontMeta, LAYOUTS, type ReferenceStyle } from "@flock/templates";
import sharp from "sharp";
import { z } from "zod";
import { converter } from "culori";
import { invokeStructured } from "./llm";
import { analyzeMoodboard } from "./moodboard";

const toOklch = converter("oklch");

const HEX = z.string().regex(/^#[0-9a-fA-F]{6}$/);

// Catálogo cerrado: el modelo elige, no inventa (las fichas de las fuentes salen de @flock/templates)
const MOTIFS = ["flower", "cloud", "heart", "star", "sparkle", "squiggle"] as const;
const MEDIUMS = ["3d-render", "pixel-art", "flat-vector", "hand-drawn", "line-art-halftone", "risograph", "collage", "photo", "abstract-gradient"] as const;

const ReferenceSchema = z.object({
  description: z.string().describe("Qué se ve en la referencia y qué la hace reconocible, en 1 o 2 oraciones en español"),
  mood: z.array(z.string()).min(2).max(5).describe("Palabras de clima o tono en español, ej. 'tecnológico', 'cálido'"),
  scheme: z.enum(["dark", "light"]).describe("Si el fondo predominante es oscuro o claro"),
  colors: z.object({
    ground: HEX.describe("Color de fondo predominante"),
    ink: HEX.describe("Color para el texto principal sobre ese fondo"),
    accent: HEX.describe("Color de acento más característico"),
    accent2: HEX.describe("Segundo color de acento"),
    shapes: z.array(HEX).min(2).max(4).describe("Colores para las formas o el visual"),
  }),
  typography: z.object({
    display: z.enum(DISPLAY_FONTS as [string, ...string[]]),
    body: z.enum(BODY_FONTS as [string, ...string[]]),
    case: z.enum(["upper", "title", "lower"]),
    weight: z.enum(["regular", "bold", "black"]),
    width: z.enum(["condensed", "normal", "extended"]),
  }),
  generator: z.enum(["orbs", "grid", "pieces", "blobs", "pixel", "doodle"]),
  motifs: z.array(z.enum(MOTIFS)).max(4).describe("Motivos que aparecen o encajan con la referencia (solo para pixel o doodle)"),
  texture: z.enum(["none", "grid", "dots", "lines"]).describe("Textura del fondo: cuadrícula, puntos, renglones o liso"),
  corners: z.enum(["sharp", "soft", "round"]),
  ground: z.enum(["flat", "gradient"]),
  medium: z.enum(MEDIUMS).describe("Técnica visual dominante de la referencia"),
  layout: z.enum(LAYOUTS as [string, ...string[]]).describe("Composición que mejor reproduce la referencia"),
  devices: z.object({
    pills: z.boolean().describe("true si usa etiquetas o píldoras de color rellenas"),
    halftone: z.boolean().describe("true si usa tramas de puntos (semitono) en formas o ilustraciones"),
  }),
  elements: z
    .array(z.string())
    .min(3)
    .max(4)
    .describe(
      "En inglés: 3 o 4 elementos decorativos chicos y simples que aparecen o encajan con la referencia (ej. 'pixel art flower with outlined petals', 'pixel art cloud', 'pixel art heart'). Objetos genéricos: nunca personajes, mascotas ni logos de la referencia, sin texto.",
    ),
  keyVisualPrompt: z
    .string()
    .describe(
      "En inglés, empezando por la técnica (ej. 'pixel art of …', '3D render of …', 'flat vector illustration of …'): UN sujeto ORIGINAL, simple y fácil de leer (un objeto o personaje), que encaje con el clima de la referencia y con un evento de tecnología. No describas el fondo. Tiene que ser de un TIPO distinto a cualquier personaje o mascota de la referencia (si hay un dinosaurio, no elijas un dinosaurio ni otro reptil). Sin texto ni logos.",
    ),
});

export type ReferenceAnalysis = {
  style: ReferenceStyle;
  keyVisualPrompt: string;
  elements: string[]; // sujetos de los elementos decorativos (para generarlos con IA)
  medium: (typeof MEDIUMS)[number];
  model: string;
  extractedColors: string[];
};

const PROMPT = (swatches: string[], background: string) => `Sos director de arte. Esta imagen es una REFERENCIA de estilo para las piezas gráficas de un evento interno de una empresa de tecnología (posteos, cronograma, credenciales, landing).

Analizala y traducí su estilo a nuestro sistema, eligiendo SOLO entre estas opciones:

Tipografía display (títulos): elegí por CARÁCTER la que mejor reproduzca la letra de la referencia (fijate si es extendida, condensada, serif, redonda, negra…):
${DISPLAY_FONTS.map((f) => `- "${f}": ${fontMeta(f)!.character}.`).join("\n")}
Tipografía de texto: ${BODY_FONTS.map((f) => `"${f}" (${fontMeta(f)!.character})`).join(", ")}.
Caja: si los títulos de la referencia están en minúscula, elegí "lower"; no los pases a mayúsculas.

Composición (layout), lo más importante para que las piezas se parezcan a la referencia:
- "tipografico": la tipografía es la imagen; palabras o números gigantes que ocupan el ancho, objetos superpuestos a las letras, contraste de escala fuerte.
- "bloques": planos de color grandes (paneles, tarjetas, esquinas redondeadas) que organizan la pieza; el texto vive dentro de los bloques.
- "clasico": composición tranquila; logo arriba, título abajo y un visual en la esquina sobre fondo oscuro con brillo.
Recursos gráficos (devices): indicá si usa píldoras o etiquetas rellenas y si usa tramas de puntos (semitono).

Visual de las piezas (generator):
- "orbs": esferas de luz desenfocadas, brillo, profundidad (estéticas oscuras, glow, 3D iridiscente, gradientes).
- "grid": formas geométricas planas sobre grilla (Bauhaus, suizo, constructivista, bloques de color).
- "blobs": formas orgánicas suaves superpuestas (naturaleza, ilustración plana, cercanía).
- "pieces": formas lineales con degradado, contornos (solo si la referencia usa trazos o contornos).
- "pixel": motivos en pixel art (flores, nubes, corazones, estrellas) — estéticas 8-bit, retro, videojuego.
- "doodle": motivos dibujados a mano con trazo (flores, estrellas, garabatos) — estéticas lúdicas, de cuaderno, ilustración a mano.
Si usás "pixel" o "doodle", elegí hasta 4 motivos: flower, cloud, heart, star, sparkle, squiggle.

Fondo: indicá si tiene textura (cuadrícula "grid", puntos "dots", renglones "lines" o liso "none").

Colores medidos por código en la imagen (son exactos):
- Color que más superficie ocupa, casi seguro el fondo: ${background}
- Colores característicos: ${swatches.join(", ")}
Usá ${background} como ground salvo que la imagen claramente tenga otro fondo. Para ink usá el color real de los títulos de la referencia (si son negros, #111111; si son blancos, #ffffff) y que se lea bien sobre el fondo.

Indicá también si las esquinas son rectas, suaves o redondas, si el fondo es plano o con degradado, y escribí en inglés un prompt para generar un visual abstracto original inspirado en la referencia (materiales, luz, formas, paleta), sin texto, sin letras y sin logos.`;

/** Lee una o más imágenes de referencia y las traduce a un estilo del sistema. */
export async function analyzeReference(files: string[]): Promise<ReferenceAnalysis> {
  const measured = await analyzeMoodboard(files);
  // Imágenes livianas: el modelo no necesita más de 1024 px para leer un estilo
  const images = await Promise.all(
    files.slice(0, 4).map(async (f) => `data:image/jpeg;base64,${(await sharp(f).resize(1024, 1024, { fit: "inside" }).jpeg({ quality: 82 }).toBuffer()).toString("base64")}`),
  );
  const message = new HumanMessage({
    content: [{ type: "text", text: PROMPT(measured.colors, measured.background) }, ...images.map((url) => ({ type: "image_url" as const, image_url: url }))],
  });

  try {
    // Temperatura baja: la misma referencia tiene que dar (casi) la misma lectura
    const { out, model } = await invokeStructured("vision", ReferenceSchema, [message], { name: "reference_style", temperature: 0.15, timeoutMs: 60_000 });
    const { keyVisualPrompt, medium, elements, ...rest } = out;
    const style = rest as ReferenceStyle;
    // Un texto muy oscuro y casi sin color es negro en la referencia (el extractor lo confunde con sombras)
    const ink = toOklch(style.colors.ink);
    if (ink && ink.l < 0.42 && (ink.c ?? 0) < 0.07) style.colors.ink = "#111111";
    return { style, keyVisualPrompt, medium, elements, model, extractedColors: measured.colors };
  } catch (err) {
    throw new Error(`No se pudo analizar la referencia (${err instanceof Error ? err.message : String(err)})`);
  }
}
