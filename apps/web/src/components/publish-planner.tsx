"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type PlanItemView = {
  moment: "antes" | "durante" | "despues";
  headline: string;
  text: string;
  imageUrl: string;
  suggestedAt: string;
  scheduled: { id: string; status: string; scheduledAt: string; externalUrl: string | null; error: string | null; target: string | null } | null;
};

const MOMENT: Record<PlanItemView["moment"], { label: string; hint: string; className: string }> = {
  antes: { label: "Se viene", hint: "para que se agende", className: "bg-mint" },
  durante: { label: "En vivo", hint: "con el evento en marcha", className: "bg-yellow" },
  despues: { label: "Después", hint: "balance y gracias", className: "bg-[#f6c9dc]" },
};

const CHANNEL = {
  linkedin: { name: "LinkedIn", env: "LINKEDIN_ACCESS_TOKEN y LINKEDIN_AUTHOR_URN" },
  slack: { name: "Slack", env: "SLACK_BOT_TOKEN" },
};

/** ISO → valor de <input type="datetime-local"> en la hora del navegador. */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
const fmt = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function PublishPlanner({
  eventId,
  channel,
  items,
  connected,
  defaultTarget,
}: {
  eventId: string;
  channel: "linkedin" | "slack";
  items: PlanItemView[];
  connected: boolean;
  defaultTarget?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [times, setTimes] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((i) => [i.moment, toLocalInput(i.scheduled?.status === "scheduled" ? i.scheduled.scheduledAt : i.suggestedAt)])),
  );
  const [target, setTarget] = useState(items.find((i) => i.scheduled?.target)?.scheduled?.target ?? defaultTarget ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const meta = CHANNEL[channel];
  const pending = items.filter((i) => i.scheduled?.status === "scheduled").length;
  const published = items.filter((i) => i.scheduled?.status === "published").length;

  async function request(key: string, url: string, body: unknown) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo completar");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  const schedule = (moment: string) =>
    request(moment, `/api/eventos/${eventId}/publicaciones`, { channel, moment, scheduledAt: new Date(times[moment]).toISOString(), target });
  async function scheduleAll() {
    for (const i of items) if (i.scheduled?.status !== "published") await schedule(i.moment);
  }

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="btn-ink">
          {open ? "Cerrar" : `Programar en ${meta.name}`}
        </button>
        <span className="text-sm text-muted">
          {published ? `${published} publicadas · ` : ""}
          {pending ? `${pending} de ${items.length} programadas` : "Sin programar"}
        </span>
      </div>

      {open && (
        <div className="mt-4 border-[1.5px] border-ink bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-[1.5px] border-ink px-4 py-3">
            <p className="font-hand text-2xl font-bold leading-none">antes, durante y después</p>
            <span className={`sticker text-[11px] ${connected ? "bg-mint" : "bg-surface border border-ink/30"}`}>
              {connected ? `${meta.name} conectado` : `${meta.name} sin conectar`}
            </span>
          </div>
          {!connected && (
            <p className="border-b border-border px-4 py-2.5 text-sm text-muted">
              Podés programar igual: cuando venza, se publica apenas la app tenga {meta.env} en el <code className="font-mono text-xs">.env</code>.
            </p>
          )}
          {channel === "slack" && (
            <label className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 text-sm">
              <span className="label-mono">canal</span>
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="ID del canal, ej. C0123ABCD"
                className="min-w-0 flex-1 border-[1.5px] border-ink bg-surface px-2.5 py-1.5 font-mono text-xs focus:shadow-[3px_3px_0_var(--yellow)] focus:outline-none"
              />
            </label>
          )}

          <ol className="divide-y divide-border">
            {items.map((i) => {
              const m = MOMENT[i.moment];
              const s = i.scheduled;
              return (
                <li key={i.moment} className="grid gap-4 p-4 sm:grid-cols-[120px_minmax(0,1fr)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={i.imageUrl} alt={i.headline} className="w-full border border-ink/20 bg-[#ecebe5] object-contain" />
                  <div className="min-w-0 space-y-2.5">
                    <p className="flex flex-wrap items-baseline gap-2">
                      <span className={`sticker text-[11px] ${m.className}`}>{m.label}</span>
                      <span className="font-semibold">{i.headline}</span>
                      <span className="text-xs text-muted">{m.hint}</span>
                    </p>
                    <p className="line-clamp-2 text-sm text-muted">{i.text}</p>

                    {s?.status === "published" ? (
                      <p className="text-sm">
                        Publicado {s.externalUrl ? (
                          <a href={s.externalUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                            ver publicación
                          </a>
                        ) : null}
                      </p>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="datetime-local"
                          value={times[i.moment]}
                          onChange={(e) => setTimes({ ...times, [i.moment]: e.target.value })}
                          aria-label={`Fecha y hora de "${m.label}"`}
                          className="border-[1.5px] border-ink bg-surface px-2 py-1.5 font-mono text-xs"
                        />
                        <button type="button" onClick={() => schedule(i.moment)} disabled={busy !== null || !times[i.moment]} className="btn-line">
                          {busy === i.moment ? "Programando…" : s?.status === "scheduled" ? "Reprogramar" : "Programar"}
                        </button>
                        {s?.status === "scheduled" && (
                          <>
                            <button
                              type="button"
                              disabled={busy !== null || !connected}
                              onClick={() => request(`now-${i.moment}`, `/api/eventos/${eventId}/publicaciones/${s.id}`, { action: "publish" })}
                              className="label-mono text-ink underline underline-offset-4 disabled:opacity-40"
                            >
                              publicar ya
                            </button>
                            <button
                              type="button"
                              disabled={busy !== null}
                              onClick={() => request(`cancel-${i.moment}`, `/api/eventos/${eventId}/publicaciones/${s.id}`, { action: "cancel" })}
                              className="label-mono text-muted underline underline-offset-4 hover:text-ink"
                            >
                              cancelar
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    {s?.status === "scheduled" && <p className="text-xs text-green">Programado para el {fmt(s.scheduledAt)}</p>}
                    {s?.error && <p className="text-xs text-orange">{s.error}</p>}
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t-[1.5px] border-ink px-4 py-3">
            <p className="text-xs text-muted">Horarios sugeridos según la fecha del evento; podés moverlos.</p>
            <button type="button" onClick={scheduleAll} disabled={busy !== null || (channel === "slack" && !target.trim() && connected)} className="btn-ink">
              Programar las {items.length}
            </button>
          </div>
          {error && <p className="px-4 pb-3 text-sm text-orange">{error}</p>}
        </div>
      )}
    </div>
  );
}
