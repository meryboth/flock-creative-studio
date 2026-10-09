"use client";

import { useActionState, useRef, useState } from "react";
import { PreviewFrame } from "@/components/preview-frame";
import { PixelLoader } from "@/components/processing";
import { AnalysisProgress } from "@/components/progress-views";
import { ReferencePanel, type KeyVisualState, type ReferenceReading } from "@/components/reference-panel";
import { createStyleAction, type StyleFormState } from "../actions";

type Upload = { uploadId: string; images: string[]; reference: ReferenceReading | null; referenceError: string | null };

const PIECES = [
  { id: "linkedin", label: "Posteo", width: 1200, height: 1200 },
  { id: "slide", label: "Cronograma", width: 1920, height: 1080 },
  { id: "badge", label: "Credencial", width: 638, height: 1011 },
] as const;

// Evento de muestra para ver el estilo aplicado
const SAMPLE = { name: "Evento de ejemplo", date: "2027-04-15", description: "Así se vería tu evento con este estilo.", language: "es" };

export function NewStyleForm() {
  const [state, formAction, pending] = useActionState<StyleFormState, FormData>(createStyleAction, {});
  const [upload, setUpload] = useState<Upload | null>(null);
  const [analyzing, setAnalyzing] = useState<number | false>(false); // cantidad de imágenes en análisis
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [keyVisual, setKeyVisual] = useState<KeyVisualState>({ status: "idle" });
  const [piece, setPiece] = useState<(typeof PIECES)[number]["id"]>("linkedin");
  const fileInput = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setAnalyzing(files.length);
    setUploadError(null);
    setKeyVisual({ status: "idle" });
    const body = new FormData();
    for (const f of Array.from(files)) body.append("files", f);
    try {
      const res = await fetch("/api/moodboard", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudieron analizar las imágenes");
      if (!data.reference) throw new Error(data.referenceError ?? "No pudimos leer el estilo de la referencia");
      setUpload(data);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  }

  async function onGenerateKeyVisual() {
    if (!upload) return;
    setKeyVisual({ status: "working" });
    try {
      const res = await fetch(`/api/reference/${upload.uploadId}/keyvisual`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo generar el key visual");
      setKeyVisual({
        status: "done",
        version: Date.now(),
        message: `Listo con ${data.provider === "comfyui" ? "ComfyUI (local)" : "Gemini"} en ${Math.round(data.seconds)} s.`,
      });
    } catch (err) {
      setKeyVisual({ status: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  const current = PIECES.find((p) => p.id === piece)!;
  const previewUrl = upload
    ? `/api/preview?${new URLSearchParams({
        ...SAMPLE,
        style: "referencia",
        ref: upload.uploadId,
        piece,
        ...(keyVisual.status === "done" ? { kv: "1", v: String(keyVisual.version) } : {}),
      })}`
    : null;

  return (
    <form action={formAction} className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="min-w-0 space-y-8">
        <fieldset className="min-w-0">
          <legend className="folder-tab label-mono bg-violet text-white">1 · referencia</legend>
          <div className="space-y-5 border-[1.5px] border-ink bg-surface/85 p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-4">
              <button type="button" onClick={() => fileInput.current?.click()} disabled={analyzing !== false} className="btn-ink">
                {analyzing !== false ? "Leyendo la referencia…" : upload ? "Cambiar imágenes" : "Subir imágenes"}
              </button>
              <span className="text-sm text-muted">PNG, JPG o WebP. Hasta 15 imágenes.</span>
              <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => onFiles(e.target.files)} />
            </div>
            {uploadError && <p className="text-sm text-orange">{uploadError}</p>}
            {analyzing !== false && <AnalysisProgress running images={analyzing} />}
            {upload && analyzing === false && (
              <>
                <div className="flex gap-2 overflow-x-auto">
                  {upload.images.map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={src} src={`/api/storage/${src}`} alt="" className="h-20 w-20 shrink-0 border-[1.5px] border-ink object-cover" />
                  ))}
                </div>
                {upload.reference && (
                  <ReferencePanel reading={upload.reference} keyVisual={keyVisual} onGenerateKeyVisual={onGenerateKeyVisual} uploadId={upload.uploadId} />
                )}
              </>
            )}
          </div>
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="folder-tab label-mono bg-ink text-white">2 · nombre</legend>
          <div className="space-y-5 border-[1.5px] border-ink bg-surface/85 p-5 sm:p-7">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Nombre del estilo</span>
              <input
                name="name"
                required
                placeholder="Cromo nocturno"
                className="w-full border-[1.5px] border-ink bg-surface px-3.5 py-2.5 placeholder:text-muted/60 transition-shadow focus:shadow-[4px_4px_0_var(--yellow)] focus:outline-none"
              />
              <span className="mt-1.5 block text-sm text-muted">Así lo va a ver el equipo al elegir el estilo de un evento.</span>
            </label>
          </div>
        </fieldset>

        <input type="hidden" name="uploadId" value={upload?.uploadId ?? ""} />
        <div className="flex flex-wrap items-center gap-4 border-t border-border pt-8">
          <button type="submit" disabled={pending || !upload || keyVisual.status === "working"} className="btn-ink">
            {pending ? "Guardando…" : "Guardar en la biblioteca"}
          </button>
          {state.error && <p className="w-full text-sm text-orange">{state.error}</p>}
        </div>
      </div>

      <aside className="min-w-0 lg:sticky lg:top-8 lg:self-start">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="font-hand text-3xl font-bold leading-none">así se aplica</p>
          <div role="tablist" aria-label="Pieza de muestra" className="flex max-w-full overflow-x-auto border-[1.5px] border-ink bg-surface">
            {PIECES.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={piece === p.id}
                onClick={() => setPiece(p.id)}
                className={`label-mono px-3 py-2 transition ${piece === p.id ? "bg-yellow text-ink" : "text-muted hover:text-ink"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {previewUrl ? (
          <div className={`taped mx-auto rotate-[0.4deg] border-[1.5px] border-ink bg-surface p-2 shadow-lg ${piece === "badge" ? "max-w-[300px]" : ""}`}>
            <PreviewFrame src={previewUrl} width={current.width} height={current.height} title={`Ejemplo: ${current.label}`} />
          </div>
        ) : (
          <div className="flex aspect-square flex-col items-center justify-center gap-4 border-[1.5px] border-dashed border-ink bg-surface/60 p-8 text-center">
            {analyzing !== false && <PixelLoader size={40} />}
            <p className="font-hand text-2xl text-muted">
              {analyzing !== false ? "armando el estilo para mostrártelo aplicado…" : "subí una referencia y acá aparece el estilo aplicado"}
            </p>
          </div>
        )}
      </aside>
    </form>
  );
}
