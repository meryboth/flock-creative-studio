"use client";

import { KeyVisualProgress } from "./progress-views";

// Post-it "lo que vimos": cómo se interpretó una referencia gráfica (se usa en eventos y en la biblioteca)

export type ReferenceReading = {
  description: string;
  mood: string[];
  typography: { display: string; case: "upper" | "title" | "lower"; weight: string; width: string };
  generator: "orbs" | "grid" | "pieces" | "blobs" | "pixel" | "doodle";
  motifs?: string[];
  texture?: "none" | "grid" | "dots" | "lines";
  colors: { ground: string; accent: string; accent2: string; shapes?: string[] };
};

export type KeyVisualState = { status: "idle" | "working" | "done" | "error"; message?: string; version?: number };

const GENERATOR_LABEL: Record<ReferenceReading["generator"], string> = {
  orbs: "esferas de luz",
  grid: "formas geométricas en grilla",
  pieces: "trazos con degradado",
  blobs: "formas orgánicas",
  pixel: "motivos en pixel art",
  doodle: "motivos dibujados a mano",
};
const TEXTURE_LABEL: Record<string, string> = { grid: "cuadrícula", dots: "puntos", lines: "renglones" };
const MOTIF_LABEL: Record<string, string> = { flower: "flores", cloud: "nubes", heart: "corazones", star: "estrellas", sparkle: "destellos", squiggle: "garabatos" };
const WEIGHT_LABEL: Record<string, string> = { regular: "regular", bold: "negrita", black: "extra negrita" };
const WIDTH_LABEL: Record<string, string> = { condensed: "condensada", normal: "", extended: "extendida" };

export function ReferencePanel({
  reading,
  keyVisual,
  onGenerateKeyVisual,
  uploadId,
}: {
  reading: ReferenceReading;
  keyVisual?: KeyVisualState;
  onGenerateKeyVisual?: () => void;
  uploadId?: string; // para seguir el progreso del key visual
}) {
  return (
    <div className="taped -rotate-[0.6deg] space-y-3 bg-yellow p-5 text-sm shadow-md">
      <p className="font-hand text-3xl font-bold leading-none">lo que vimos</p>
      <p className="text-muted">{reading.description}</p>
      <div className="flex flex-wrap gap-2">
        {reading.mood.map((m) => (
          <span key={m} className="sticker bg-surface text-xs">
            {m}
          </span>
        ))}
      </div>
      <dl className="grid gap-x-6 gap-y-1 text-muted sm:grid-cols-[auto_1fr]">
        <dt>Tipografía</dt>
        <dd className="text-foreground">
          {[
            reading.typography.display,
            reading.typography.case === "upper" ? "mayúsculas" : reading.typography.case === "lower" ? "minúsculas" : "tipo título",
            WIDTH_LABEL[reading.typography.width],
            WEIGHT_LABEL[reading.typography.weight],
          ]
            .filter(Boolean)
            .join(" · ")}
        </dd>
        <dt>Visual</dt>
        <dd className="text-foreground">
          {GENERATOR_LABEL[reading.generator]}
          {reading.motifs?.length && (reading.generator === "pixel" || reading.generator === "doodle")
            ? ` (${reading.motifs.map((m) => MOTIF_LABEL[m] ?? m).join(", ")})`
            : ""}
        </dd>
        {reading.texture && reading.texture !== "none" && (
          <>
            <dt>Fondo</dt>
            <dd className="text-foreground">con {TEXTURE_LABEL[reading.texture]}</dd>
          </>
        )}
        <dt>Colores</dt>
        <dd className="flex gap-1.5 pt-0.5">
          {[reading.colors.ground, reading.colors.accent, reading.colors.accent2, ...(reading.colors.shapes ?? [])].slice(0, 6).map((c, i) => (
            <span key={`${c}-${i}`} title={c} className="h-5 w-5 border-[1.5px] border-ink" style={{ background: c }} />
          ))}
        </dd>
      </dl>
      {keyVisual && onGenerateKeyVisual && (
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button type="button" onClick={onGenerateKeyVisual} disabled={keyVisual.status === "working"} className="btn-line">
            {keyVisual.status === "working" ? "Generando key visual…" : keyVisual.status === "done" ? "Generar otro key visual" : "Generar key visual con IA"}
          </button>
          {keyVisual.status !== "working" && (
            <span className="text-muted">
              {keyVisual.status === "error" || keyVisual.status === "done"
                ? keyVisual.message
                : "Opcional: una imagen original inspirada en tu referencia, sin texto."}
            </span>
          )}
        </div>
      )}
      {keyVisual?.status === "working" && uploadId && <KeyVisualProgress uploadId={uploadId} running />}
    </div>
  );
}
