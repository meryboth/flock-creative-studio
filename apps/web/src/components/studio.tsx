"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PixelLoader } from "./processing";
import { SCHEDULE_SLACK_EVENT } from "./slack-scheduler";

export type StudioPiece = { file: string; url: string; kind: "png" | "txt" | "html" | "pdf"; label: string; text?: string; previewUrl?: string; badge?: string; review?: string[] };
// toolbar: accionables del grupo (programar publicaciones, descargar, sincronizar nómina)
export type StudioGroup = { id: string; title: string; pieces: StudioPiece[]; toolbar?: React.ReactNode };
export type StudioHistoryItem = { id: string; message: string; reply: string | null; operations: string[]; status: string; pieceLabel?: string };

type Scope = { kind: "all" } | { kind: "group"; group: string } | { kind: "piece"; file: string };
type Proposal = {
  id: string;
  reply: string;
  operations: { label: string }[];
  suggestedScope: "all" | "group" | "piece";
  scopes: { scope: Scope; label: string; count: number }[];
  textOnly: boolean;
};

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  applied: { label: "aplicado", className: "bg-mint" },
  discarded: { label: "descartado", className: "bg-surface" },
  reverted: { label: "deshecho", className: "bg-yellow" },
  proposed: { label: "sin aplicar", className: "bg-surface" },
};

const SUGGESTIONS = ["Hacé el título más grande", "Probá con bloques de color", "Que el nombre del evento sea gigante", "Sacá el hashtag de las credenciales"];

