import "server-only";
import { db, schema } from "@flock/db";
import { MOMENT_LABEL, type Moment } from "@flock/templates";
import { desc, ne } from "drizzle-orm";
import { publishingPlan, type Channel } from "./schedule";

export const TZ = "America/Argentina/Buenos_Aires";

export type CalendarItem = {
  key: string;
  kind: "event" | "scheduled" | "suggested";
  channel: Channel | "event";
  at: Date;
  day: string; // YYYY-MM-DD en hora de Buenos Aires
  time: string | null; // HH:mm
  title: string;
  moment?: Moment;
  status?: string; // estado de la programación
  target?: string; // canal de Slack
  eventId: string;
  eventName: string;
};

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("es-AR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
export const dayKey = (d: Date) => dayFmt.format(d);

/**
 * Todo lo que pasa en el calendario: los días de evento, las publicaciones programadas
 * y las potenciales (los momentos que todavía no se programaron, en su horario sugerido).
 */
export async function calendarItems(): Promise<CalendarItem[]> {
  const events = await db.select().from(schema.events).orderBy(desc(schema.events.createdAt));
  const rows = await db.select().from(schema.scheduledPosts).where(ne(schema.scheduledPosts.status, "cancelled"));
  const today = dayKey(new Date());
  const items: CalendarItem[] = [];

  for (const event of events) {
    if (!event.date) continue;
    items.push({
      key: `event-${event.id}`,
      kind: "event",
      channel: "event",
      at: new Date(`${event.date}T12:00:00-03:00`),
      day: event.date,
      time: null,
      title: event.name,
      eventId: event.id,
      eventName: event.name,
    });
    // Las sugerencias solo tienen sentido para eventos que todavía no terminaron de comunicarse
    const finished = event.date < addDays(today, -1);
    const mine = rows.filter((r) => r.eventId === event.id);
    // Todo lo programado (por momento o una pieza suelta)
    for (const r of mine)
      items.push({
        key: r.id,
        kind: "scheduled",
        channel: r.channel,
        at: r.scheduledAt,
        day: dayKey(r.scheduledAt),
        time: timeFmt.format(r.scheduledAt),
        title: r.pieceLabel ?? r.pieceFile,
        moment: (r.moment as Moment | null) ?? undefined,
        status: r.status,
        target: r.target ?? undefined,
        eventId: event.id,
        eventName: event.name,
      });
    // Lo que conviene programar y todavía no se programó
    if (finished) continue;
    for (const channel of ["linkedin", "slack"] as Channel[]) {
      for (const p of await publishingPlan(event.id, channel)) {
        if (mine.some((r) => r.channel === channel && r.moment === p.moment)) continue;
        const at = new Date(p.suggestedAt);
        items.push({
          key: `${event.id}-${channel}-${p.moment}`,
          kind: "suggested",
          channel,
          at,
          day: dayKey(at),
          time: timeFmt.format(at),
          title: p.headline,
          moment: p.moment,
          eventId: event.id,
          eventName: event.name,
        });
      }
    }
  }
  return items.sort((a, b) => +a.at - +b.at);
}

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const momentLabel = (m?: Moment) => (m ? MOMENT_LABEL[m] : "");
