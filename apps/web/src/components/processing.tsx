"use client";

import { useEffect, useState } from "react";

const PIXEL_COLORS = ["var(--pink)", "var(--yellow)", "var(--green)", "var(--violet)", "var(--ink)", "var(--pink)", "var(--green)", "var(--violet)", "var(--yellow)"];
// orden en espiral para que el encendido "gire"
const ORDER = [0, 1, 2, 5, 8, 7, 6, 3, 4];

/** Loader de 3×3 cuadraditos que se encienden en secuencia. */
export function PixelLoader({ size = 18 }: { size?: number }) {
  return (
    <span className="pixel-loader shrink-0" style={{ width: size, height: size }} role="presentation">
      {PIXEL_COLORS.map((color, i) => (
        <span key={i} style={{ background: color, animationDelay: `${ORDER.indexOf(i) * 0.11}s` }} />
      ))}
    </span>
  );
}

/** Segundos transcurridos desde `since` (ms, por defecto: cuando arranca) mientras `running`. */
export function useElapsed(running: boolean, since?: number) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) return;
    const start = since ?? Date.now();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 500);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [running, since]);
  return running ? elapsed : 0;
}

export const formatElapsed = (s: number) => (s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`);

export type Step = { label: string; detail?: string };

/** Lista de etapas: hechas (tilde), la actual (loader) y pendientes (casillero vacío). */
export function ProcessSteps({ steps, active, elapsed, progress }: { steps: Step[]; active: number; elapsed?: number; progress?: { value: number; max: number } | null }) {
  return (
    <div aria-live="polite" className="space-y-3">
      <ol className="space-y-2">
        {steps.map((step, i) => {
          const state = i < active ? "done" : i === active ? "active" : "pending";
          return (
            <li key={step.label} className={`flex items-center gap-3 text-sm ${state === "pending" ? "text-muted" : "text-ink"}`}>
              {state === "active" ? (
                <PixelLoader size={16} />
              ) : (
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center border-[1.5px] border-ink ${state === "done" ? "bg-mint" : "bg-surface"}`}>
                  {state === "done" && (
                    <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
                      <path d="M2 6.5 L5 9 L10 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
              )}
              <span className={state === "active" ? "font-semibold" : ""}>{step.label}</span>
              {state === "active" && step.detail && <span className="text-muted">· {step.detail}</span>}
              <span className="sr-only">{state === "done" ? "(listo)" : state === "active" ? "(en curso)" : "(pendiente)"}</span>
            </li>
          );
        })}
      </ol>
      <ProgressBar progress={progress} />
      {elapsed !== undefined && <p className="label-mono text-muted">{formatElapsed(elapsed)}</p>}
    </div>
  );
}

/** Barra de progreso: con porcentaje si se conoce, rayada en movimiento si no. */
export function ProgressBar({ progress }: { progress?: { value: number; max: number } | null }) {
  const pct = progress && progress.max ? Math.min(100, Math.round((progress.value / progress.max) * 100)) : null;
  return (
    <div
      className="h-3 overflow-hidden border-[1.5px] border-ink bg-surface"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct ?? undefined}
    >
      <div className={`h-full transition-[width] duration-500 ${pct === null ? "bar-indeterminate w-full" : "bg-yellow"}`} style={pct === null ? undefined : { width: `${pct}%` }} />
    </div>
  );
}
