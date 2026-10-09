import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { addDays, calendarItems, dayKey, momentLabel, type CalendarItem } from "@/lib/calendar";

const CHANNELS = [
  { id: "linkedin", label: "LinkedIn", color: "var(--violet)" },
  { id: "slack", label: "Slack", color: "var(--pink)" },
  { id: "mail", label: "Mail", color: "var(--green)", soon: true },
] as const;
const COLOR: Record<string, string> = { linkedin: "var(--violet)", slack: "var(--pink)", mail: "var(--green)" };
const STATUS: Record<string, string> = { scheduled: "programada", publishing: "publicando", published: "publicada", failed: "falló" };
const WEEKDAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

export default function CalendarPage({ searchParams }: PageProps<"/calendario">) {
  return (
    <main className="px-5 py-12 sm:px-10">
      <Suspense fallback={<p className="font-hand text-2xl text-muted">armando el calendario…</p>}>
        <Calendar searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Calendar({ searchParams }: { searchParams: PageProps<"/calendario">["searchParams"] }) {
  const params = await searchParams;
  await connection(); // "hoy" se calcula en cada pedido
  const today = dayKey(new Date());
  const month = typeof params.mes === "string" && /^\d{4}-\d{2}$/.test(params.mes) ? params.mes : today.slice(0, 7);
  const channel = typeof params.canal === "string" && ["linkedin", "slack"].includes(params.canal) ? params.canal : null;

  const all = await calendarItems();
  const items = all.filter((i) => !channel || i.channel === channel || i.kind === "event");
  // en cada día, primero el evento y después las publicaciones por hora
  const byDay = Map.groupBy(
    [...items].sort((a, b) => Number(b.kind === "event") - Number(a.kind === "event") || +a.at - +b.at),
    (i) => i.day,
  );

  // Grilla del mes, de lunes a domingo
  const first = `${month}-01`;
  const offset = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const start = addDays(first, -offset);
  const nextMonth = addDays(addDays(first, 32).slice(0, 7) + "-01", 0);
  const prevMonth = addDays(first, -1).slice(0, 7);
  const weeks = Math.ceil((offset + Number(addDays(nextMonth, -1).slice(8, 10))) / 7);
  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
  const rawLabel = new Date(`${first}T12:00:00Z`).toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "UTC" });
  const monthLabel = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);

  const inMonth = items.filter((i) => i.day.startsWith(month) && i.kind !== "event");
  const href = (q: { mes?: string; canal?: string | null }) => {
    const sp = new URLSearchParams();
    const m = q.mes ?? month;
    const c = q.canal === undefined ? channel : q.canal;
    if (m !== today.slice(0, 7)) sp.set("mes", m);
    if (c) sp.set("canal", c);
    return `/calendario${sp.size ? `?${sp}` : ""}`;
  };

  return (
    <>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Calendario</h1>
          <p className="mt-3 max-w-2xl text-muted">
            Qué se publica y cuándo, en todos los eventos: lo programado y lo que conviene programar según la fecha de cada evento.
          </p>
        </div>
        <nav aria-label="Mes" className="flex items-center gap-2">
          <Link href={href({ mes: prevMonth })} className="btn-line" aria-label="Mes anterior">
            ←
          </Link>
          <p className="min-w-44 text-center font-hand text-3xl font-bold leading-none">{monthLabel}</p>
          <Link href={href({ mes: nextMonth.slice(0, 7) })} className="btn-line" aria-label="Mes siguiente">
            →
          </Link>
          {month !== today.slice(0, 7) && (
            <Link href={href({ mes: today.slice(0, 7) })} className="label-mono ml-2 text-muted underline underline-offset-4 hover:text-ink">
              hoy
            </Link>
          )}
        </nav>
      </header>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Canal">
          <FilterLink href={href({ canal: null })} active={!channel}>
            Todos
          </FilterLink>
          {CHANNELS.map((c) =>
            "soon" in c ? (
              <span key={c.id} className="border-[1.5px] border-dashed border-ink/30 px-2.5 py-1 text-xs text-muted" title="Todavía no hay piezas ni conector de mail">
                {c.label} · próximamente
              </span>
            ) : (
              <FilterLink key={c.id} href={href({ canal: c.id })} active={channel === c.id} color={c.color}>
                {c.label}
              </FilterLink>
            ),
          )}
        </div>
        <p className="flex flex-wrap items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-5 bg-ink" /> programada
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-5 border-[1.5px] border-dashed border-ink" /> sugerida, sin programar
          </span>
          <span className="flex items-center gap-1.5">
            <span className="sticker bg-yellow px-1.5 py-0 text-[10px]">evento</span> día del evento
          </span>
        </p>
      </div>

      {/* Grilla del mes (desde tablet) */}
      <div className="hidden border-l-[1.5px] border-t-[1.5px] border-ink bg-surface sm:grid sm:grid-cols-7">
        {WEEKDAYS.map((d) => (
          <p key={d} className="label-mono border-b-[1.5px] border-r-[1.5px] border-ink bg-background px-2 py-1.5 text-muted">
            {d}
          </p>
        ))}
        {days.map((day) => {
          const out = !day.startsWith(month);
          const list = byDay.get(day) ?? [];
          return (
            <div key={day} className={`min-h-32 min-w-0 space-y-1 border-b-[1.5px] border-r-[1.5px] border-ink p-1.5 ${out ? "bg-background/60" : ""}`}>
              <p className={`text-right font-mono text-xs ${day === today ? "font-bold" : out ? "text-muted/50" : "text-muted"}`}>
                {day === today ? <span className="bg-yellow px-1.5 py-0.5 text-ink">{Number(day.slice(8))}</span> : Number(day.slice(8))}
              </p>
              {list.map((i) => (
                <Chip key={i.key} item={i} dim={out} />
              ))}
            </div>
          );
        })}
      </div>

      {/* Lista del mes (celular) */}
      <ol className="space-y-5 sm:hidden">
        {days
          .filter((d) => d.startsWith(month) && byDay.has(d))
          .map((day) => (
            <li key={day}>
              <p className="label-mono mb-2 text-muted">
                {new Date(`${day}T12:00:00Z`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
              </p>
              <div className="space-y-1.5">
                {byDay.get(day)!.map((i) => (
                  <Chip key={i.key} item={i} />
                ))}
              </div>
            </li>
          ))}
      </ol>

      {!inMonth.length && (
        <p className="mt-6 font-hand text-2xl text-muted">
          Nada para publicar este mes. Programá desde la página de cada evento, en los grupos de LinkedIn y Slack.
        </p>
      )}
    </>
  );
}

function FilterLink({ href, active, color, children }: { href: string; active: boolean; color?: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`flex items-center gap-1.5 border-[1.5px] border-ink px-2.5 py-1 text-xs ${active ? "bg-ink text-white" : "bg-surface hover:bg-yellow"}`}
    >
      {color && <span className="inline-block size-2.5 rounded-full" style={{ background: color }} />}
      {children}
    </Link>
  );
}

