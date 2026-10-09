"use client";

import { useEffect, useState } from "react";
import { PixelLoader, useElapsed } from "./processing";

type PieceState = { status: "queued" | "working" | "done" | "failed"; round: number; score: number | null };
type Progress = { status: "working" | "done" | "failed"; pieces: Record<string, PieceState>; error?: string | null; startedAt: number } | null;

const LABEL: Record<string, string> = {
  "linkedin-square": "Posteo cuadrado",
  "linkedin-landscape": "Posteo apaisado y Slack",
  "agenda-slide": "Slide del cronograma",
  "agenda-summary": "Cronograma completo",
};

/**
 * "Diseñar plantillas con IA": un agente diseña las piezas principales mirando la referencia, un revisor
 * las compara y las corrige. Tarda unos minutos; muestra el avance por pieza y las miniaturas al terminar.
 */
export function TemplatesDesigner({ uploadId, onChange }: { uploadId: string; onChange: (version: number | null) => void }) {
  const [progress, setProgress] = useState<Progress>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const elapsed = useElapsed(running, progress?.startedAt);

  useEffect(() => {
    if (!running) return;
    let alive = true;
    const poll = async () => {
      const res = await fetch(`/api/reference/${uploadId}/templates`, { cache: "no-store" }).catch(() => null);
      if (!alive || !res?.ok) return;
      const p = (await res.json()) as Progress;
      setProgress(p);
      if (p?.status === "done" || p?.status === "failed") {
        setRunning(false);
        if (p.status === "done") {
          const v = Date.now();
          setVersion(v);
          onChange(v);
        } else setError(p.error ?? "No se pudieron diseñar las plantillas");
      }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [running, uploadId, onChange]);

  async function start() {
    setError(null);
    setProgress(null);
    const res = await fetch(`/api/reference/${uploadId}/templates`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error ?? "No se pudo empezar");
    setRunning(true);
  }

  const pieces = Object.entries(progress?.pieces ?? {});
  return (
    <div className="space-y-3 border-t border-ink/20 pt-3">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={start} disabled={running} className="btn-ink">
          {running ? "Diseñando…" : version ? "Volver a diseñar" : "Diseñar plantillas con IA"}
        </button>
        {!running && !version && (
          <span className="text-muted">Un agente diseña los posteos y el cronograma mirando tu referencia, y un revisor los corrige. Tarda unos minutos.</span>
        )}
        {version && !running && <span className="text-muted">Listo: la vista previa ya usa las plantillas diseñadas.</span>}
      </div>

      {running && (
        <div className="border-[1.5px] border-ink bg-surface p-3">
          <p className="mb-2 flex items-center gap-2 font-semibold">
            <PixelLoader size={14} /> diseñando y revisando · {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
          </p>
          <ul className="space-y-1 text-xs">
            {pieces.map(([id, p]) => (
              <li key={id} className="flex justify-between gap-3">
                <span>{LABEL[id] ?? id}</span>
                <span className="font-mono text-muted">
                  {p.status === "done" ? "lista" : p.status === "failed" ? "falló" : p.round ? `ronda ${p.round}${p.score != null ? ` · ${p.score}/10` : ""}` : "en cola"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {version && (
        <div className="flex flex-wrap gap-2">
          {Object.keys(LABEL).map((id) => (
            <a key={id} href={`/api/storage/uploads/${uploadId}/templates/${id}.png?v=${version}`} target="_blank" rel="noreferrer" title={LABEL[id]} className="block border-[1.5px] border-ink bg-surface p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/storage/uploads/${uploadId}/templates/${id}.png?v=${version}`} alt={LABEL[id]} className="h-20 w-auto" onError={(e) => (e.currentTarget.parentElement!.style.display = "none")} />
            </a>
          ))}
        </div>
      )}
      {error && <p className="text-orange">{error}</p>}
    </div>
  );
}
