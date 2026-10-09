import { join } from "node:path";
import { applyCritique, critiquePiece, type Critique } from "@flock/agents";
import { renderPng } from "@flock/renderer";
import { buildKit, linkedinPost, resolveAssets, type EventKit, type ReferenceStyle } from "@flock/templates";

const SAMPLE_EVENT = { name: "Evento de ejemplo", date: "2027-04-15", language: "es" as const, location: "Oficinas Flock" };
const SAMPLE_POST = { id: "anuncio", headline: "Se viene un evento nuevo", body: "Así se vería tu evento con este estilo." };

async function render(kit: EventKit, repoRoot: string) {
  const ctx = { kit, assets: await resolveAssets(kit, { kind: "inline", brandDir: join(repoRoot, "brand") }) };
  return renderPng(linkedinPost.render(ctx, { ...SAMPLE_POST, post: "" }, "square"), linkedinPost.sizes.square);
}

export type RefineStep = { score: number; notes: string; changes: Critique["changes"] };

/**
 * Lazo de fidelidad: renderiza un posteo con el estilo leído, el crítico lo compara con la referencia
 * (y con el AI Day como anti-referencia) y se aplican sus cambios. Se queda con la versión mejor puntuada
 * (una versión ajustada reemplaza a la original solo si la supera por medio punto o más).
 * Cada ronda es una llamada al modelo con visión (~5 s).
 */
export async function refineReferenceStyle(opts: {
  references: string[];
  style: ReferenceStyle;
  repoRoot: string;
  rounds?: number;
  log?: (message: string) => void;
}): Promise<{ style: ReferenceStyle; history: RefineStep[] }> {
  const rounds = opts.rounds ?? 2;
  const anti = await render(buildKit({ event: SAMPLE_EVENT, styleId: "iridiscente", seed: 1 }), opts.repoRoot);
  const history: RefineStep[] = [];
  let current = opts.style;
  let best = { style: current, score: -1 };

  for (let i = 0; i <= rounds; i++) {
    const piece = await render(buildKit({ event: SAMPLE_EVENT, styleId: "referencia", seed: 1, reference: current }), opts.repoRoot);
    const critique = await critiquePiece({ references: opts.references, piece, antiReference: anti, style: current });
    history.push({ score: critique.overall, notes: critique.notes, changes: critique.changes });
    opts.log?.(`ronda ${i + 1}: ${critique.overall}/10 · ${critique.notes}`);
    // Un cambio se acepta solo si mejora con margen: diferencias chicas son ruido del crítico
    if (i === 0 || critique.overall >= best.score + 0.5) best = { style: current, score: critique.overall };
    const pending = critique.changes.length > 0;
    if (i === rounds || critique.overall >= 8.5 || !pending) break;
    current = applyCritique(current, critique.changes);
  }
  return { style: best.style, history };
}
