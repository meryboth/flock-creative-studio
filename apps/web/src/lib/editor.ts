import "server-only";
import { existsSync } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@flock/db";
import { generateKeyVisual, interpretEdit, type EditOperation } from "@flock/agents";
import { addPatch, groupOf, GROUP_LABEL, type Overrides, type Patch, type PieceGroup, type PieceType } from "@flock/studio";
import { buildKit, STYLES, type EventContent, type Language } from "@flock/templates";
import { REPO_ROOT, STORAGE_DIR, UPLOADS_DIR } from "./paths";
import type { StyleChoice } from "./studio";

export type Scope = { kind: "all" } | { kind: "group"; group: PieceGroup } | { kind: "piece"; file: string };

const COLOR_LABEL: Record<string, string> = { ground: "fondo", ink: "texto", accent: "acento", accent2: "acento 2", muted: "texto secundario" };
const ELEMENT_LABEL: Record<string, string> = { hashtag: "hashtag", tagline: "frase", date: "fecha", visual: "visual" };
const CASE_LABEL: Record<string, string> = { upper: "MAYÚSCULAS", title: "normal", lower: "minúsculas" };

/** Etiqueta corta de una operación, para mostrarla como chip en el chat. */
export function describeOperation(o: EditOperation): string {
  switch (o.op) {
    case "setColor":
      return `${COLOR_LABEL[o.role!] ?? o.role} → ${o.value}`;
    case "setFont":
      return `${o.role === "display" ? "títulos" : "texto"} en ${o.value}`;
    case "setCase":
      return `títulos en ${CASE_LABEL[o.value!]}`;
    case "setWeight":
      return `peso de títulos ${o.number}`;
    case "setTitleScale":
      return `título ×${o.number?.toFixed(2)}`;
    case "setVisualScale":
      return `visual ×${o.number?.toFixed(2)}`;
    case "hide":
      return `ocultar ${ELEMENT_LABEL[o.element!]}`;
    case "show":
      return `mostrar ${ELEMENT_LABEL[o.element!]}`;
    case "setCopy":
      return `${o.field === "headline" ? "titular" : "bajada"}: "${o.text}"`;
    case "newVariant":
      return "otra variante del visual";
    case "regenerateKeyVisual":
      return `key visual nuevo: ${o.prompt}`;
  }
}

async function loadEvent(eventId: string) {
  const [event] = await db.select().from(schema.events).where(eq(schema.events.id, eventId));
  if (!event) throw new Error("Evento inexistente");
  return event;
}

function kitOf(event: typeof schema.events.$inferSelect) {
  const style = event.style as StyleChoice;
  return buildKit({
    event: { name: event.name, date: event.date!, language: event.language as Language },
    styleId: style.styleId,
    seeds: style.seeds,
    seed: style.seed,
    reference: style.reference,
  });
}

/** Posteo o mensaje cuyo texto se puede editar desde la pieza elegida. */
function copyTargetOf(file: string): { channel: "linkedin" | "slack"; id: string } | null {
  const li = file.match(/^linkedin\/(.+)-(square|landscape)\.png$/);
  if (li) return { channel: "linkedin", id: li[1] };
  const sl = file.match(/^slack\/(.+)\.png$/);
  return sl ? { channel: "slack", id: sl[1] } : null;
}

/** Opciones de alcance para la pieza elegida, con la cantidad de piezas afectadas. */
export async function scopeOptions(eventId: string, pieceFile: string | null) {
  const pieces = await db.select().from(schema.pieces).where(eq(schema.pieces.eventId, eventId));
  const visible = pieces.filter((p) => p.type !== "linkedin-text");
  const options: { scope: Scope; label: string; count: number }[] = [{ scope: { kind: "all" }, label: "Todas", count: visible.length }];
  const piece = pieceFile ? pieces.find((p) => p.file === pieceFile) : null;
  if (piece) {
    const group = groupOf(piece.type as PieceType);
    options.push({ scope: { kind: "group", group }, label: `Todos los ${GROUP_LABEL[group]}`, count: visible.filter((p) => groupOf(p.type as PieceType) === group).length });
    options.push({ scope: { kind: "piece", file: piece.file! }, label: "Solo esta", count: 1 });
  }
  return options;
}

/** Interpreta un pedido del chat y guarda la propuesta. */
export async function proposeChange(eventId: string, message: string, pieceFile: string | null) {
  const event = await loadEvent(eventId);
  const kit = kitOf(event);
  const style = event.style as StyleChoice;
  const [piece] = pieceFile
    ? await db.select().from(schema.pieces).where(and(eq(schema.pieces.eventId, eventId), eq(schema.pieces.file, pieceFile)))
    : [];
  const target = piece ? copyTargetOf(piece.file!) : null;
  const post = target ? (event.content as EventContent | null)?.[target.channel]?.find((p) => p.id === target.id) : undefined;

  const proposal = await interpretEdit({
    message,
    event: { name: event.name, style: style.styleId === "referencia" ? "derivado de una referencia" : STYLES[style.styleId].name },
    palette: { ground: kit.style.palette.ground, ink: kit.style.palette.ink, accent: kit.style.palette.accent, accent2: kit.style.palette.accent2 },
    fonts: kit.style.fonts,
    piece: piece
      ? { file: piece.file!, label: (piece.data as { label?: string }).label ?? piece.file!, group: GROUP_LABEL[groupOf(piece.type as PieceType)], headline: post?.headline, body: post?.body }
      : null,
    canRegenerateGraphics: Boolean(style.reference),
  });
  // setCopy solo tiene sentido sobre un posteo o mensaje elegido
  const operations = proposal.operations.filter((o) => o.op !== "setCopy" || post);

  const [row] = await db
    .insert(schema.changeSets)
    .values({ eventId, message, pieceFile, reply: proposal.reply, operations, suggestedScope: proposal.scope })
    .returning();
  return {
    id: row.id,
    reply: proposal.reply,
    operations: operations.map((o) => ({ ...o, label: describeOperation(o) })),
    suggestedScope: proposal.scope,
    scopes: await scopeOptions(eventId, pieceFile),
    textOnly: operations.length > 0 && operations.every((o) => o.op === "setCopy"),
  };
}

