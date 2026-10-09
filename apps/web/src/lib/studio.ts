import "server-only";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@flock/db";
import { writeEventCopy } from "@flock/agents";
import { adjustFrom, generateFamily, loadRoster, outputsOf, type OutputId, type Overrides, type RosterSource } from "@flock/studio";
import { buildKit, type AgendaItem, type Attendee, type EventContent, type Language, type ReferenceStyle, type StyleId } from "@flock/templates";
import { REPO_ROOT, STORAGE_DIR } from "./paths";

export type StyleChoice = {
  styleId: StyleId;
  seeds: { accent: string; accent2?: string };
  seed: number;
  // Estilo "referencia": lectura de la imagen y, opcional, key visual generado (ruta relativa a storage/)
  reference?: ReferenceStyle;
  referenceUpload?: string;
  libraryStyleId?: string; // si vino de la biblioteca de estilos
  keyVisual?: string;
  elements?: string[]; // elementos decorativos generados (rutas relativas a storage/)
};

export type NewEventInput = {
  name: string;
  date: string;
  location?: string;
  language: Language;
  hashtag?: string;
  tagline?: string;
  description?: string;
  style: StyleChoice;
  moodboard?: unknown;
  agenda: AgendaItem[];
  attendees: Attendee[];
  outputs: OutputId[];
};

export async function createEvent(input: NewEventInput) {
  return db.transaction(async (tx) => {
    const [event] = await tx
      .insert(schema.events)
      .values({
        name: input.name,
        date: input.date,
        location: input.location || null,
        language: input.language,
        hashtag: input.hashtag || null,
        tagline: input.tagline || null,
        brief: input.description || null,
        style: input.style,
        moodboard: input.moodboard ?? null,
        outputs: input.outputs,
        status: "producing",
      })
      .returning({ id: schema.events.id });
    if (input.agenda.length)
      await tx.insert(schema.agendaItems).values(
        input.agenda.map((a, position) => ({ eventId: event.id, startsAt: a.start, endsAt: a.end, title: a.title, speaker: a.speaker, room: a.room, position })),
      );
    if (input.attendees.length)
      await tx.insert(schema.attendees).values(input.attendees.map((a) => ({ eventId: event.id, ...a })));
    return event.id;
  });
}

export async function getEvent(id: string) {
  const [event] = await db.select().from(schema.events).where(eq(schema.events.id, id));
  if (!event) return null;
  const [run] = await db.select().from(schema.runs).where(eq(schema.runs.eventId, id)).orderBy(desc(schema.runs.createdAt)).limit(1);
  const pieces = await db.select().from(schema.pieces).where(eq(schema.pieces.eventId, id)).orderBy(asc(schema.pieces.createdAt));
  return { event, run: run ?? null, pieces };
}

export async function listEvents() {
  return db.select().from(schema.events).orderBy(desc(schema.events.createdAt));
}

async function loadEventData(id: string) {
  const [event] = await db.select().from(schema.events).where(eq(schema.events.id, id));
  const agenda = await db.select().from(schema.agendaItems).where(eq(schema.agendaItems.eventId, id)).orderBy(asc(schema.agendaItems.position));
  const people = await db.select().from(schema.attendees).where(eq(schema.attendees.eventId, id));
  return {
    event,
    agenda: agenda.map((a): AgendaItem => ({ start: a.startsAt, end: a.endsAt ?? undefined, title: a.title, speaker: a.speaker ?? undefined, room: a.room ?? undefined })),
    attendees: people.map(
      (p): Attendee => ({
        firstName: p.firstName,
        lastName: p.lastName,
        area: p.area ?? undefined,
        role: p.role ?? undefined,
        email: p.email ?? undefined,
        attendance: (p.attendance as Attendee["attendance"]) ?? undefined,
      }),
    ),
  };
}

/**
 * Genera la familia de piezas de un evento. Pensada para correr en segundo plano (after()):
 * va dejando el progreso en `runs` para que la UI lo muestre.
 * @param rewriteCopy si es false, reutiliza los textos ya generados (ej. al cambiar solo la variante)
 */
