import { FONT_CATALOG, LAYOUTS } from "@flock/templates";
import { z } from "zod";
import { invokeStructured } from "./llm";
import { loadPrompt } from "./prompts";

const HEX = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const FONTS = Object.keys(FONT_CATALOG) as [string, ...string[]];

const Operation = z.object({
  op: z.enum([
    "setColor", // role + value (hex)
    "setFont", // role (display | body) + value (familia)
    "setCase", // value: upper | title | lower
    "setWeight", // number 300–900
    "setTitleScale", // number: 0.6–1.6 (1 = actual)
    "setVisualScale", // number: 0.4–1.8 (1 = actual)
    "hide", // element
    "show", // element
    "setCopy", // field + text (solo posteos de LinkedIn y mensajes de Slack)
    "setLayout", // value: clasico | tipografico | bloques
    "setDevice", // value: pills | halftone; number 1 (activar) o 0 (desactivar)
    "newVariant", // otra composición del visual
    "regenerateKeyVisual", // prompt (en inglés)
  ]),
  role: z.enum(["ground", "ink", "accent", "accent2", "muted", "display", "body"]).optional(),
  value: z.string().optional(),
  number: z.number().optional(),
  element: z.enum(["hashtag", "tagline", "date", "visual"]).optional(),
  field: z.enum(["headline", "body"]).optional(),
  text: z.string().optional(),
  prompt: z.string().optional(),
});

const ChangeSetSchema = z.object({
  reply: z.string().describe("Respuesta breve en español rioplatense: qué vas a cambiar, o por qué no se puede"),
  operations: z.array(Operation),
  scope: z.enum(["all", "group", "piece"]).describe("Alcance sugerido"),
});

export type EditOperation = z.infer<typeof Operation>;
export type ChangeSetProposal = z.infer<typeof ChangeSetSchema> & { model: string };

export type EditContext = {
  message: string;
  event: { name: string; style: string };
  palette: Record<string, string>;
  fonts: { display: string; body: string };
  layout?: string;
  piece: { file: string; label: string; group: string; headline?: string; body?: string } | null;
  canRegenerateGraphics: boolean;
};

/** Traduce un pedido en lenguaje natural a operaciones sobre las piezas (vocabulario cerrado). */
export async function interpretEdit(ctx: EditContext): Promise<ChangeSetProposal> {
  try {
    const { out, model } = await invokeStructured("text", ChangeSetSchema, prompt(ctx), { name: "change_set", temperature: 0.2, timeoutMs: 45_000, prompt: PROMPT() });
    return { ...out, operations: out.operations.filter(valid), model };
  } catch (err) {
    throw new Error(`No se pudo interpretar el pedido (${err instanceof Error ? err.message : String(err)})`);
  }
}

// Descarta operaciones incompletas o fuera de rango (el modelo propone, el código valida)
function valid(o: EditOperation) {
  switch (o.op) {
    case "setColor":
      return Boolean(o.role && ["ground", "ink", "accent", "accent2", "muted"].includes(o.role) && HEX.safeParse(o.value).success);
    case "setFont":
      return Boolean(o.role && ["display", "body"].includes(o.role) && o.value && FONTS.includes(o.value));
    case "setCase":
      return ["upper", "title", "lower"].includes(o.value ?? "");
    case "setWeight":
      return typeof o.number === "number" && o.number >= 300 && o.number <= 900;
    case "setTitleScale":
      return typeof o.number === "number" && o.number >= 0.5 && o.number <= 1.8;
    case "setVisualScale":
      return typeof o.number === "number" && o.number >= 0.3 && o.number <= 2;
    case "hide":
    case "show":
      return Boolean(o.element);
    case "setCopy":
      return Boolean(o.field && o.text?.trim());
    case "regenerateKeyVisual":
      return Boolean(o.prompt?.trim());
    case "setLayout":
      return (LAYOUTS as string[]).includes(o.value ?? "");
    case "setDevice":
      return ["pills", "halftone"].includes(o.value ?? "") && (o.number === 0 || o.number === 1);
    default:
      return true;
  }
}

const PROMPT = () => loadPrompt("editor");

function prompt(c: EditContext) {
  return PROMPT().render({
    eventName: c.event.name,
    style: c.event.style,
    palette: Object.entries(c.palette)
      .map(([k, v]) => `${k} ${v}`)
      .join(", "),
    displayFont: c.fonts.display,
    bodyFont: c.fonts.body,
    layout: c.layout ?? "clasico",
    piece: c.piece
      ? `${c.piece.label} (${c.piece.group}, ${c.piece.file})${c.piece.headline ? `; titular: "${c.piece.headline}"; bajada: "${c.piece.body ?? ""}"` : ""}`
      : "ninguna (el cambio es general)",
    fonts: FONTS.map((f) => `  - ${f}: ${FONT_CATALOG[f].meta.character}`).join("\n"),
    keyVisualAvailability: c.canRegenerateGraphics ? "Disponible." : "NO disponible para este estilo: decilo si lo piden.",
    message: c.message,
  });
}