export function Studio({ eventId, groups, history, running }: { eventId: string; groups: StudioGroup[]; history: StudioHistoryItem[]; running: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<StudioPiece | null>(null);
  const [draft, setDraft] = useState("");
  const [proposal, setProposal] = useState<(Proposal & { message: string }) | null>(null);
  const [scope, setScope] = useState<Scope | null>(null);
  const [busy, setBusy] = useState<"thinking" | "applying" | "undoing" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /** Abre el chat sobre una pieza (o general, sin pieza) y deja el cursor en el campo de texto. */
  function openChat(piece: StudioPiece | null) {
    setSelected(piece);
    setChatOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  useEffect(() => {
    if (!chatOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setChatOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatOpen]);

  useEffect(() => {
    const box = endRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [history.length, proposal, busy]);

  async function send(message: string) {
    if (!message.trim() || busy) return;
    setBusy("thinking");
    setError(null);
    setProposal(null);
    try {
      const res = await fetch(`/api/eventos/${eventId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, pieceFile: selected?.file ?? null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo interpretar el pedido");
      setProposal({ ...data, message });
      // Alcance sugerido por la IA (los cambios de texto son siempre de la pieza)
      const kind = data.textOnly ? "piece" : data.suggestedScope;
      setScope((data.scopes as Proposal["scopes"]).find((s) => s.scope.kind === kind)?.scope ?? data.scopes[0].scope);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function decide(action: "apply" | "discard") {
    if (!proposal) return;
    setBusy(action === "apply" ? "applying" : null);
    setError(null);
    try {
      const res = await fetch(`/api/eventos/${eventId}/changes/${proposal.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, scope }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo aplicar el cambio");
      setProposal(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function undo() {
    setBusy("undoing");
    setError(null);
    const res = await fetch(`/api/eventos/${eventId}/undo`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error ?? "No se pudo deshacer");
    setBusy(null);
    router.refresh();
  }

  const canUndo = history.some((h) => h.status === "applied");

  return (
    <div>
      {/* ─── Galería seleccionable ─────────────────────────────── */}
      <div className={`min-w-0 space-y-14 transition-opacity ${running ? "pointer-events-none opacity-50" : ""}`}>
        {groups.map((g) => (
          <section key={g.id}>
            <h2 className="mb-6 flex items-baseline gap-3">
              <span className="boxed text-lg font-semibold">{g.title}</span>
              <span className="label-mono text-muted">{g.pieces.length} archivos</span>
            </h2>
            {g.toolbar}
            <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {g.pieces.map((p) => {
                const isSelected = selected?.file === p.file;
                const selectable = p.kind === "png" || p.kind === "html";
                return (
                  <div
                    key={p.file}
                    className={`relative border-[1.5px] bg-surface p-2 transition ${isSelected ? "taped border-ink shadow-[6px_6px_0_var(--yellow)]" : "border-ink/60 hover:border-ink"}`}
                  >
                    <button
                      type="button"
                      disabled={!selectable}
                      onClick={() => openChat(p)}
                      aria-label={selectable ? `Iterar ${p.label} en el chat` : p.label}
                      className="block w-full text-left disabled:cursor-default"
                    >
                      <div className="flex min-h-48 items-center justify-center overflow-hidden bg-[#ecebe5]">
                        {p.kind === "png" || p.kind === "html" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.previewUrl ?? p.url} alt={p.label} loading="lazy" className="max-h-72 w-auto max-w-full object-contain object-top" />
                        ) : p.kind === "txt" ? (
                          <pre className="max-h-72 overflow-auto whitespace-pre-wrap p-4 text-left font-sans text-sm leading-relaxed">{p.text}</pre>
                        ) : (
                          <span className="font-hand text-2xl text-muted">PDF para imprimir</span>
                        )}
                      </div>
                    </button>
                    {p.review && (
                      <div role="note" className="mt-2 border-l-[3px] border-orange bg-orange/10 px-2.5 py-1.5 text-xs">
                        <p className="label-mono text-orange">revisar</p>
                        <ul className="mt-0.5 space-y-0.5">
                          {p.review.map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 px-1 pb-1 pt-2.5">
                      <span className="flex min-w-0 items-center gap-2">
                        {p.badge && <span className="sticker shrink-0 bg-mint text-[11px]">{p.badge}</span>}
                        <span className="truncate font-mono text-xs text-muted">{p.file.split("/").pop()}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {selectable && (
                          <button
                            type="button"
                            onClick={() => openChat(p)}
                            aria-label={`Abrir el chat sobre ${p.label}`}
                            className={`flex items-center gap-1.5 border-[1.5px] border-ink px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider transition ${isSelected && chatOpen ? "bg-yellow" : "bg-surface hover:bg-yellow"}`}
                          >
                            <ChatIcon />
                            chat
                          </button>
                        )}
                        {p.kind === "png" && (
                          <button
                            type="button"
                            onClick={() => window.dispatchEvent(new CustomEvent(SCHEDULE_SLACK_EVENT, { detail: p.file }))}
                            className="label-mono text-muted underline underline-offset-4 hover:text-ink"
                            aria-label={`Programar ${p.label} en Slack`}
                          >
                            slack
                          </button>
                        )}
                        <a href={p.url} target="_blank" rel="noreferrer" className="label-mono text-muted underline underline-offset-4 hover:text-ink">
                          abrir
                        </a>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* ─── Chat de edición: panel lateral que se abre desde cada pieza ─── */}
      {!chatOpen && (
        <button type="button" onClick={() => openChat(null)} className="btn-ink fixed bottom-6 right-6 z-30 shadow-[4px_4px_0_var(--yellow)]">
          <ChatIcon /> Chat de edición
        </button>
      )}
      {chatOpen && <div className="fixed inset-0 z-40 bg-ink/25 lg:bg-transparent" onClick={() => setChatOpen(false)} aria-hidden />}
      <aside
        aria-label="Chat de edición"
        aria-hidden={!chatOpen}
        inert={!chatOpen}
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-[440px] transition-transform duration-200 ease-out ${chatOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex h-full flex-col border-l-[1.5px] border-ink bg-surface shadow-[-12px_0_40px_-20px_rgba(0,0,0,0.45)]">
          <div className="flex items-center justify-between gap-3 border-b-[1.5px] border-ink bg-yellow px-4 py-3">
            <p className="font-hand text-2xl font-bold leading-none">chat de edición</p>
            <span className="flex items-center gap-4">
              <button type="button" onClick={undo} disabled={!canUndo || busy !== null || running} className="label-mono text-ink underline underline-offset-4 disabled:opacity-40">
                deshacer último
              </button>
              <button type="button" onClick={() => setChatOpen(false)} aria-label="Cerrar el chat" className="label-mono text-ink underline underline-offset-4">
                cerrar
              </button>
            </span>
          </div>
          {selected && (
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selected.previewUrl ?? selected.url} alt="" className="h-16 w-16 shrink-0 border border-ink/20 bg-[#ecebe5] object-contain" />
              <div className="min-w-0">
                <p className="label-mono text-muted">iterando sobre</p>
                <p className="truncate font-semibold">{selected.label}</p>
              </div>
            </div>
          )}

          <div ref={endRef} className="flex-1 space-y-4 overflow-y-auto p-4 text-sm" aria-live="polite">
            {!history.length && !proposal && (
              <div className="space-y-3">
                <p className="text-muted">
                  Contame qué querés cambiar. Abrí el chat desde una pieza para iterar solo esa, o desde acá para un cambio general. Te muestro qué voy a hacer y elegís a qué piezas se aplica.
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => send(s)} className="sticker bg-mint text-xs hover:bg-yellow">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {history.map((h) => (
              <div key={h.id} className="space-y-2">
                <p className="ml-6 border-[1.5px] border-ink bg-background px-3 py-2">
                  {h.message}
                  {h.pieceLabel && <span className="mt-1 block text-xs text-muted">sobre: {h.pieceLabel}</span>}
                </p>
                {h.reply && <p className="mr-6 text-muted">{h.reply}</p>}
                <div className="mr-6 flex flex-wrap items-center gap-1.5">
                  {h.operations.map((o) => (
                    <span key={o} className="border border-ink/40 bg-background px-1.5 py-0.5 font-mono text-[11px]">
                      {o}
                    </span>
                  ))}
                  <span className={`sticker text-[11px] ${STATUS_LABEL[h.status]?.className ?? ""}`}>{STATUS_LABEL[h.status]?.label ?? h.status}</span>
                </div>
              </div>
            ))}

            {busy === "thinking" && (
              <p className="flex items-center gap-2 text-muted">
                <PixelLoader size={14} /> interpretando el pedido…
              </p>
            )}

            {proposal && (
              <div className="space-y-3">
                <p className="ml-6 border-[1.5px] border-ink bg-background px-3 py-2">{proposal.message}</p>
                <div className="taped -rotate-[0.4deg] space-y-3 bg-yellow p-4">
                  <p>{proposal.reply}</p>
                  {proposal.operations.length > 0 ? (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {proposal.operations.map((o) => (
                          <span key={o.label} className="border-[1.5px] border-ink bg-surface px-1.5 py-0.5 font-mono text-[11px]">
                            {o.label}
                          </span>
                        ))}
                      </div>
                      {!proposal.textOnly && (
                        <fieldset>
                          <legend className="label-mono mb-1.5">aplicar a</legend>
                          <div className="flex flex-wrap gap-1.5">
                            {proposal.scopes.map((s) => {
                              const active = JSON.stringify(s.scope) === JSON.stringify(scope);
                              return (
                                <button
                                  key={s.label}
                                  type="button"
                                  onClick={() => setScope(s.scope)}
                                  aria-pressed={active}
                                  className={`border-[1.5px] border-ink px-2 py-1 text-xs ${active ? "bg-ink text-white" : "bg-surface hover:bg-background"}`}
                                >
                                  {s.label} <span className="opacity-70">({s.count})</span>
                                </button>
                              );
                            })}
                          </div>
                        </fieldset>
                      )}
                      <div className="flex gap-2">
                        <button type="button" onClick={() => decide("apply")} disabled={busy !== null} className="btn-ink">
                          {busy === "applying" ? "Aplicando…" : "Aplicar"}
                        </button>
                        <button type="button" onClick={() => decide("discard")} disabled={busy !== null} className="btn-line">
                          Descartar
                        </button>
                      </div>
                    </>
                  ) : (
                    <button type="button" onClick={() => setProposal(null)} className="btn-line">
                      Entendido
                    </button>
                  )}
                </div>
              </div>
            )}

            {running && (
              <p className="flex items-center gap-2 text-muted">
                <PixelLoader size={14} /> regenerando las piezas con los cambios…
              </p>
            )}
            {error && <p className="text-orange">{error}</p>}
          </div>

          <form
            className="space-y-2 border-t-[1.5px] border-ink p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
          >
            {selected ? (
              <p className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate">
                  sobre: <span className="font-semibold">{selected.label}</span>
                </span>
                <button type="button" onClick={() => setSelected(null)} className="label-mono shrink-0 text-muted underline">
                  cambio general
                </button>
              </p>
            ) : (
              <p className="text-xs text-muted">Sin pieza elegida: el cambio es general. Para iterar una pieza, tocá «chat» en su tarjeta.</p>
            )}
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(draft);
                  }
                }}
                rows={2}
                placeholder="Ej: la flor más chica y el título en mayúsculas"
                aria-label="Pedido de cambio"
                disabled={running}
                className="min-w-0 flex-1 resize-none border-[1.5px] border-ink bg-surface px-3 py-2 text-sm placeholder:text-muted/60 focus:shadow-[3px_3px_0_var(--yellow)] focus:outline-none"
              />
              <button type="submit" disabled={!draft.trim() || busy !== null || running} className="btn-ink self-stretch">
                Enviar
              </button>
            </div>
          </form>
        </div>
      </aside>
    </div>
  );
}

function ChatIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v6a1.5 1.5 0 0 1-1.5 1.5H7l-3.5 3v-3h0A1.5 1.5 0 0 1 2 9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