export async function runGeneration(eventId: string, { rewriteCopy = true } = {}) {
  const [run] = await db
    .insert(schema.runs)
    .values({ eventId, graph: "family", threadId: randomUUID(), status: "running", stage: "Preparando" })
    .returning({ id: schema.runs.id });
  const update = (values: Partial<typeof schema.runs.$inferInsert>) => db.update(schema.runs).set(values).where(eq(schema.runs.id, run.id));

  try {
    const { event, agenda, attendees: own } = await loadEventData(eventId);

    // Nómina: si el evento no tiene asistentes propios, se lee de la fuente configurada
    // (hoy, la nómina de ejemplo; a futuro, el Excel de SharePoint) y se guarda como snapshot.
    let attendees = own;
    if (!attendees.length) {
      await update({ stage: "Leyendo la nómina" });
      const roster = await loadRoster({ kind: "mock" }, REPO_ROOT);
      attendees = roster.attendees;
      await db.transaction(async (tx) => {
        if (attendees.length) await tx.insert(schema.attendees).values(attendees.map((a) => ({ eventId, ...a })));
        await tx.update(schema.events).set({ roster: { source: roster.source, fetchedAt: roster.fetchedAt } }).where(eq(schema.events.id, eventId));
      });
    }
    const style = event.style as StyleChoice;
    const kit = buildKit({
      event: {
        name: event.name,
        date: event.date!,
        location: event.location ?? undefined,
        hashtag: event.hashtag ?? undefined,
        tagline: event.tagline ?? undefined,
        description: event.brief ?? undefined,
        language: event.language as Language,
      },
      styleId: style.styleId,
      seeds: style.seeds,
      seed: style.seed,
      reference: style.reference,
      // el key visual es opcional: si el archivo ya no está, se genera sin él
      keyVisual: style.keyVisual && existsSync(join(STORAGE_DIR, style.keyVisual)) ? { file: style.keyVisual, fit: "object" } : undefined,
    });

    let content = event.content as EventContent | null;
    let lastCopyError: string | null = null;
    // Eventos anteriores a Slack y a los momentos (antes / durante / después): se redactan de nuevo
    if (rewriteCopy || !content || !content.slack) {
      await update({ stage: "Redactando los textos con IA" });
      const copy = await writeEventCopy({ event: kit.event, agenda });
      if (copy.error) console.warn(`[textos] ${copy.source}: ${copy.error}`);
      lastCopyError = copy.error ?? null;
      content = copy.content;
      await db.update(schema.events).set({ content, contentSource: copy.source === "llm" ? (copy.model ?? "llm") : "fallback", hashtag: kit.event.hashtag }).where(eq(schema.events.id, eventId));
    }

    await update({ stage: "Generando las piezas" });
    const result = await generateFamily({
      kit,
      content,
      agenda,
      attendees,
      repoRoot: REPO_ROOT,
      outDir: join(STORAGE_DIR, eventId),
      keyVisualPath: style.keyVisual && existsSync(join(STORAGE_DIR, style.keyVisual)) ? join(STORAGE_DIR, style.keyVisual) : undefined,
      elementPaths: (style.elements ?? []).map((e) => join(STORAGE_DIR, e)).filter((p) => existsSync(p)),
      // cambios pedidos en el editor conversacional
      adjust: adjustFrom(kit, event.overrides as Overrides | null),
      outputs: outputsOf(event.outputs),
      onProgress: async (progress, total, label) => {
        await update({ progress, total, stage: `Generando: ${label}` });
      },
    });

    await db.transaction(async (tx) => {
      const [kitRow] = await tx.insert(schema.eventKits).values({ eventId, kit }).returning({ id: schema.eventKits.id });
      await tx.delete(schema.pieces).where(eq(schema.pieces.eventId, eventId));
      await tx.insert(schema.pieces).values(
        result.pieces.map((p) => ({ eventId, eventKitId: kitRow.id, type: p.type, template: p.template, data: { label: p.label }, file: p.file })),
      );
      await tx.update(schema.events).set({ status: "done" }).where(eq(schema.events.id, eventId));
    });
    const [{ contentSource }] = await db.select({ contentSource: schema.events.contentSource }).from(schema.events).where(eq(schema.events.id, eventId));
    await update({
      status: "done",
      stage: `Piezas generadas en ${result.seconds.toFixed(0)} s · QA de diseño: ${result.qaReport.split("\n").pop()}`,
      error: contentSource === "fallback" ? lastCopyError : null,
    });
  } catch (err) {
    console.error("Generación fallida", err);
    await update({ status: "failed", error: err instanceof Error ? err.message : String(err) });
    // Sale de "producing" para que la página muestre el error y permita reintentar
    await db.update(schema.events).set({ status: "done" }).where(eq(schema.events.id, eventId));
  }
}

