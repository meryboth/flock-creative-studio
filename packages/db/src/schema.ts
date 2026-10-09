import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  real,
  jsonb,
  timestamp,
  boolean,
  index,
  vector,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ─── Brand kit (capa base, una fila por versión de la marca) ────────────────

export const brandKits = pgTable("brand_kits", {
  id: id(),
  name: text("name").notNull(),
  version: integer("version").notNull(),
  // Contenido completo de brand/brand.json: logos, colors, elements, rules
  manifest: jsonb("manifest").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
});

export const fontCatalog = pgTable("font_catalog", {
  id: id(),
  family: text("family").notNull().unique(),
  role: text("role").notNull(), // institutional | display | body
  files: jsonb("files").$type<string[]>().notNull().default([]),
  license: text("license"),
  vibe: text("vibe").array().notNull().default([]), // ej: ["extended", "tech", "bold"]
  createdAt: createdAt(),
});

// ─── Eventos ────────────────────────────────────────────────────────────────

export const eventStatus = pgEnum("event_status", ["exploring", "kit_locked", "producing", "done"]);

export const events = pgTable("events", {
  id: id(),
  name: text("name").notNull(),
  theme: text("theme"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  date: text("date"), // yyyy-mm-dd
  location: text("location"),
  language: text("language").notNull().default("es"),
  hashtag: text("hashtag"),
  tagline: text("tagline"),
  brief: text("brief"), // descripción libre del evento
  structuredBrief: jsonb("structured_brief"), // EventBrief (Zod)
  // Estilo elegido: { styleId, seeds: { accent, accent2 }, seed }
  style: jsonb("style"),
  moodboard: jsonb("moodboard"), // análisis del moodboard (colores, estilo sugerido)
  content: jsonb("content"), // textos generados (EventContent)
  contentSource: text("content_source"), // gemini | fallback
  // De dónde salió la nómina de este evento y cuándo se leyó: { source, fetchedAt }
  roster: jsonb("roster"),
  status: eventStatus("status").notNull().default("exploring"),
  brandKitId: uuid("brand_kit_id").references(() => brandKits.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const moodboardImages = pgTable(
  "moodboard_images",
  {
    id: id(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    file: text("file").notNull(),
    source: text("source"), // upload | url | previous_event
    analysis: jsonb("analysis"), // StyleProfile parcial
    createdAt: createdAt(),
  },
  (t) => [index().on(t.eventId)],
);

// ─── Biblioteca de estilos ──────────────────────────────────────────────────

/**
 * Estilos creados por el equipo a partir de referencias gráficas. Los eventos guardan una copia
 * del estilo al crearse, así que borrar un estilo de la biblioteca no afecta a eventos existentes.
 */
export const styles = pgTable("styles", {
  id: id(),
  name: text("name").notNull(),
  // Lectura de la referencia (ReferenceStyle de @flock/templates)
  reference: jsonb("reference").notNull(),
  keyVisualPrompt: text("key_visual_prompt"),
  // Archivos dentro de storage/styles/<id>/: imágenes de referencia y key visual opcional
  images: text("images").array().notNull().default([]),
  keyVisual: text("key_visual"),
  elements: text("elements").array().notNull().default([]), // elementos decorativos generados
  createdAt: createdAt(),
});

// ─── Exploración de identidad ───────────────────────────────────────────────

export const directionStatus = pgEnum("direction_status", ["proposed", "selected", "discarded"]);

export const creativeDirections = pgTable(
  "creative_directions",
  {
    id: id(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => creativeDirections.id),
    round: integer("round").notNull().default(1),
    concept: text("concept").notNull(),
    tokens: jsonb("tokens").notNull(), // paleta, fuentes, layout family
    prompts: jsonb("prompts"), // prompt del key visual, etc.
    lockedFields: text("locked_fields").array().notNull().default([]),
    status: directionStatus("status").notNull().default("proposed"),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.eventId)],
);

export const keyVisuals = pgTable("key_visuals", {
  id: id(),
  directionId: uuid("direction_id")
    .notNull()
    .references(() => creativeDirections.id, { onDelete: "cascade" }),
  file: text("file").notNull(),
  maskFile: text("mask_file"), // recorte con alpha
  prompt: text("prompt"),
  provider: text("provider").notNull(), // gemini | comfyui | manual
  seed: text("seed"),
  createdAt: createdAt(),
});

export const eventKits = pgTable("event_kits", {
  id: id(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  directionId: uuid("direction_id").references(() => creativeDirections.id),
  version: integer("version").notNull().default(1),
  kit: jsonb("kit").notNull(), // ver sección "Event Kit" en la propuesta
  createdAt: createdAt(),
});

// ─── Datos para piezas por lote ─────────────────────────────────────────────

export const agendaItems = pgTable(
  "agenda_items",
  {
    id: id(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    startsAt: text("starts_at").notNull(), // "09:15"
    endsAt: text("ends_at"),
    title: text("title").notNull(),
    speaker: text("speaker"),
    room: text("room"),
    position: integer("position").notNull().default(0),
  },
  (t) => [index().on(t.eventId)],
);

export const attendees = pgTable(
  "attendees",
  {
    id: id(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    area: text("area"),
    role: text("role"),
    photo: text("photo"),
  },
  (t) => [index().on(t.eventId)],
);

// ─── Piezas ─────────────────────────────────────────────────────────────────

export const pieceStatus = pgEnum("piece_status", ["draft", "approved", "rejected"]);

export const pieces = pgTable(
  "pieces",
  {
    id: id(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    eventKitId: uuid("event_kit_id").references(() => eventKits.id),
    type: text("type").notNull(), // linkedin_post | landing | agenda_slide | agenda_summary | badge
    template: text("template").notNull(),
    data: jsonb("data").notNull(), // copy y datos que llenan la plantilla
    file: text("file"),
    version: integer("version").notNull().default(1),
    qaScore: real("qa_score"),
    qaReport: jsonb("qa_report"),
    status: pieceStatus("status").notNull().default("draft"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.eventId, t.type)],
);

export const feedback = pgTable("feedback", {
  id: id(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  directionId: uuid("direction_id").references(() => creativeDirections.id, { onDelete: "cascade" }),
  pieceId: uuid("piece_id").references(() => pieces.id, { onDelete: "cascade" }),
  comment: text("comment").notNull(),
  createdAt: createdAt(),
});

// ─── Trazabilidad de workflows ──────────────────────────────────────────────

export const runStatus = pgEnum("run_status", ["queued", "running", "waiting_human", "done", "failed"]);

export const runs = pgTable("runs", {
  id: id(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  graph: text("graph").notNull(), // identity | production
  threadId: text("thread_id").notNull(), // thread de LangGraph
  status: runStatus("status").notNull().default("queued"),
  stage: text("stage"), // texto de progreso para la UI
  progress: integer("progress").notNull().default(0),
  total: integer("total").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  error: text("error"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const runSteps = pgTable(
  "run_steps",
  {
    id: id(),
    runId: uuid("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
    node: text("node").notNull(),
    input: jsonb("input"),
    output: jsonb("output"),
    durationMs: integer("duration_ms"),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.runId)],
);

// ─── RAG: manual de marca y eventos anteriores ─────────────────────────────

export const brandChunks = pgTable(
  "brand_chunks",
  {
    id: id(),
    source: text("source").notNull(), // archivo o evento de origen
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 768 }),
    metadata: jsonb("metadata"),
    createdAt: createdAt(),
  },
  (t) => [index("brand_chunks_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops"))],
);
