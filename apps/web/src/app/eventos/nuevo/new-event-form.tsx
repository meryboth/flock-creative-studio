"use client";

import { useActionState, useDeferredValue, useMemo, useRef, useState } from "react";
import { OUTPUTS } from "@flock/studio/outputs";
import { PreviewFrame } from "@/components/preview-frame";
import { AnalysisProgress } from "@/components/progress-views";
import { ReferencePanel, requestGraphics, type KeyVisualState, type ReferenceReading } from "@/components/reference-panel";
import { createEventAction, type FormState } from "./actions";

// id: un estilo del catálogo, "referencia" (imagen subida acá) o "lib:<uuid>" (biblioteca del equipo)
type StyleOption = {
  id: string;
  name: string;
  description: string;
  customColors: boolean;
  defaults: { accent: string; accent2?: string };
};

type Moodboard = {
  uploadId: string;
  images: string[];
  colors: string[];
  seeds: { accent: string; accent2: string };
  suggestedStyle: string;
  reason: string;
  reference: ReferenceReading | null;
  referenceError: string | null;
};


const PIECES = [
  { id: "linkedin", label: "Posteo", width: 1200, height: 1200 },
  { id: "slide", label: "Cronograma", width: 1920, height: 1080 },
  { id: "badge", label: "Credencial", width: 638, height: 1011 },
] as const;

const AGENDA_PLACEHOLDER = `9:30 - 10:00 Bienvenida | Auditorio
10:00 - 11:00 Charla de apertura
11:00 - 12:30 Workshops`;

export type LibraryOption = { id: string; name: string; description: string; colors: { accent: string; accent2: string } };

