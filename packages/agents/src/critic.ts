import { HumanMessage } from "@langchain/core/messages";
import { BODY_FONTS, contrast, DISPLAY_FONTS, fontMeta, LAYOUTS, type ReferenceStyle } from "@flock/templates";
import sharp from "sharp";
import { z } from "zod";
import { invokeStructured } from "./llm";

const HEX = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const score = () => z.number();

const CritiqueSchema = z.object({
  scores: z.object({
    typography: score().describe("¿La letra de la pieza tiene el carácter de la de la referencia? (ancho, peso, serif, caja)"),
    color: score().describe("¿La paleta y su uso (fondo, acentos, bloques) se parecen a la referencia?"),
    composition: score().describe("¿La composición, la escala y los recursos gráficos se parecen a la referencia?"),
    illustration: score().describe("¿El visual (formas, ilustración, textura) está en la técnica de la referencia?"),
  }),
  closerToAntiReference: z.boolean().describe("true si la pieza se parece más a la imagen ANTI-REFERENCIA que a la referencia"),
  notes: z.string().describe("En español, 1 o 2 oraciones: qué es lo que más aleja la pieza de la referencia"),
  // Lista de pares campo → valor: un objeto con muchos campos opcionales es "demasiado complejo" para la
  // salida estructurada de Claude. Lo que no pertenece al catálogo se descarta en applyCritique.
  changes: z
    .array(
      z.object({
        field: z
          .string()
          .describe("layout | display | body | case | weight | width | generator | texture | corners | pills | halftone | ground | ink | accent | accent2"),
        value: z.string().describe("El valor nuevo (para pills y halftone: true o false; para colores: HEX)"),
      }),
    )
    .describe("Solo los cambios que acercarían la pieza a la referencia; vacío si ya está bien"),
});

export type Critique = z.infer<typeof CritiqueSchema> & { overall: number; model: string };

const toJpeg = async (input: string | Buffer, size = 900) =>
  `data:image/jpeg;base64,${(await sharp(input).resize(size, size, { fit: "inside" }).flatten({ background: "#ffffff" }).jpeg({ quality: 80 }).toBuffer()).toString("base64")}`;

/**
 * Crítico de fidelidad: compara una pieza generada con la referencia (y con una anti-referencia,
 * el estilo del AI Day del que el sistema tiende a no salir) y propone cambios sobre el estilo leído.
 */
export async function critiquePiece(opts: { references: string[]; piece: Buffer; antiReference?: Buffer; style: ReferenceStyle }): Promise<Critique> {
  const refs = await Promise.all(opts.references.slice(0, 2).map((f) => toJpeg(f)));
  const images = [...refs, await toJpeg(opts.piece), ...(opts.antiReference ? [await toJpeg(opts.antiReference)] : [])];
  const s = opts.style;
  const text = `Sos director de arte y revisás la fidelidad de una pieza generada por código respecto de una referencia de estilo.

Imágenes, en este orden:
${refs.map((_, i) => `${i + 1}. REFERENCIA${refs.length > 1 ? ` ${i + 1}` : ""}: el estilo a lograr.`).join("\n")}
${refs.length + 1}. PIEZA generada (un posteo de LinkedIn de un evento de Flock; el logo de Flock es obligatorio y no se evalúa).
${opts.antiReference ? `${refs.length + 2}. ANTI-REFERENCIA: el estilo del AI Day 2026, del que el sistema tiende a no salir. La pieza NO debería parecerse a esta.` : ""}

Cómo se armó la pieza (lo que podés cambiar):
- composición: ${s.layout ?? "clasico"} (opciones: tipografico = tipografía gigante de borde a borde con el visual superpuesto; bloques = planos de color grandes con el texto adentro; clasico = logo arriba, título abajo, visual en la esquina)
- títulos: ${s.typography.display} (${fontMeta(s.typography.display)?.character ?? ""}), caja ${s.typography.case}, peso ${s.typography.weight}, ancho ${s.typography.width}
- texto: ${s.typography.body}
- visual: ${s.generator}${s.motifs?.length ? ` (${s.motifs.join(", ")})` : ""}, textura ${s.texture ?? "none"}, esquinas ${s.corners}
- píldoras de color: ${s.devices?.pills ? "sí" : "no"}; semitono: ${s.devices?.halftone ? "sí" : "no"}
- colores: fondo ${s.colors.ground}, texto ${s.colors.ink}, acento ${s.colors.accent}, acento 2 ${s.colors.accent2}

Fuentes disponibles para títulos (elegí por carácter): ${DISPLAY_FONTS.map((f) => `${f} (${fontMeta(f)!.character})`).join("; ")}.

Puntuá de 0 a 10 cada aspecto y proponé SOLO los cambios que acerquen la pieza a la referencia. No copies personajes, logos ni textos de la referencia: se trata del estilo.`;
  const message = new HumanMessage({ content: [{ type: "text", text }, ...images.map((url) => ({ type: "image_url" as const, image_url: url }))] });
  const { out, model } = await invokeStructured("vision", CritiqueSchema, [message], { name: "critique", temperature: 0.1, timeoutMs: Number(process.env.CRITIC_TIMEOUT_MS ?? 90_000) });
  const clamp = (n: number) => Math.max(0, Math.min(10, n));
  const v = { typography: clamp(out.scores.typography), color: clamp(out.scores.color), composition: clamp(out.scores.composition), illustration: clamp(out.scores.illustration) };
  const overall = Math.round(((v.typography + v.color + v.composition * 1.5 + v.illustration) / 4.5) * 10) / 10;
  return { ...out, overall: out.closerToAntiReference ? Math.min(overall, 4) : overall, model };
}

