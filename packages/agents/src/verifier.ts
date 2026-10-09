import { HumanMessage } from "@langchain/core/messages";
import sharp from "sharp";
import { z } from "zod";
import { invokeStructured } from "./llm";

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
 * Verificador de lectura: un modelo con visión lee la pieza renderizada y confirma que cada dato
 * (horarios, títulos, nombres, fecha) aparece completo y correcto. Detecta textos cortados por el
 * diseño que el control geométrico no ve (ej. una hora que se sale de su bloque).
 */
export async function verifyPieceReading(png: Buffer, expected: ExpectedField[]): Promise<ReadingCheck> {
  const image = `data:image/png;base64,${(await sharp(png).resize(1400, 1400, { fit: "inside" }).png().toBuffer()).toString("base64")}`;
  const text = `Sos el control de calidad de piezas gráficas de un evento. Mirá la imagen y, para cada dato de la lista, decí si se lee COMPLETO y CORRECTO.

Datos que la pieza tiene que mostrar:
${expected.map((e) => `- ${e.field}: "${e.value}"`).join("\n")}

Para cada dato devolvé:
- status "ok": se lee entero y es el mismo (no importan mayúsculas ni tildes).
- status "cortado": aparece pero le falta una parte porque el diseño lo corta (ej. "19:0" en vez de "19:00", una palabra que se sale del borde o queda tapada).
- status "falta": no aparece.
- status "distinto": aparece otro valor.
En "read" copiá textual lo que se ve. No inventes: si no lo ves, es "falta".`;
  const message = new HumanMessage({ content: [{ type: "text", text }, { type: "image_url" as const, image_url: image }] });
  const { out, model } = await invokeStructured("vision", ReadingSchema, [message], { name: "piece_reading", temperature: 0, timeoutMs: 60_000 });

  const fields: FieldCheck[] = expected.map((e) => {
    const got = out.fields.find((f) => norm(f.field) === norm(e.field));
    let status = (STATUSES as readonly string[]).includes(got?.status ?? "") ? (got!.status as FieldCheck["status"]) : "falta";
    // Si el modelo leyó exactamente el valor esperado, vale como ok aunque haya dudado
    if (got && norm(got.read).includes(norm(e.value))) status = "ok";
    // Y al revés: si leyó solo el principio del valor ("19:0" de "19:00"), está cortado aunque diga ok
    else if (got?.read && norm(e.value).startsWith(norm(got.read)) && norm(got.read).length < norm(e.value).length) status = "cortado";
    return { field: e.field, expected: e.value, status, read: got?.read ?? "" };
  });
  return { ok: fields.every((f) => f.status === "ok"), fields, model };
}