export function NewEventForm({ styles, library, initialLibraryId }: { styles: StyleOption[]; library: LibraryOption[]; initialLibraryId?: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createEventAction, {});
  const [fields, setFields] = useState({ name: "", date: "", location: "", language: "es", description: "", hashtag: "", tagline: "" });
  const [styleId, setStyleId] = useState<string>(initialLibraryId ? `lib:${initialLibraryId}` : "flock");
  const [colors, setColors] = useState<Record<string, { accent: string; accent2: string }>>(() =>
    Object.fromEntries(styles.map((s) => [s.id, { accent: s.defaults.accent, accent2: s.defaults.accent2 ?? s.defaults.accent }])),
  );
  const [seed, setSeed] = useState(1);
  const [piece, setPiece] = useState<(typeof PIECES)[number]["id"]>("linkedin");
  const [moodboard, setMoodboard] = useState<Moodboard | null>(null);
  const [moodboardError, setMoodboardError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState<number | false>(false); // cantidad de imágenes en análisis
  const fileInput = useRef<HTMLInputElement>(null);
  const [keyVisual, setKeyVisual] = useState<KeyVisualState>({ status: "idle" });
  const [templatesVersion, setTemplatesVersion] = useState<number | null>(null);

  const set = (k: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.value }));

  // Las vistas previas se recalculan con los datos "asentados", no en cada tecla
  const deferred = useDeferredValue(fields);
  const previewUrl = (style: string, p: string) => {
    const c = colors[style] ?? { accent: "#2b3bff", accent2: "#c35cff" };
    const libraryId = style.startsWith("lib:") ? style.slice(4) : null;
    const q = new URLSearchParams({ ...deferred, style: libraryId ? "referencia" : style, accent: c.accent, accent2: c.accent2, seed: String(seed), piece: p });
    if (libraryId) q.set("lib", libraryId);
    if (style === "referencia" && moodboard) {
      q.set("ref", moodboard.uploadId);
      if (keyVisual.status === "done") {
        q.set("v", String(keyVisual.version));
        if (keyVisual.keyVisualUrl) q.set("kv", "1");
        if (keyVisual.elements?.length) q.set("el", "1");
      }
      if (templatesVersion) {
        q.set("tpl", "1");
        q.set("tv", String(templatesVersion));
      }
    }
    return `/api/preview?${q}`;
  };

  // Orden: la referencia recién subida, después los estilos del equipo y al final el catálogo
  const allStyles = useMemo<StyleOption[]>(() => {
    const fromUpload: StyleOption[] = moodboard?.reference
      ? [
          {
            id: "referencia",
            name: "Tu referencia",
            description: moodboard.reference.description,
            customColors: false,
            defaults: { accent: moodboard.reference.colors.accent, accent2: moodboard.reference.colors.accent2 },
          },
        ]
      : [];
    const fromLibrary: StyleOption[] = library.map((l) => ({
      id: `lib:${l.id}`,
      name: l.name,
      description: l.description,
      customColors: false,
      defaults: l.colors,
    }));
    return [...fromUpload, ...fromLibrary, ...styles];
  }, [moodboard, styles, library]);
  const current = allStyles.find((s) => s.id === styleId) ?? allStyles[0];
  const currentPiece = PIECES.find((p) => p.id === piece)!;

  async function onMoodboard(files: FileList | null) {
    if (!files?.length) return;
    setAnalyzing(files.length);
    setMoodboardError(null);
    const body = new FormData();
    for (const f of Array.from(files)) body.append("files", f);
    try {
      const res = await fetch("/api/moodboard", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudieron analizar las imágenes");
      setMoodboard(data);
      setKeyVisual({ status: "idle" });
      // Si el modelo de visión leyó la referencia, su estilo pasa a ser el elegido; si no, el sugerido por color
      setStyleId(data.reference ? "referencia" : data.suggestedStyle);
      setColors((c) => {
        const next = { ...c };
        for (const s of styles) if (s.customColors) next[s.id] = { accent: data.seeds.accent, accent2: data.seeds.accent2 };
        return next;
      });
    } catch (err) {
      setMoodboardError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  }

  async function onGenerateKeyVisual() {
    const id = moodboard?.uploadId;
    if (!id) return;
    setKeyVisual({ status: "working" });
    setKeyVisual(await requestGraphics(id));
  }

  const fieldError = (name: string) => (state.field === name ? state.error : undefined);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="min-w-0 space-y-12">
        {/* ─── Evento ───────────────────────────────────────────── */}
        <fieldset className="min-w-0">
          <legend className="folder-tab label-mono bg-violet text-white">
            1 · el evento
          </legend>
          <div className="space-y-5 border-[1.5px] border-ink bg-surface/85 p-5 sm:p-7">
          <Field label="Nombre" error={fieldError("name")}>
            <input name="name" required value={fields.name} onChange={set("name")} placeholder="AI Day 2026" className={input} autoFocus />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Fecha" error={fieldError("date")}>
              <input name="date" type="date" required value={fields.date} onChange={set("date")} className={input} />
            </Field>
            <Field label="Idioma de las piezas">
              <select name="language" value={fields.language} onChange={set("language")} className={input}>
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </Field>
          </div>
          <Field label="Lugar" hint="Opcional">
            <input name="location" value={fields.location} onChange={set("location")} placeholder="Oficinas Flock + Teams" className={input} />
          </Field>
          <Field label="¿De qué se trata?" hint="Una o dos frases. La IA las usa para escribir los posteos y la landing.">
            <textarea
              name="description"
              rows={3}
              value={fields.description}
              onChange={set("description")}
              placeholder="Una jornada para aprender, experimentar y evolucionar juntos en la adopción de IA."
              className={input}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Hashtag" hint="Si lo dejás vacío, lo armamos con el nombre">
              <input name="hashtag" value={fields.hashtag} onChange={set("hashtag")} placeholder="#FLOCKAIDAY" className={input} />
            </Field>
            <Field label="Frase" hint="Opcional">
              <input name="tagline" value={fields.tagline} onChange={set("tagline")} placeholder="Learn · Experiment · Evolve" className={input} />
            </Field>
          </div>
          </div>
        </fieldset>

        {/* ─── Estilo ───────────────────────────────────────────── */}
        <fieldset className="min-w-0">
          <legend className="folder-tab label-mono bg-ink text-white">
            2 · estilo
          </legend>
          <div className="space-y-5 border-[1.5px] border-ink bg-surface/85 p-5 sm:p-7">

          <div className="border-[1.5px] border-dashed border-ink bg-background/70 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-medium">Partí de imágenes de referencia</p>
                <p className="mt-1 text-sm text-muted">Opcional. Sacamos los colores y te sugerimos un estilo.</p>
              </div>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={analyzing !== false}
                className="btn-line"
              >
                {analyzing !== false ? "Analizando…" : moodboard ? "Cambiar imágenes" : "Subir imágenes"}
              </button>
              <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => onMoodboard(e.target.files)} />
            </div>
            {moodboardError && <p className="mt-3 text-sm text-orange">{moodboardError}</p>}
            {analyzing !== false && (
              <div className="mt-5">
                <AnalysisProgress running images={analyzing} />
              </div>
            )}
            {moodboard && analyzing === false && (
              <div className="mt-5 space-y-4">
                <div className="flex gap-2 overflow-x-auto">
                  {moodboard.images.map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={src} src={`/api/storage/${src}`} alt="" className="h-16 w-16 shrink-0 rounded-md object-cover" />
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <div className="flex">
                    {moodboard.colors.map((c) => (
                      <span key={c} title={c} className="-ml-1 h-6 w-6 rounded-full border-2 border-background first:ml-0" style={{ background: c }} />
                    ))}
                  </div>
                  {!moodboard.reference && (
                    <span className="text-muted">
                      Sugerido: <span className="text-foreground">{styles.find((s) => s.id === moodboard.suggestedStyle)?.name}</span> ({moodboard.reason})
                    </span>
                  )}
                </div>
                {moodboard.reference ? (
                  <ReferencePanel
                    reading={moodboard.reference}
                    keyVisual={keyVisual}
                    onGenerateKeyVisual={onGenerateKeyVisual}
                    uploadId={moodboard.uploadId}
                    onTemplates={setTemplatesVersion}
                  />
                ) : (
                  moodboard.referenceError && <p className="text-sm text-muted">No pudimos leer el estilo con IA; usamos solo los colores. ({moodboard.referenceError})</p>
                )}
              </div>
            )}
          </div>

          <div role="radiogroup" aria-label="Estilo" className="grid gap-4 sm:grid-cols-2">
            {allStyles.map((s) => {
              const selected = s.id === styleId;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${s.name}: ${s.description}`}
                  onClick={() => setStyleId(s.id)}
                  className={`border-[1.5px] bg-surface p-2 text-left transition ${selected ? "taped border-ink shadow-[6px_6px_0_var(--yellow)]" : "border-border hover:border-ink"}`}
                >
                  <PreviewFrame src={previewUrl(s.id, "linkedin")} width={1200} height={1200} title={`Vista previa del estilo ${s.name}`} />
                  <span className="block px-2 pb-2 pt-3">
                    <span className="flex items-center justify-between gap-2 font-medium">
                      {s.name}
                      {!moodboard?.reference && moodboard?.suggestedStyle === s.id && <span className="sticker bg-mint text-xs">sugerido</span>}
                    </span>
                    <span className="mt-1 block text-sm text-muted">{s.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {fieldError("style") && <p className="text-sm text-orange">{fieldError("style")}</p>}

          <div className="flex flex-wrap items-end gap-6">
            {current.customColors ? (
              <>
                <ColorField
                  label="Color principal"
                  value={colors[styleId].accent}
                  onChange={(v) => setColors((c) => ({ ...c, [styleId]: { ...c[styleId], accent: v } }))}
                />
                <ColorField
                  label="Color secundario"
                  value={colors[styleId].accent2}
                  onChange={(v) => setColors((c) => ({ ...c, [styleId]: { ...c[styleId], accent2: v } }))}
                />
              </>
            ) : (
              <p className="text-sm text-muted">
                {styleId === "referencia" || styleId.startsWith("lib:")
                  ? "Este estilo usa los colores de su referencia."
                  : "Este estilo usa los colores institucionales de Flock."}
              </p>
            )}
            <button type="button" onClick={() => setSeed((n) => n + 1)} className="btn-line">
              Otra variante
            </button>
          </div>
          </div>
        </fieldset>

        {/* ─── Datos ────────────────────────────────────────────── */}
        <fieldset className="min-w-0">
          <legend className="folder-tab label-mono bg-yellow text-ink">
            3 · agenda
          </legend>
          <div className="space-y-5 border-[1.5px] border-ink bg-surface/85 p-5 sm:p-7">
          <Field label="Bloques del día" hint="Opcional. Un bloque por línea: horario y título. Con | podés agregar la sala." error={fieldError("agenda")}>
            <textarea name="agenda" rows={5} placeholder={AGENDA_PLACEHOLDER} className={`${input} font-mono text-sm`} />
          </Field>
          </div>
        </fieldset>

        {/* ─── Piezas ───────────────────────────────────────────── */}
        <fieldset className="min-w-0">
          <legend className="folder-tab label-mono bg-yellow text-ink">4 · piezas</legend>
          <div className="space-y-3 border-[1.5px] border-ink bg-surface/85 p-5 sm:p-7">
            <p className="text-sm text-muted">Elegí qué generar. Después podés sumar o sacar piezas desde el evento.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {OUTPUTS.map((o) => (
                <label key={o.id} className="flex cursor-pointer gap-3 border-[1.5px] border-ink/25 p-3 has-[:checked]:border-ink has-[:checked]:bg-mint/40">
                  <input type="checkbox" name="outputs" value={o.id} defaultChecked={o.default} className="mt-1 accent-[var(--ink)]" />
                  <span>
                    <span className="block font-semibold">{o.label}</span>
                    <span className="block text-xs text-muted">{o.description}</span>
                  </span>
                </label>
              ))}
            </div>
            {fieldError("outputs") && <p className="text-sm text-orange">{fieldError("outputs")}</p>}
          </div>
        </fieldset>

        <input type="hidden" name="styleId" value={styleId.startsWith("lib:") ? "referencia" : styleId} />
        <input type="hidden" name="libraryStyleId" value={styleId.startsWith("lib:") ? styleId.slice(4) : ""} />
        <input type="hidden" name="accent" value={(colors[styleId] ?? current.defaults).accent} />
        <input type="hidden" name="accent2" value={(colors[styleId] ?? current.defaults).accent2 ?? ""} />
        <input type="hidden" name="referenceUpload" value={styleId === "referencia" && moodboard ? moodboard.uploadId : ""} />
        <input type="hidden" name="keyVisual" value={styleId === "referencia" && keyVisual.status === "done" && keyVisual.keyVisualUrl ? "1" : ""} />
        <input type="hidden" name="templates" value={styleId === "referencia" && templatesVersion ? "1" : ""} />
        <input type="hidden" name="elements" value={styleId === "referencia" && keyVisual.status === "done" && keyVisual.elements?.length ? "1" : ""} />
        <input type="hidden" name="seed" value={seed} />
        <input type="hidden" name="moodboard" value={moodboard ? JSON.stringify(moodboard) : ""} />

        <div className="flex flex-wrap items-center gap-4 border-t border-border pt-8">
          <button
            type="submit"
            disabled={pending}
            className="btn-ink"
          >
            {pending ? "Creando…" : "Generar las piezas"}
          </button>
          <p className="font-hand text-xl text-muted">los textos los escribe la IA (Claude o Gemini); tarda un par de minutos</p>
          {state.error && !state.field && <p className="w-full text-sm text-orange">{state.error}</p>}
        </div>
      </div>

      {/* ─── Vista previa grande ───────────────────────────────── */}
      <aside className="min-w-0 lg:sticky lg:top-8 lg:self-start">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="font-hand text-3xl font-bold leading-none">{current.name}</p>
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
        <div className={`taped mx-auto rotate-[0.4deg] border-[1.5px] border-ink bg-surface p-2 shadow-lg ${piece === "badge" ? "max-w-[300px]" : ""}`}>
          <PreviewFrame src={previewUrl(styleId, piece)} width={currentPiece.width} height={currentPiece.height} title={`Vista previa: ${currentPiece.label}`} />
        </div>
        <p className="mt-3 text-sm text-muted">Vista previa con textos de ejemplo. Las piezas finales usan los textos que escriba la IA.</p>
      </aside>
    </form>
  );
}

const input =
  "w-full border-[1.5px] border-ink bg-surface px-3.5 py-2.5 text-foreground placeholder:text-muted/60 transition-shadow focus:shadow-[4px_4px_0_var(--yellow)] focus:outline-none";

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {error ? <span className="mt-1.5 block text-sm text-orange">{error}</span> : hint && <span className="mt-1.5 block text-sm text-muted">{hint}</span>}
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-10 cursor-pointer border-[1.5px] border-ink bg-surface p-0.5" />
      <span>
        <span className="block">{label}</span>
        <span className="font-mono text-xs text-muted">{value}</span>
      </span>
    </label>
  );
}
