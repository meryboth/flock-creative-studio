import "server-only";
import { join } from "node:path";
import { and, asc, desc, eq, isNotNull, lte, ne } from "drizzle-orm";
import { db, schema } from "@flock/db";
import { momentOf, type EventContent, type Moment } from "@flock/templates";
import { linkedinStatus, publishToLinkedIn } from "./connectors/linkedin";
import { cancelInSlack, publishToSlack, scheduleInSlack, slackStatus } from "./connectors/slack";
import { STORAGE_DIR } from "./paths";

export type Channel = "slack" | "linkedin";

// Las fechas sugeridas se calculan en hora de Buenos Aires (sin horario de verano)
const TZ = "-03:00";
const at = (date: string, time: string) => new Date(`${date}T${time}:00${TZ}`);
const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00${TZ}`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Cuándo conviene publicar cada momento: una semana antes, durante el evento y al día siguiente. */
export function suggestedTime(moment: Moment, eventDate: string, firstStart?: string, channel: Channel = "linkedin") {
  const start = /^\d{1,2}:\d{2}$/.test(firstStart ?? "") ? firstStart!.padStart(5, "0") : "10:00";
  let when: Date;
  if (moment === "antes") when = at(addDays(eventDate, channel === "slack" ? -3 : -7), "10:00");
  else if (moment === "durante")
    // Slack: el aviso de "es hoy" va temprano; LinkedIn: una hora después de arrancar, con el evento en marcha
    when = channel === "slack" ? at(eventDate, "09:00") : new Date(at(eventDate, start).getTime() + 60 * 60 * 1000);
  else when = at(addDays(eventDate, 1), "10:00");
  // Si la fecha sugerida ya pasó, la próxima hora en punto
  const soon = new Date(Date.now() + 60 * 60 * 1000);
  soon.setMinutes(0, 0, 0);
  return when < soon ? soon : when;
}

export type PlanItem = {
  channel: Channel;
  moment: Moment;
  id: string;
  headline: string;
  text: string;
  pieceFile: string;
  suggestedAt: string;
  scheduled: (typeof schema.scheduledPosts.$inferSelect & { scheduledAt: Date }) | null;
};

/** Plan de publicaciones de un canal: una por momento, con su programación vigente si la hay. */
export async function publishingPlan(eventId: string, channel: Channel): Promise<PlanItem[]> {
  const [event] = await db.select().from(schema.events).where(eq(schema.events.id, eventId));
  const content = event?.content as EventContent | null;
  if (!event?.date || !content) return [];
  const [first] = await db.select().from(schema.agendaItems).where(eq(schema.agendaItems.eventId, eventId)).orderBy(asc(schema.agendaItems.position)).limit(1);
  const rows = await db.select().from(schema.scheduledPosts).where(and(eq(schema.scheduledPosts.eventId, eventId), eq(schema.scheduledPosts.channel, channel)));

  const items =
    channel === "linkedin"
      ? content.linkedin.map((p) => ({ id: p.id, moment: momentOf(p), headline: p.headline, text: p.post, pieceFile: `linkedin/${p.id}-square.png` }))
      : (content.slack ?? []).map((m) => ({ id: m.id, moment: m.moment, headline: m.headline, text: m.text, pieceFile: `slack/${m.id}.png` }));
  return items.map((it) => {
    // la programación vigente del momento (la última que no se canceló)
    const current = rows.filter((r) => r.moment === it.moment && r.status !== "cancelled").sort((a, b) => +b.createdAt - +a.createdAt)[0] ?? null;
    return { channel, ...it, suggestedAt: suggestedTime(it.moment, event.date!, first?.startsAt, channel).toISOString(), scheduled: current };
  });
}

export function connectorStatus() {
  return { slack: slackStatus(), linkedin: linkedinStatus() };
}

/** Programa (o reprograma) la publicación de un momento. */
export async function schedulePost(input: { eventId: string; channel: Channel; moment: Moment; scheduledAt: Date; target?: string | null }) {
  const plan = await publishingPlan(input.eventId, input.channel);
  const item = plan.find((p) => p.moment === input.moment);
  if (!item) throw new Error("No hay pieza para ese momento");
  if (Number.isNaN(input.scheduledAt.getTime())) throw new Error("Fecha inválida");
  return db.transaction(async (tx) => {
    // Un momento tiene una sola programación activa
    if (item.scheduled?.status === "scheduled" || item.scheduled?.status === "failed")
      await tx.update(schema.scheduledPosts).set({ status: "cancelled" }).where(eq(schema.scheduledPosts.id, item.scheduled.id));
    const [row] = await tx
      .insert(schema.scheduledPosts)
      .values({
        eventId: input.eventId,
        channel: input.channel,
        moment: input.moment,
        pieceFile: item.pieceFile,
        text: item.text,
        target: input.target || null,
        scheduledAt: input.scheduledAt,
      })
      .returning();
    return row;
  });
}

export async function cancelPost(postId: string) {
  const [post] = await db.select().from(schema.scheduledPosts).where(eq(schema.scheduledPosts.id, postId));
  // Si ya estaba programada en Slack mismo, se borra también allá
  if (post?.externalUrl?.startsWith("slack:scheduled:")) await cancelInSlack(post.externalUrl);
  await db
    .update(schema.scheduledPosts)
    .set({ status: "cancelled" })
    .where(and(eq(schema.scheduledPosts.id, postId), eq(schema.scheduledPosts.status, "scheduled")));
}

/** Publica una programación ya (sin esperar su horario). */
export async function publishNow(postId: string) {
  const [post] = await db.select().from(schema.scheduledPosts).where(eq(schema.scheduledPosts.id, postId));
  if (!post || post.status === "published" || post.status === "cancelled") throw new Error("Esta publicación ya no está pendiente");
  return publish(post);
}

async function publish(post: typeof schema.scheduledPosts.$inferSelect) {
  // Toma la publicación (evita que dos ciclos del despachador la publiquen dos veces)
  const [claimed] = await db
    .update(schema.scheduledPosts)
    .set({ status: "publishing", error: null })
    .where(and(eq(schema.scheduledPosts.id, post.id), eq(schema.scheduledPosts.status, post.status)))
    .returning();
  if (!claimed) return null;
  try {
    const file = join(STORAGE_DIR, post.eventId, post.pieceFile);
    // El texto vigente (pudo editarse en el chat después de programar); la imagen se regenera en el mismo archivo
    const text =
      post.channel === "linkedin" && post.moment
        ? ((await publishingPlan(post.eventId, post.channel)).find((p) => p.moment === post.moment)?.text ?? post.text)
        : post.text; // en Slack el texto lo escribe la persona al programar
    const result =
      post.channel === "slack"
        ? await publishToSlack({ file, text, channel: post.target })
        : await publishToLinkedIn({ file, text, alt: text.split("\n")[0].slice(0, 300) });
    await db
      .update(schema.scheduledPosts)
      .set({ status: "published", publishedAt: new Date(), externalUrl: result.url, text, publishedVia: "app" })
      .where(eq(schema.scheduledPosts.id, post.id));
    return result;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await db.update(schema.scheduledPosts).set({ status: "failed", error }).where(eq(schema.scheduledPosts.id, post.id));
    throw new Error(error);
  }
}

/**
 * Publica lo que ya venció. Lo llama el despachador cada minuto (instrumentation.ts).
 * Si el canal no está conectado, la publicación queda programada con un aviso y se reintenta.
 */
export async function dispatchDue() {
  const due = await db
    .select()
    .from(schema.scheduledPosts)
    .where(and(eq(schema.scheduledPosts.status, "scheduled"), lte(schema.scheduledPosts.scheduledAt, new Date())));
  const status = connectorStatus();
  for (const post of due) {
    // Programada en Slack mismo: la publicó Slack
    if (post.externalUrl?.startsWith("slack:scheduled:")) {
      await db.update(schema.scheduledPosts).set({ status: "published", publishedAt: post.scheduledAt, publishedVia: "app" }).where(eq(schema.scheduledPosts.id, post.id));
      continue;
    }
    if (!status[post.channel].connected) {
      const error = `Ya es la hora y ${post.channel === "slack" ? "Slack" : "LinkedIn"} no está conectado: publicala a mano (descargá la imagen y copiá el texto) y marcala como publicada.`;
      if (post.error !== error) await db.update(schema.scheduledPosts).set({ error }).where(eq(schema.scheduledPosts.id, post.id));
      continue;
    }
    await publish(post).catch((err) => console.warn(`[publicaciones] ${post.channel} ${post.id}: ${err.message}`));
  }
}

// ─── Slack: cualquier pieza, texto libre, canal y fecha elegidos ───────────

export type SlackPiece = { file: string; label: string; text: string; moment: Moment | null; suggestedAt: string };

/** Piezas del evento que se pueden mandar a Slack (imágenes), con un texto sugerido para cada una. */
export async function slackPieces(eventId: string): Promise<SlackPiece[]> {
  const [event] = await db.select().from(schema.events).where(eq(schema.events.id, eventId));
  if (!event) return [];
  const content = event.content as EventContent | null;
  const pieces = await db.select().from(schema.pieces).where(eq(schema.pieces.eventId, eventId)).orderBy(asc(schema.pieces.createdAt));
  const [first] = await db.select().from(schema.agendaItems).where(eq(schema.agendaItems.eventId, eventId)).orderBy(asc(schema.agendaItems.position)).limit(1);
  // Horario sugerido según el momento de la pieza; las piezas sin momento (cronograma, credenciales…), el día anterior
  const suggest = (m: Moment | null) =>
    (event.date ? suggestedTime(m ?? "antes", m ? event.date : addDays(event.date, 2), first?.startsAt, "slack") : new Date(Date.now() + 864e5)).toISOString();
  return pieces
    .filter((p) => p.file?.endsWith(".png"))
    .map((p) => {
      const file = p.file!;
      const label = (p.data as { label?: string }).label ?? file;
      const slack = content?.slack?.find((m) => file === `slack/${m.id}.png`);
      const post = content?.linkedin.find((l) => file.startsWith(`linkedin/${l.id}-`));
      const text = slack?.text ?? post?.post ?? `${label} · ${event.name}${event.hashtag ? ` ${event.hashtag}` : ""}`;
      const moment = slack?.moment ?? (post ? momentOf(post) : null);
      return { file, label, text, moment, suggestedAt: suggest(moment) };
    });
}

/** Programa una pieza en un canal de Slack. Sin conector, queda agendada para publicarla a mano. */
export async function scheduleSlackPost(input: { eventId: string; pieceFile: string; text: string; target: string; scheduledAt: Date }) {
  const piece = (await slackPieces(input.eventId)).find((p) => p.file === input.pieceFile);
  if (!piece) throw new Error("Esa pieza no existe en el evento");
  if (!input.text.trim()) throw new Error("Escribí el texto del mensaje");
  if (!input.target.trim()) throw new Error("Elegí el canal");
  if (Number.isNaN(input.scheduledAt.getTime())) throw new Error("Fecha inválida");
  const [row] = await db
    .insert(schema.scheduledPosts)
    .values({
      eventId: input.eventId,
      channel: "slack",
      moment: piece.moment,
      pieceFile: piece.file,
      pieceLabel: piece.label,
      text: input.text.trim(),
      target: normalizeChannel(input.target),
      scheduledAt: input.scheduledAt,
    })
    .returning();
  // Con la app de Slack conectada y la programación nativa activa, Slack la publica aunque la app esté cerrada
  if (slackStatus().connected && slackStatus().nativeSchedule) {
    await scheduleInSlack({ file: join(STORAGE_DIR, input.eventId, piece.file), text: row.text, channel: row.target!, at: row.scheduledAt })
      .then((r) => db.update(schema.scheduledPosts).set({ externalUrl: r.ref }).where(eq(schema.scheduledPosts.id, row.id)))
      .catch((err) => db.update(schema.scheduledPosts).set({ error: `Slack: ${err.message}` }).where(eq(schema.scheduledPosts.id, row.id)));
  }
  return row;
}

/** "#General " → "#general"; los ids de canal (C0123…) quedan como están. */
const normalizeChannel = (c: string) => {
  const t = c.trim();
  return /^[CG][A-Z0-9]{6,}$/.test(t) ? t : `#${t.replace(/^#/, "").toLowerCase().replace(/\s+/g, "-")}`;
};

