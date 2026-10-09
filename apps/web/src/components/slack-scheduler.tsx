"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type SlackPieceView = { file: string; label: string; text: string; imageUrl: string; suggestedAt: string };
export type SlackPostView = {
  id: string;
  pieceLabel: string;
  imageUrl: string;
  text: string;
  target: string | null;
  scheduledAt: string;
  status: string;
  error: string | null;
  publishedVia: string | null;
};

/** Evento para abrir el panel con una pieza elegida desde la galería. */
export const SCHEDULE_SLACK_EVENT = "flock:programar-slack";

const STATUS: Record<string, { label: string; className: string }> = {
  scheduled: { label: "programada", className: "bg-yellow" },
  publishing: { label: "publicando", className: "bg-yellow" },
  published: { label: "publicada", className: "bg-mint" },
  failed: { label: "falló", className: "bg-[#f6c9dc]" },
};

function toLocalInput(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
const fmt = (iso: string) => new Date(iso).toLocaleString("es-AR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function SlackScheduler({
  eventId,
  pieces,
  posts,
  channels,
  connected,
}: {
  eventId: string;
  pieces: SlackPieceView[];
  posts: SlackPostView[];
  channels: string[];
  connected: boolean;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(pieces[0]?.file ?? "");
  const piece = pieces.find((p) => p.file === file) ?? pieces[0];
  const [text, setText] = useState(piece?.text ?? "");
  const [target, setTarget] = useState(channels[0] ?? "");
  const [when, setWhen] = useState(piece ? toLocalInput(piece.suggestedAt) : "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function choose(f: string) {
    const p = pieces.find((x) => x.file === f);
    if (!p) return;
    setFile(f);
    setText(p.text);
    setWhen(toLocalInput(p.suggestedAt));
  }

  // "programar en Slack" desde una tarjeta de la galería
  useEffect(() => {
    const onPick = (e: Event) => {
      choose((e as CustomEvent<string>).detail);
      setOpen(true);
      requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    };
    window.addEventListener(SCHEDULE_SLACK_EVENT, onPick);
    return () => window.removeEventListener(SCHEDULE_SLACK_EVENT, onPick);
  });

  async function post(key: string, url: string, body: unknown) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo completar");
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function schedule(e: React.FormEvent) {
    e.preventDefault();
    const ok = await post("new", `/api/eventos/${eventId}/slack`, { pieceFile: file, text, target, scheduledAt: new Date(when).toISOString() });
    if (ok) setOpen(false);
  }

  async function copy(id: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  const pending = posts.filter((p) => p.status === "scheduled").length;

  return (
    <div ref={ref} className="mb-6 scroll-mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="btn-ink">
          {open ? "Cerrar" : "Programar en Slack"}
        </button>
        <span className="text-sm text-muted">{pending ? `${pending} programadas` : "Sin programar"}</span>
        <span className={`sticker text-[11px] ${connected ? "bg-mint" : "border border-ink/30 bg-surface"}`}>
          {connected ? "Slack conectado" : "Slack sin conectar · publicación manual"}
        </span>
      </div>

      {open && (
        <form onSubmit={schedule} className="mt-4 border-[1.5px] border-ink bg-surface">
          <div className="border-b-[1.5px] border-ink px-4 py-3">
            <p className="font-hand text-2xl font-bold leading-none">nueva publicación</p>
            {!connected && (
              <p className="mt-1.5 text-sm text-muted">
                Slack todavía no está conectado: queda agendada y a la hora te avisa para publicarla a mano (descargás la imagen y copiás el texto).
              </p>
            )}
          </div>
          <div className="grid gap-5 p-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {piece && <img src={piece.imageUrl} alt={piece.label} className="w-full border border-ink/20 bg-[#ecebe5] object-contain" />}
              <label className="block text-sm">
                <span className="label-mono mb-1 block">pieza</span>
                <select value={file} onChange={(e) => choose(e.target.value)} className="w-full border-[1.5px] border-ink bg-surface px-2 py-1.5 text-sm">
                  {pieces.map((p) => (
                    <option key={p.file} value={p.file}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="min-w-0 space-y-3">
              <label className="block text-sm">
                <span className="label-mono mb-1 block">mensaje</span>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={5}
                  required
                  className="w-full resize-y border-[1.5px] border-ink bg-surface px-3 py-2 text-sm focus:shadow-[3px_3px_0_var(--yellow)] focus:outline-none"
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <label className="min-w-48 flex-1 text-sm">
                  <span className="label-mono mb-1 block">canal o grupo</span>
                  <input
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    list="slack-channels"
                    placeholder="#eventos"
                    required
                    className="w-full border-[1.5px] border-ink bg-surface px-2.5 py-1.5 font-mono text-sm focus:shadow-[3px_3px_0_var(--yellow)] focus:outline-none"
                  />
                  <datalist id="slack-channels">
                    {channels.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </label>
                <label className="text-sm">
                  <span className="label-mono mb-1 block">día y hora</span>
                  <input
                    type="datetime-local"
                    value={when}
                    onChange={(e) => setWhen(e.target.value)}
                    required
                    className="border-[1.5px] border-ink bg-surface px-2 py-1.5 font-mono text-sm"
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" disabled={busy !== null} className="btn-ink">
                  {busy === "new" ? "Programando…" : "Programar"}
                </button>
                {error && <p className="text-sm text-orange">{error}</p>}
              </div>
            </div>
          </div>
        </form>
      )}

      {posts.length > 0 && (
        <ol className="mt-4 divide-y divide-border border-[1.5px] border-ink bg-surface">
          {posts.map((p) => {
            const st = STATUS[p.status] ?? { label: p.status, className: "bg-surface" };
            const due = p.status === "scheduled" && new Date(p.scheduledAt) <= new Date();
            return (
              <li key={p.id} className="grid gap-3 p-3 sm:grid-cols-[96px_minmax(0,1fr)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imageUrl} alt={p.pieceLabel} className="w-full border border-ink/20 bg-[#ecebe5] object-contain" />
                <div className="min-w-0 space-y-1.5 text-sm">
                  <p className="flex flex-wrap items-baseline gap-2">
                    <span className={`sticker text-[11px] ${due ? "bg-orange text-white" : st.className}`}>{due ? "para publicar" : st.label}</span>
                    <span className="font-mono">{p.target}</span>
                    <span className="text-muted">{fmt(p.scheduledAt)}</span>
                    {p.publishedVia === "manual" && <span className="text-xs text-muted">(a mano)</span>}
                  </p>
                  <p className="truncate font-semibold">{p.pieceLabel}</p>
                  <p className="line-clamp-2 text-muted">{p.text}</p>
                  {p.error && p.status !== "published" && <p className="text-xs text-orange">{p.error}</p>}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                    <a href={p.imageUrl} download className="label-mono underline underline-offset-4">
                      descargar imagen
                    </a>
                    <button type="button" onClick={() => copy(p.id, p.text)} className="label-mono underline underline-offset-4">
                      {copied === p.id ? "copiado" : "copiar texto"}
                    </button>
                    {p.status !== "published" && (
                      <>
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => post(`done-${p.id}`, `/api/eventos/${eventId}/publicaciones/${p.id}`, { action: "published" })}
                          className="label-mono underline underline-offset-4"
                        >
                          marcar publicada
                        </button>
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => post(`cancel-${p.id}`, `/api/eventos/${eventId}/publicaciones/${p.id}`, { action: "cancel" })}
                          className="label-mono text-muted underline underline-offset-4 hover:text-ink"
                        >
                          cancelar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
