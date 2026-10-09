import { HumanMessage } from "@langchain/core/messages";
import { BODY_FONTS, DISPLAY_FONTS, fontMeta, PIECE_SPECS, type DesignedPieceId, type DesignedTemplate, type ReferenceStyle } from "@flock/templates";
import sharp from "sharp";
import { z } from "zod";
import { invokeStructured } from "./llm";
import { loadPrompt } from "./prompts";

/**
 * Agente diseñador: mira la referencia y escribe la plantilla (HTML/CSS) de un tipo de pieza con reglas
 * fijas. El código la sanea, la valida y la completa con los datos (packages/templates/designed.ts).
 * El revisor compara el render con la referencia y le devuelve correcciones concretas.
 */

const DesignSchema = z.object({
  display: z.string().describe("Fuente de títulos, una del catálogo"),
  body: z.string().describe("Fuente de texto, una del catálogo"),
  notes: z.string().describe("En español, 2 o 3 oraciones: qué tomaste de la referencia y cómo lo resolviste"),
  css: z.string(),
  html: z.string(),
  rowHtml: z.string().describe("Solo para el cronograma completo: la plantilla de una fila. Vacío en las demás piezas"),
});

const ReviewSchema = z.object({
  fidelity: z.number(),
  quality: z.number(),
  copied: z.boolean(),
  fixes: z.array(z.string()),
});

export type DesignReview = z.infer<typeof ReviewSchema> & { score: number; model: string };

const toJpeg = async (input: string | Buffer, size = 1100) =>
  `data:image/jpeg;base64,${(await sharp(input).resize(size, size, { fit: "inside" }).flatten({ background: "#ffffff" }).jpeg({ quality: 82 }).toBuffer()).toString("base64")}`;

const readingSummary = (r?: ReferenceStyle) =>
  r
    ? `${r.description} Colores medidos: fondo ${r.colors.ground}, texto ${r.colors.ink}, acentos ${r.colors.accent} y ${r.colors.accent2}. Composición leída: ${r.layout ?? "?"}. Letra leída: ${r.typography.display} (${fontMeta(r.typography.display)?.character ?? ""}).`
    : "(sin lectura previa)";

/** Diseña (o revisa, si viene `previous` con `feedback`) la plantilla de una pieza. */
export async function designTemplate(opts: {
  references: string[];
  piece: DesignedPieceId;
  reading?: ReferenceStyle;
  previous?: DesignedTemplate;
  feedback?: string[];
  instruction?: string; // pedido de la persona desde el chat ("que el nombre sea más grande y en una tarjeta negra")
  alternative?: boolean; // segunda propuesta: una composición distinta de la más obvia
}): Promise<DesignedTemplate> {
  const spec = PIECE_SPECS[opts.piece];
  const prompt = loadPrompt("designer");
  const slotLine = (s: (typeof spec.slots)[number]) => `- {{${s.name}}}: ${s.description}${s.required ? "" : " (opcional, puede venir vacío)"}. Ej.: "${s.sample}"; el más largo: "${s.stress}".`;
  const revision =
    opts.previous && (opts.feedback?.length || opts.instruction)
      ? `
REVISIÓN de una versión anterior (abajo). Mantené lo que funciona y corregí lo que sigue. Devolvé la plantilla COMPLETA (todo el html y todo el css, con TODAS las variables), no solo lo que cambia:
${[...(opts.instruction ? [`Pedido de la persona: ${opts.instruction}`] : []), ...(opts.feedback ?? [])].map((f) => `- ${f}`).join("\n")}

Versión anterior — html:
${opts.previous.html}
${opts.previous.rowHtml ? `\nrowHtml:\n${opts.previous.rowHtml}\n` : ""}
css:
${opts.previous.css}`
      : opts.alternative
        ? "\nPROPUESTA ALTERNATIVA: ya hay otra versión con la composición más obvia. Proponé una composición distinta (otra distribución, otra escala, otro recurso protagonista), igual de fiel al estilo de la referencia."
        : "";
  const text = prompt.render({
    pieceLabel: spec.label,
    width: spec.size.width,
    height: spec.size.height,
    brief: spec.brief,
    reading: readingSummary(opts.reading),
    slots: spec.slots.filter((s) => s.name !== "ROWS").map(slotLine).join("\n"),
    rowRules: spec.rowSlots
      ? `\nFilas: en "html" poné {{ROWS}} donde van las filas, y en "rowHtml" la plantilla de UNA fila con estas variables:\n${spec.rowSlots.map(slotLine).join("\n")}\n`
      : "",
    displayFonts: DISPLAY_FONTS.map((f) => `${f} (${fontMeta(f)!.character})`).join("; "),
    bodyFonts: BODY_FONTS.join(", "),
    revision,
    minSizes: Object.entries(spec.minSize)
      .map(([sel, px]) => `${sel} mide al menos ${px}px aun con el texto más largo (se mide en el render)`)
      .join("; "),
  });
  const images = await Promise.all(opts.references.slice(0, 2).map((f) => toJpeg(f)));
  const message = new HumanMessage({ content: [{ type: "text", text }, ...images.map((url) => ({ type: "image_url" as const, image_url: url }))] });
  const { out, model } = await invokeStructured("vision", DesignSchema, [message], {
    name: "template_design",
    temperature: 0.4,
    timeoutMs: 300_000,
    maxTokens: 24_000,
    prompt,
  });
  return {
    piece: opts.piece,
    display: out.display.trim(),
    body: out.body.trim(),
    css: out.css,
    html: out.html,
    ...(spec.rowSlots ? { rowHtml: out.rowHtml } : {}),
    notes: out.notes,
    model,
    prompt: { id: prompt.id, version: prompt.version },
  };
}

/** Revisa el render de una plantilla contra la referencia. */
export async function reviewDesign(opts: { references: string[]; piece: DesignedPieceId; render: Buffer; qa: string[] }): Promise<DesignReview> {
  const prompt = loadPrompt("design-review");
  const text = prompt.render({
    pieceLabel: PIECE_SPECS[opts.piece].label,
    brief: PIECE_SPECS[opts.piece].brief,
    qa: opts.qa.length ? opts.qa.map((q) => `- ${q}`).join("\n") : "- ninguno",
  });
  const images = [await toJpeg(opts.references[0]), await toJpeg(opts.render)];
  const message = new HumanMessage({ content: [{ type: "text", text }, ...images.map((url) => ({ type: "image_url" as const, image_url: url }))] });
  const { out, model } = await invokeStructured("vision", ReviewSchema, [message], { name: "design_review", temperature: 0.1, timeoutMs: 90_000, prompt });
  const clamp = (n: number) => Math.max(0, Math.min(10, n));
  // Copiar contenido de la referencia invalida la pieza aunque se parezca mucho
  const score = out.copied ? Math.min(4, (clamp(out.fidelity) + clamp(out.quality)) / 2) : (clamp(out.fidelity) + clamp(out.quality)) / 2;
  return { ...out, score: Math.round(score * 10) / 10, model };
}
