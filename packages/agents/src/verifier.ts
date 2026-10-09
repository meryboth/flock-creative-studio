import { HumanMessage } from "@langchain/core/messages";
import sharp from "sharp";
import { z } from "zod";
import { invokeStructured } from "./llm";
import { loadPrompt } from "./prompts";

/** Un dato que la pieza tiene que mostrar completo y sin errores. */
export type ExpectedField = { field: string; value: string };

const ReadingSchema = z.object({
  fields: z.array(
    z.object({
      field: z.string(),
      status: z.string().describe("ok | cortado | falta | distinto"),
      read: z.string().describe("Lo que se lee en la imagen para ese dato, textual (vacío si no está)"),
    }),
  ),
});

export type FieldCheck = { field: string; expected: string; status: "ok" | "cortado" | "falta" | "distinto"; read: string };
export type ReadingCheck = { ok: boolean; fields: FieldCheck[]; model: string };

const STATUSES = ["ok", "cortado", "falta", "distinto"] as const;

// Comparación tolerante: mayúsculas, tildes y espacios no cuentan (la tipografía puede estar en caja alta)
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Cruza lo que leyó el modelo con lo esperado, sin confiar ciegamente en su "status":
 * si leyó el valor completo es ok; si leyó solo el principio ("19:0" de "19:00"), está cortado.
 */
export function reconcileFields(expected: ExpectedField[], got: { field: string; status: string; read: string }[]): FieldCheck[] {
  return expected.map((e) => {
    const g = got.find((f) => norm(f.field) === norm(e.field));
    let status = (STATUSES as readonly string[]).includes(g?.status ?? "") ? (g!.status as FieldCheck["status"]) : "falta";
    if (g && norm(g.read).includes(norm(e.value))) status = "ok";
    else if (g?.read && norm(e.value).startsWith(norm(g.read)) && norm(g.read).length < norm(e.value).length) status = "cortado";
    return { field: e.field, expected: e.value, status, read: g?.read ?? "" };
  });
}

/**
 * Verificador de lectura: un modelo con visión lee la pieza renderizada y confirma que cada dato
 * (horarios, títulos, nombres, fecha) aparece completo y correcto. Detecta textos cortados por el
 * diseño que el control geométrico no ve (ej. una hora que se sale de su bloque).
 */
export async function verifyPieceReading(png: Buffer, expected: ExpectedField[]): Promise<ReadingCheck> {
  const image = `data:image/png;base64,${(await sharp(png).resize(1400, 1400, { fit: "inside" }).png().toBuffer()).toString("base64")}`;
  const prompt = loadPrompt("verifier");
  const text = prompt.render({ expected: expected.map((e) => `- ${e.field}: "${e.value}"`).join("\n") });
  const message = new HumanMessage({ content: [{ type: "text", text }, { type: "image_url" as const, image_url: image }] });
  const { out, model } = await invokeStructured("vision", ReadingSchema, [message], { name: "piece_reading", temperature: 0, timeoutMs: 60_000, prompt });

  const fields = reconcileFields(expected, out.fields);
  return { ok: fields.every((f) => f.status === "ok"), fields, model };
}