/** Aplica los cambios propuestos por el crítico a un estilo leído. */
export function applyCritique(style: ReferenceStyle, list: Critique["changes"]): ReferenceStyle {
  const raw: Record<string, string | undefined> = Object.fromEntries(list.map((c) => [c.field.trim(), c.value.trim()]));
  const bool = (v?: string) => (v === "true" ? true : v === "false" ? false : undefined);
  // Solo valores del catálogo: el crítico propone, el código valida
  const oneOf = <T extends string>(v: string | undefined, options: readonly T[]) => (options as readonly string[]).includes(v ?? "") ? (v as T) : undefined;
  const hex = (v?: string) => (v && HEX.safeParse(v).success ? v : undefined);
  const c = {
    layout: oneOf(raw.layout, LAYOUTS),
    display: oneOf(raw.display, DISPLAY_FONTS),
    body: oneOf(raw.body, BODY_FONTS),
    case: oneOf(raw.case, ["upper", "title", "lower"] as const),
    weight: oneOf(raw.weight, ["regular", "bold", "black"] as const),
    width: oneOf(raw.width, ["condensed", "normal", "extended"] as const),
    generator: oneOf(raw.generator, ["orbs", "grid", "pieces", "blobs", "pixel", "doodle"] as const),
    texture: oneOf(raw.texture, ["none", "grid", "dots", "lines"] as const),
    corners: oneOf(raw.corners, ["sharp", "soft", "round"] as const),
    ground: hex(raw.ground),
    ink: hex(raw.ink),
    accent: hex(raw.accent),
    accent2: hex(raw.accent2),
  };
  const ground = c.ground ?? style.colors.ground;
  return {
    ...style,
    // un fondo nuevo puede cambiar el esquema (y con él el logo y el contraste)
    scheme: contrast(ground, "#000000") > contrast(ground, "#ffffff") ? "light" : "dark",
    layout: c.layout ?? style.layout,
    typography: {
      ...style.typography,
      ...(c.display && { display: c.display }),
      ...(c.body && { body: c.body }),
      ...(c.case && { case: c.case }),
      ...(c.weight && { weight: c.weight }),
      ...(c.width && { width: c.width }),
    },
    generator: c.generator ?? style.generator,
    texture: c.texture ?? style.texture,
    corners: c.corners ?? style.corners,
    devices: { pills: bool(raw.pills) ?? style.devices?.pills ?? false, halftone: bool(raw.halftone) ?? style.devices?.halftone ?? false },
    colors: {
      ...style.colors,
      ...(c.ground && { ground: c.ground }),
      ...(c.ink && { ink: c.ink }),
      ...(c.accent && { accent: c.accent }),
      ...(c.accent2 && { accent2: c.accent2 }),
    },
  };
}