/** Apunta el estilo del evento a sus copias propias del key visual y de los elementos. */
export async function setEventGraphics(eventId: string, graphics: { keyVisual?: string; elements?: string[] }) {
  const [event] = await db.select({ style: schema.events.style }).from(schema.events).where(eq(schema.events.id, eventId));
  await db.update(schema.events).set({ style: { ...(event.style as StyleChoice), ...graphics } }).where(eq(schema.events.id, eventId));
}

export type RosterInfo = {
  source: string;
  fetchedAt: string;
  url?: string;
  fileName?: string;
  count?: number; // personas confirmadas
  presencial?: number; // credenciales impresas
  error?: string;
};

/**
 * Carga la nómina del evento desde un link de SharePoint / OneDrive o un Excel / CSV subido:
 * reemplaza el snapshot de asistentes. La regeneración de piezas la dispara quien llama.
 */
export async function syncRoster(eventId: string, input: { url: string } | { file: Buffer; fileName: string }) {
  const [event] = await db.select({ roster: schema.events.roster }).from(schema.events).where(eq(schema.events.id, eventId));
  if (!event) throw new Error("Evento inexistente");
  const source: RosterSource =
    "url" in input
      ? { kind: "sharepoint-excel", url: input.url }
      : /\.csv$/i.test(input.fileName)
        ? { kind: "csv", text: input.file.toString("utf8") }
        : { kind: "xlsx", data: input.file, fileName: input.fileName };
  try {
    const roster = await loadRoster(source, REPO_ROOT);
    const presencial = roster.attendees.filter((a) => a.attendance !== "remoto").length;
    await db.transaction(async (tx) => {
      await tx.delete(schema.attendees).where(eq(schema.attendees.eventId, eventId));
      await tx.insert(schema.attendees).values(roster.attendees.map((a) => ({ eventId, ...a })));
      const info: RosterInfo = {
        source: roster.source,
        fetchedAt: roster.fetchedAt,
        ...("url" in input ? { url: input.url } : { fileName: input.fileName }),
        count: roster.attendees.length,
        presencial,
      };
      await tx.update(schema.events).set({ roster: info, status: "producing" }).where(eq(schema.events.id, eventId));
    });
    return { count: roster.attendees.length, presencial };
  } catch (err) {
    // Se recuerda el link aunque falle, para reintentar sin volver a pegarlo
    const error = err instanceof Error ? err.message : String(err);
    const prev = event.roster as RosterInfo | null;
    await db
      .update(schema.events)
      .set({ roster: { ...prev, ...("url" in input ? { url: input.url } : {}), error } })
      .where(eq(schema.events.id, eventId));
    throw new Error(error);
  }
}

/** Último link de nómina usado en cualquier evento: se sugiere para los próximos. */
export async function lastRosterUrl() {
  const rows = await db.select({ roster: schema.events.roster }).from(schema.events).orderBy(desc(schema.events.createdAt)).limit(50);
  return rows.map((r) => (r.roster as RosterInfo | null)?.url).find(Boolean) ?? null;
}

/** Cambia los grupos de piezas del evento (sumar certificados, sacar la landing…). La regeneración la dispara quien llama. */
export async function setOutputs(eventId: string, outputs: OutputId[]) {
  if (!outputs.length) throw new Error("Elegí al menos un tipo de pieza");
  await db.update(schema.events).set({ outputs, status: "producing" }).where(eq(schema.events.id, eventId));
}
