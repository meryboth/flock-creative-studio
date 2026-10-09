"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PixelLoader } from "./processing";

export type StudioPiece = { file: string; url: string; kind: "png" | "txt" | "html" | "pdf"; label: string; text?: string; previewUrl?: string; badge?: string };
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

const SUGGESTIONS = ["Hacé el título más grande", "Probá con fondo negro", "Sacá el hashtag de las credenciales", "Otra variante del visual"];

export function Studio({ eventId, groups, history, running }: { eventId: string; groups: StudioGroup[]; history: StudioHistoryItem[]; running: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<StudioPiece | null>(null);
  const [draft, setDraft] = useState("");
  const [proposal, setProposal] = useState<(Proposal & { message: string }) | null>(null);
  const [scope, setScope] = useState<Scope | null>(null);
  const [busy, setBusy] = useState<"thinking" | "applying" | "undoing" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

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
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* ─── Galería seleccionable ─────────────────────────────── */}
      <div className={`min-w-0 space-y-14 transition-opacity ${running ? "pointer-events-none opacity-50" : ""}`}>
        {groups.map((g) => (
          <section key={g.id}>
            <h2 className="mb-6 flex items-baseline gap-3">
              <span className="boxed text-lg font-semibold">{g.title}</span>
              <span className="label-mono text-muted">{g.pieces.length} archivos</span>
            </h2>
            {g.toolbar}
            <div className="grid gap-7 sm:grid-cols-2 xl:grid-cols-3">
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
                      onClick={() => setSelected(isSelected ? null : p)}
                      aria-pressed={isSelected}
                      aria-label={selectable ? `Elegir ${p.label} para editar` : p.label}
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
                    <div className="flex items-center justify-between gap-2 px-1 pb-1 pt-2.5">
                      <span className="flex min-w-0 items-center gap-2">
                        {p.badge && <span className="sticker shrink-0 bg-mint text-[11px]">{p.badge}</span>}
                        <span className="truncate font-mono text-xs text-muted">{p.file.split("/").pop()}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {isSelected && <span className="sticker bg-yellow text-[11px]">elegida</span>}
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

      {/* ─── Chat de edición ───────────────────────────────────── */}
      <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
        <div className="flex max-h-[calc(100vh-3rem)] flex-col border-[1.5px] border-ink bg-surface">
          <div className="flex items-center justify-between gap-3 border-b-[1.5px] border-ink bg-yellow px-4 py-3">
            <p className="font-hand text-2xl font-bold leading-none">chat de edición</p>
            <button type="button" onClick={undo} disabled={!canUndo || busy !== null || running} className="label-mono text-ink underline underline-offset-4 disabled:opacity-40">
              deshacer último
            </button>
          </div>

          <div ref={endRef} className="flex-1 space-y-4 overflow-y-auto p-4 text-sm" aria-live="polite">
            {!history.length && !proposal && (
              <div className="space-y-3">
                <p className="text-muted">
                  Elegí una pieza (o ninguna, para un cambio general) y contame qué querés cambiar. Te muestro qué voy a hacer y elegís a qué piezas se aplica.
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
                  quitar
                </button>
              </p>
            ) : (
              <p className="text-xs text-muted">Sin pieza elegida: el cambio es general.</p>
            )}
            <div className="flex gap-2">
              <textarea
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