function Chip({ item, dim }: { item: CalendarItem; dim?: boolean }) {
  if (item.kind === "event")
    return (
      <Link href={`/eventos/${item.eventId}`} className={`sticker block truncate bg-yellow text-[11px] hover:bg-mint ${dim ? "opacity-50" : ""}`}>
        {item.title}
      </Link>
    );
  const color = COLOR[item.channel];
  const scheduled = item.kind === "scheduled";
  return (
    <Link
      href={`/eventos/${item.eventId}`}
      title={`${item.eventName} — ${item.title}${scheduled ? ` (${STATUS[item.status!] ?? item.status})` : " (sugerida)"}`}
      className={`block min-w-0 border-[1.5px] px-1.5 py-1 text-[11px] leading-tight transition hover:-translate-y-px ${dim ? "opacity-50" : ""} ${scheduled ? "text-white" : "border-dashed bg-surface text-ink"}`}
      style={scheduled ? { background: color, borderColor: color } : { borderColor: color }}
    >
      <span className="flex items-baseline justify-between gap-1">
        <span className="truncate font-semibold">{item.channel === "linkedin" ? "LinkedIn" : "Slack"}</span>
        <span className="shrink-0 font-mono opacity-80">{item.time}</span>
      </span>
      <span className="block truncate opacity-90">
        {momentLabel(item.moment)} · {item.eventName}
      </span>
      {scheduled && item.status !== "scheduled" && <span className="block font-mono text-[10px] uppercase">{STATUS[item.status!] ?? item.status}</span>}
    </Link>
  );
}
