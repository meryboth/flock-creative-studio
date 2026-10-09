import { join } from "node:path";
import { designTemplate, reviewDesign, verifyPieceReading } from "@flock/agents";
import { renderPngChecked } from "@flock/renderer";
import { detectFindings } from "./impeccable";
import {
  buildKit,
  DESIGNED_PIECES,
  PIECE_SPECS,
  renderDesigned,
  resolveAssets,
  sampleData,
  validateTemplate,
  type DesignedPieceId,
  type DesignedTemplate,
  type ReferenceStyle,
} from "@flock/templates";

export type DesignStep = { round: number; score: number | null; problems: string[]; fixes: string[] };
export type DesignResult = { template: DesignedTemplate; preview: Buffer; history: DesignStep[] };

/** Renderiza una plantilla con datos de muestra (o los más largos) y la devuelve como PNG con sus problemas. */
export async function renderTemplatePreview(t: DesignedTemplate, repoRoot: string, stress = false) {
  // Las fuentes las eligió el diseñador: el kit solo sirve para resolverlas y para los logos
  const kit = buildKit({ event: { name: "-", date: "2026-01-01", language: "es" }, styleId: "flock" });
  kit.style.fonts = { display: t.display, body: t.body };
  const assets = await resolveAssets(kit, { kind: "inline", brandDir: join(repoRoot, "brand") });
  const data = sampleData(t.piece, stress);
  const html = renderDesigned(t, data, assets);
  const spec = PIECE_SPECS[t.piece];
  const { png, issues, metrics } = await renderPngChecked(html, spec.size, 1, Object.keys(spec.minSize));
  // Lo que tiene que dominar la pieza no puede quedar chico (medido con los valores más largos)
  const small = Object.entries(spec.minSize)
    .filter(([sel, min]) => metrics[sel] == null || metrics[sel]! < min)
    .map(([sel, min]) => `${sel} ${metrics[sel] == null ? "no existe" : `mide ${Math.round(metrics[sel]!)}px`} (mínimo ${min}px con el texto más largo): tiene que ser el protagonista`);
  return { png, issues, data, small, html };
}

/** Datos que el verificador tiene que leer completos en la pieza de prueba. */
function expectedFields(piece: DesignedPieceId, data: Record<string, unknown>) {
  const get = (k: string) => String(data[k] ?? "");
  const base = [{ field: "nombre del evento", value: get("EVENT_NAME") }];
  if (piece === "agenda-slide") return [...base, { field: "hora de inicio", value: get("START") }, { field: "título del bloque", value: get("TITLE") }];
  if (piece === "agenda-summary") {
    const rows = (data.rows as Record<string, string>[]) ?? [];
    return [...base, ...rows.slice(0, 3).map((r, i) => ({ field: `horario ${i + 1}`, value: r.START }))];
  }
  return [...base, { field: "titular", value: get("HEADLINE") }, { field: "fecha", value: get("DATE") }];
}

/**
 * Diseña la plantilla de una pieza con un lazo de revisión: diseñar → validar reglas → renderizar con
 * los datos más largos → control geométrico y de lectura → revisor contra la referencia → corregir.
 * Se queda con la mejor versión válida.
 */
