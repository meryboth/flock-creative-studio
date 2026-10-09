"use client";

import { useEffect, useState } from "react";
import { ProcessSteps, useElapsed } from "./processing";

/**
 * Lectura de una referencia: un solo pedido al servidor, así que las etapas avanzan por tiempo
 * (las dos primeras son rápidas) y la última queda activa hasta que llega la respuesta.
 */
export function AnalysisProgress({ running, images = 1 }: { running: boolean; images?: number }) {
  const elapsed = useElapsed(running);
  const active = elapsed < 1 ? 0 : elapsed < 3 ? 1 : 2;
  return (
    <div className="border-[1.5px] border-ink bg-surface p-5">
      <p className="mb-4 font-hand text-2xl font-bold leading-none">leyendo tu referencia…</p>
      <ProcessSteps
        steps={[
          { label: images > 1 ? `Subiendo ${images} imágenes` : "Subiendo la imagen" },
          { label: "Midiendo los colores" },
          { label: "Leyendo el estilo con IA", detail: "tipografía, formas, textura y clima" },
          { label: "Armando el estilo" },
        ]}
        active={active}
        elapsed={elapsed}
      />
    </div>
  );
}

type KvProgress = { phase: "queued" | "generating" | "cutout"; provider: string; step?: number; total?: number; startedAt: number } | null;

/** Generación del key visual: consulta el avance real (pasos de ComfyUI) cada segundo. */
export function KeyVisualProgress({ uploadId, running }: { uploadId: string; running: boolean }) {
  const [progress, setProgress] = useState<KvProgress>(null);
  useEffect(() => {
    if (!running) return;
    let alive = true;
    const poll = async () => {
      const res = await fetch(`/api/reference/${uploadId}/keyvisual`, { cache: "no-store" }).catch(() => null);
      if (alive && res?.ok) setProgress(await res.json());
    };
    poll();
    const id = setInterval(poll, 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [uploadId, running]);

  const elapsed = useElapsed(running, progress?.startedAt);
  const phase = progress?.phase ?? "queued";
  const active = phase === "queued" ? 0 : phase === "generating" ? 1 : 2;
  const local = progress?.provider === "comfyui";
  return (
    <div className="space-y-3 bg-surface/80 p-4">
      <ProcessSteps
        steps={[
          { label: local ? "Preparando el modelo en tu Mac" : "Enviando la referencia a Gemini" },
          {
            label: local ? "Generando la imagen con ComfyUI" : "Generando la imagen",
            detail: progress?.total ? `paso ${progress.step} de ${progress.total}` : undefined,
          },
          { label: "Recortando el objeto" },
        ]}
        active={active}
        elapsed={elapsed}
        progress={phase === "generating" && progress?.total ? { value: progress.step ?? 0, max: progress.total } : null}
      />
      <p className="text-xs text-muted">
        {local
          ? "Con ComfyUI en tu Mac tarda entre 2 y 3 minutos. Podés seguir completando el resto mientras tanto."
          : "Con Gemini suele tardar unos segundos."}
      </p>
    </div>
  );
}

/** Progreso de la generación de un evento (datos del servidor, se refresca con AutoRefresh). */
export function GenerationProgress({ stage, progress, total, startedAt }: { stage: string | null; progress: number; total: number; startedAt?: number }) {
  const elapsed = useElapsed(true, startedAt);
  const s = stage ?? "";
  const active = s.startsWith("Generando") ? 2 : s.startsWith("Redactando") ? 1 : 0;
  return (
    <ProcessSteps
      steps={[
        { label: "Preparando el evento", detail: s.startsWith("Leyendo") ? "leyendo la nómina" : undefined },
        { label: "Redactando los textos con Gemini" },
        { label: "Generando las piezas", detail: total ? `${progress} de ${total} · ${s.replace(/^Generando: /, "")}` : undefined },
        { label: "Revisión de diseño" },
      ]}
      active={active}
      elapsed={elapsed}
      progress={active === 2 && total ? { value: progress, max: total } : null}
    />
  );
}

type GraphicsState = {
  keyVisual?: { phase: "queued" | "generating" | "cutout"; provider?: string; step?: number; total?: number };
  elements?: { done: number; total: number };
  startedAt: number;
} | null;

/** Progreso de "Generar gráficos con IA": key visual y elementos en paralelo. */
export function GraphicsProgress({ uploadId, running }: { uploadId: string; running: boolean }) {
  const [state, setState] = useState<GraphicsState>(null);
  useEffect(() => {
    if (!running) return;
    let alive = true;
    const poll = async () => {
      const res = await fetch(`/api/reference/${uploadId}/graphics`, { cache: "no-store" }).catch(() => null);
      if (alive && res?.ok) setState(await res.json());
    };
    poll();
    const id = setInterval(poll, 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [uploadId, running]);

  const elapsed = useElapsed(running, state?.startedAt);
  const kv = state?.keyVisual;
  const el = state?.elements;
  const local = kv?.provider === "comfyui";
  const kvDone = kv?.phase === "cutout";
  const elDone = el ? el.done >= el.total : false;
  const active = !state ? 0 : !kvDone || !elDone ? 1 : 2;
  const detail = [
    kv ? (kvDone ? "key visual listo" : kv.total ? `key visual: paso ${kv.step} de ${kv.total}` : "key visual en curso") : null,
    el ? `elementos: ${el.done} de ${el.total}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const parts = (kv ? 1 : 0) + (el?.total ?? 0);
  const doneParts = (kvDone ? 1 : 0) + (el?.done ?? 0);
  return (
    <div className="space-y-3 bg-surface/80 p-4">
      <ProcessSteps
        steps={[
          { label: "Enviando tu referencia" },
          { label: "Generando el key visual y los elementos", detail },
          { label: "Recortando y ajustando" },
        ]}
        active={active}
        elapsed={elapsed}
        progress={parts ? { value: doneParts, max: parts } : null}
      />
      <p className="text-xs text-muted">
        {local ? "El key visual se genera en tu Mac con ComfyUI: puede tardar 2 a 3 minutos." : "Con Gemini suele tardar entre 10 y 30 segundos."}
      </p>
    </div>
  );
}