/** Aplica una propuesta en el alcance elegido. Devuelve true si hay que regenerar las piezas. */
export async function applyChange(changeId: string, scope: Scope) {
  const [change] = await db.select().from(schema.changeSets).where(eq(schema.changeSets.id, changeId));
  if (!change || change.status !== "proposed") throw new Error("Esta propuesta ya no está disponible");
  const event = await loadEvent(change.eventId);
  const before = { overrides: event.overrides, content: event.content, style: event.style };
  let overrides = (event.overrides as Overrides | null) ?? {};
  let content = event.content as EventContent | null;
  let style = { ...(event.style as StyleChoice) };
  const ops = change.operations as EditOperation[];

  // Operaciones visuales → un parche en el alcance elegido
  const patch: Patch = {};
  for (const o of ops) {
    if (o.op === "setColor") patch.colors = { ...patch.colors, [o.role!]: o.value! };
    if (o.op === "setFont") patch.fonts = { ...patch.fonts, [o.role!]: o.value! };
    if (o.op === "setCase") patch.case = o.value as Patch["case"];
    if (o.op === "setWeight") patch.weight = o.number;
    if (o.op === "setTitleScale") patch.titleScale = o.number;
    if (o.op === "setVisualScale") patch.visualScale = o.number;
    if (o.op === "hide" || o.op === "show") patch.hide = { ...patch.hide, [o.element!]: o.op === "hide" };
  }
  if (Object.keys(patch).length) overrides = addPatch(overrides, patch, scope);

  // Textos: se editan en el contenido del posteo o mensaje elegido
  const target = change.pieceFile ? copyTargetOf(change.pieceFile) : null;
  for (const o of ops.filter((x) => x.op === "setCopy")) {
    if (!content || !target) continue;
    const edit = <T extends { id: string }>(list: T[] = []) => list.map((p) => (p.id === target.id ? { ...p, [o.field!]: o.text! } : p));
    content = target.channel === "linkedin" ? { ...content, linkedin: edit(content.linkedin) } : { ...content, slack: edit(content.slack) };
  }

  // Acciones sobre el estilo del evento
  if (ops.some((o) => o.op === "newVariant")) style = { ...style, seed: style.seed + 1 };
  const kvOp = ops.find((o) => o.op === "regenerateKeyVisual");
  if (kvOp && style.reference) {
    const references = await referenceImagesFor(style);
    const out = join(STORAGE_DIR, change.eventId, "inputs", "keyvisual.png");
    await mkdir(join(STORAGE_DIR, change.eventId, "inputs"), { recursive: true });
    const result = await generateKeyVisual({
      references,
      prompt: kvOp.prompt!,
      ground: kitOf(event).style.palette.ground,
      outFile: out,
      repoRoot: REPO_ROOT,
      medium: undefined,
    });
    if (!result.ok) throw new Error(result.error);
    style = { ...style, keyVisual: `${change.eventId}/inputs/keyvisual.png` };
  }

  await db.transaction(async (tx) => {
    await tx.update(schema.events).set({ overrides, content, style, status: "producing" }).where(eq(schema.events.id, change.eventId));
    await tx.update(schema.changeSets).set({ status: "applied", scope, before }).where(eq(schema.changeSets.id, changeId));
  });
  return change.eventId;
}

export async function discardChange(changeId: string) {
  await db.update(schema.changeSets).set({ status: "discarded" }).where(eq(schema.changeSets.id, changeId));
}

/** Deshace el último cambio aplicado: restaura la foto previa. */
export async function undoLastChange(eventId: string) {
  const [last] = await db
    .select()
    .from(schema.changeSets)
    .where(and(eq(schema.changeSets.eventId, eventId), eq(schema.changeSets.status, "applied")))
    .orderBy(desc(schema.changeSets.createdAt))
    .limit(1);
  if (!last?.before) return false;
  const before = last.before as { overrides: unknown; content: unknown; style: unknown };
  await db.transaction(async (tx) => {
    await tx
      .update(schema.events)
      .set({ overrides: before.overrides ?? null, content: before.content, style: before.style, status: "producing" })
      .where(eq(schema.events.id, eventId));
    await tx.update(schema.changeSets).set({ status: "reverted" }).where(eq(schema.changeSets.id, last.id));
  });
  return true;
}

export async function listChanges(eventId: string) {
  return db.select().from(schema.changeSets).where(eq(schema.changeSets.eventId, eventId)).orderBy(schema.changeSets.createdAt);
}

/** Imágenes de referencia del estilo del evento (de la subida o de la biblioteca). */
async function referenceImagesFor(style: StyleChoice) {
  const dirs = [
    style.referenceUpload ? join(UPLOADS_DIR, style.referenceUpload) : null,
    style.libraryStyleId ? join(STORAGE_DIR, "styles", style.libraryStyleId) : null,
  ].filter((d): d is string => Boolean(d && existsSync(d)));
  for (const dir of dirs) {
    const files = (await readdir(dir)).filter((f) => /^\d+\.(png|jpe?g|webp)$/i.test(f));
    if (files.length) return files.map((f) => join(dir, f));
  }
  return [];
}
