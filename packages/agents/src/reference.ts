import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import type { ReferenceStyle } from "@flock/templates";
import sharp from "sharp";
import { z } from "zod";
import { analyzeMoodboard } from "./moodboard";

const HEX = z.string().regex(/^#[0-9a-fA-F]{6}$/);

// Catálogo cerrado: el modelo elige, no inventa
const DISPLAY_FONTS = [
  "Unbounded",
  "Archivo",
  "Bricolage Grotesque",
  "Gloock",
  "Pixelify Sans",
  "Silkscreen",
  "Caveat",
  "Bebas Neue",
  "Instrument Serif",
  "JetBrains Mono",
] as const;
const BODY_FONTS = ["Manrope", "Figtree", "Archivo", "JetBrains Mono"] as const;
const MOTIFS = ["flower", "cloud", "heart", "star", "sparkle", "squiggle"] as const;
const MEDIUMS = ["3d-render", "pixel-art", "flat-vector", "hand-drawn", "photo", "abstract-gradient"] as const;

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
    display: z.enum(DISPLAY_FONTS),
    body: z.enum(BODY_FONTS),
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
  keyVisualPrompt: z
    .string()
    .describe(
      "En inglés, empezando por la técnica (ej. 'pixel art of …', '3D render of …', 'flat vector illustration of …'): UN sujeto ORIGINAL, simple y fácil de leer (un objeto o personaje), que encaje con el clima de la referencia y con un evento de tecnología. No describas el fondo. No copies personajes, mascotas ni logos de la referencia. Sin texto.",
    ),
});

export type ReferenceAnalysis = {
  style: ReferenceStyle;
  keyVisualPrompt: string;
  medium: (typeof MEDIUMS)[number];
  model: string;
  extractedColors: string[];
};

const PROMPT = (swatches: string[], background: string) => `Sos director de arte. Esta imagen es una REFERENCIA de estilo para las piezas gráficas de un evento interno de una empresa de tecnología (posteos, cronograma, credenciales, landing).

Analizala y traducí su estilo a nuestro sistema, eligiendo SOLO entre estas opciones:

Tipografía display (títulos), elegí la que mejor reproduzca la letra de la referencia:
- "Unbounded": geométrica muy ancha y redonda, tecnológica, impacto.
- "Archivo": grotesca neutra con eje de ancho (condensada, normal o extendida), editorial, suiza.
- "Bricolage Grotesque": grotesca con carácter y algo de irregularidad, cercana, contemporánea.
- "Gloock": serif display de alto contraste, elegante, editorial, cálida.
- "Instrument Serif": serif editorial fina y condensada, moderna.
- "Pixelify Sans": pixel / 8-bit redondeada, videojuego, retro digital.
- "Silkscreen": pixel / bitmap muy marcada, ancha, en mayúsculas, retro computadora.
- "Bebas Neue": condensada de afiche, alta y en mayúsculas.
- "Caveat": manuscrita, informal, notas a mano.
- "JetBrains Mono": monoespaciada, código, terminal.
Tipografía de texto: "Manrope" (neutra técnica), "Figtree" (amable), "Archivo" (neutra) o "JetBrains Mono" (código, retro digital).

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
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY no configurada");
  const models = (process.env.GEMINI_VISION_MODELS ?? "gemini-3.5-flash,gemini-3.1-flash-lite").split(",").map((m) => m.trim()).filter(Boolean);

  const measured = await analyzeMoodboard(files);
  // Imágenes livianas: el modelo no necesita más de 1024 px para leer un estilo
  const images = await Promise.all(
    files.slice(0, 4).map(async (f) => `data:image/jpeg;base64,${(await sharp(f).resize(1024, 1024, { fit: "inside" }).jpeg({ quality: 82 }).toBuffer()).toString("base64")}`),
  );
  const message = new HumanMessage({
    content: [{ type: "text", text: PROMPT(measured.colors, measured.background) }, ...images.map((url) => ({ type: "image_url" as const, image_url: url }))],
  });

  const errors: string[] = [];
  for (const model of models) {
    try {
      // Temperatura baja: la misma referencia tiene que dar (casi) la misma lectura
      const llm = new ChatGoogleGenerativeAI({ model, apiKey, temperature: 0.15, maxRetries: 1 });
      const out = await llm.withStructuredOutput(ReferenceSchema, { name: "reference_style" }).invoke([message], { signal: AbortSignal.timeout(60_000) });
      const { keyVisualPrompt, medium, ...style } = out;
      return { style, keyVisualPrompt, medium, model, extractedColors: measured.colors };
    } catch (err) {
      errors.push(`${model}: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
    }
  }
  throw new Error(`No se pudo analizar la referencia (${errors.join(" | ")})`);
}