/** Publicaciones de Slack del evento, de la próxima a la última. */
export async function slackSchedule(eventId: string) {
  return db
    .select()
    .from(schema.scheduledPosts)
    .where(and(eq(schema.scheduledPosts.eventId, eventId), eq(schema.scheduledPosts.channel, "slack"), ne(schema.scheduledPosts.status, "cancelled")))
    .orderBy(asc(schema.scheduledPosts.scheduledAt));
}

/** Canales sugeridos: los de SLACK_CHANNELS y los que ya se usaron. */
export async function knownSlackChannels() {
  const used = await db
    .selectDistinct({ target: schema.scheduledPosts.target })
    .from(schema.scheduledPosts)
    .where(and(eq(schema.scheduledPosts.channel, "slack"), isNotNull(schema.scheduledPosts.target)))
    .orderBy(desc(schema.scheduledPosts.target));
  const configured = (process.env.SLACK_CHANNELS ?? "").split(",").map((c) => c.trim()).filter(Boolean).map(normalizeChannel);
  return [...new Set([...configured, ...used.map((u) => u.target!)])].sort();
}

/** Marca una publicación como hecha a mano (sin conector). */
export async function markPublished(postId: string) {
  await db
    .update(schema.scheduledPosts)
    .set({ status: "published", publishedAt: new Date(), publishedVia: "manual", error: null })
    .where(and(eq(schema.scheduledPosts.id, postId), ne(schema.scheduledPosts.status, "cancelled")));
}