export async function designPiece(opts: {
  references: string[];
  piece: DesignedPieceId;
  reading?: ReferenceStyle;
  repoRoot: string;
  rounds?: number;
  start?: DesignedTemplate; // para rediseñar desde el chat
  instruction?: string;
  onStep?: (step: DesignStep) => void;
}): Promise<DesignResult> {
  const rounds = opts.rounds ?? 2;
  const history: DesignStep[] = [];
  let best: { template: DesignedTemplate; preview: Buffer; score: number } | null = null;

  /** Valida, renderiza con los datos más largos, controla y revisa una versión. */
  const evaluate = async (template: DesignedTemplate, round: number) => {
    const problems = validateTemplate(template);
    if (problems.length) {
      const step = { round, score: null, problems, fixes: [] };
      history.push(step);
      opts.onStep?.(step);
      return { template, score: -1, feedback: problems.map((p) => `Regla incumplida: ${p}`), clean: false };
    }
    const { png, issues, data, small, html } = await renderTemplatePreview(template, opts.repoRoot, true);
    // Detector de Impeccable: contraste, jerarquía de títulos y otros antipatrones
    const design = (await detectFindings(opts.repoRoot, { pieza: html }))?.pieza ?? [];
    const reading = await verifyPieceReading(png, expectedFields(opts.piece, data)).catch(() => null);
    const qa = [
      ...issues.map((i) => `texto ${i.kind === "recortado" ? "recortado" : "fuera de la pieza"}: «${i.text}»`),
      ...(reading?.fields.filter((f) => f.status !== "ok").map((f) => `${f.field} ${f.status}: se lee «${f.read}», debería decir «${f.expected}»`) ?? []),
      ...small,
      ...design.map((d) => `detector de diseño: ${d}`),
    ];
    const review = await reviewDesign({ references: opts.references, piece: opts.piece, render: png, qa });
    const score = Math.max(0, review.score - qa.length * 0.5); // cada problema descuenta
    const step = { round, score, problems: qa, fixes: review.fixes };
    history.push(step);
    opts.onStep?.(step);
    if (!best || score > best.score) {
      const scored = { ...template, score };
      const { png: preview } = await renderTemplatePreview(scored, opts.repoRoot, false);
      best = { template: scored, preview, score };
    }
    const feedback = [...qa.map((q) => `Arreglá: ${q}`), ...review.fixes, ...(review.copied ? ["Copiaste contenido de la referencia: reemplazalo por elementos propios"] : [])];
    return { template, score, feedback, clean: score >= 8.5 && !qa.length };
  };

  // Ronda 0: dos propuestas distintas en paralelo (o la plantilla actual con el pedido del chat)
  const first = opts.start
    ? [await designTemplate({ references: opts.references, piece: opts.piece, reading: opts.reading, previous: opts.start, instruction: opts.instruction })]
    : await Promise.all([
        designTemplate({ references: opts.references, piece: opts.piece, reading: opts.reading }),
        designTemplate({ references: opts.references, piece: opts.piece, reading: opts.reading, alternative: true }),
      ]);
  const evaluated = await Promise.all(first.map((t) => evaluate(t, 0)));
  let current = evaluated.sort((a, b) => b.score - a.score)[0];

  // Revisiones sobre la mejor
  for (let round = 1; round <= rounds && !current.clean; round++) {
    const revised = await designTemplate({
      references: opts.references,
      piece: opts.piece,
      reading: opts.reading,
      previous: current.template,
      feedback: current.feedback,
    });
    const result = await evaluate(revised, round);
    // si la revisión empeora, la próxima corrige sobre la mejor (con lo que dijo el revisor de esta)
    current = result.score >= current.score ? result : { ...current, feedback: [...current.feedback, ...result.feedback.slice(0, 3)] };
  }
  // (TypeScript no sigue las asignaciones hechas dentro de evaluate)
  const winner = best as { template: DesignedTemplate; preview: Buffer; score: number } | null;
  if (!winner) throw new Error(`No se pudo diseñar una plantilla válida para "${PIECE_SPECS[opts.piece].label}"`);
  return { template: winner.template, preview: winner.preview, history };
}

/** Diseña todas las piezas de un estilo en paralelo. */
export async function designStyleTemplates(opts: {
  references: string[];
  reading?: ReferenceStyle;
  repoRoot: string;
  pieces?: DesignedPieceId[];
  rounds?: number;
  onProgress?: (piece: DesignedPieceId, step: DesignStep | "done" | "failed") => void;
}) {
  const pieces = opts.pieces ?? DESIGNED_PIECES;
  const results = await Promise.allSettled(
    pieces.map((piece) =>
      designPiece({ ...opts, piece, onStep: (s) => opts.onProgress?.(piece, s) }).then(
        (r) => (opts.onProgress?.(piece, "done"), r),
        (err) => {
          opts.onProgress?.(piece, "failed");
          throw err;
        },
      ),
    ),
  );
  const templates: Partial<Record<DesignedPieceId, DesignedTemplate>> = {};
  const previews: Partial<Record<DesignedPieceId, Buffer>> = {};
  const history: Partial<Record<DesignedPieceId, DesignStep[]>> = {};
  const errors: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      templates[pieces[i]] = r.value.template;
      previews[pieces[i]] = r.value.preview;
      history[pieces[i]] = r.value.history;
    } else errors.push(`${PIECE_SPECS[pieces[i]].label}: ${r.reason instanceof Error ? r.reason.message : r.reason}`);
  });
  return { templates, previews, history, errors };
}
