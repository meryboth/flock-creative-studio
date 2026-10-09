import "server-only";
import { db, schema } from "@flock/db";
import { MOMENT_LABEL, type Moment } from "@flock/templates";
import { desc } from "drizzle-orm";
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
    for (const channel of ["linkedin", "slack"] as Channel[]) {
      for (const p of await publishingPlan(event.id, channel)) {
        const s = p.scheduled;
        if (s) {
          items.push({
            key: s.id,
            kind: "scheduled",
            channel,
            at: s.scheduledAt,
            day: dayKey(s.scheduledAt),
            time: timeFmt.format(s.scheduledAt),
            title: p.headline,
            moment: p.moment,
            status: s.status,
            eventId: event.id,
            eventName: event.name,
          });
        } else if (!finished) {
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
  }
  return items.sort((a, b) => +a.at - +b.at);
}

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const momentLabel = (m?: Moment) => (m ? MOMENT_LABEL[m] : "");
