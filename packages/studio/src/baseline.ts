import type { GeneratedPiece, PieceType } from "./generate";

/**
 * Línea base del proceso manual: cuánto le lleva a una persona de diseño producir cada pieza a mano
 * (o pedírsela a una agencia), para comparar con el tiempo de máquina de cada generación.
 *
 * ⚠ Valores INICIALES para validar con Marketing / People (ver docs/metricas-y-evals.md, "Tiempo ahorrado").
 * Se ajustan sin tocar código con BASELINE_MINUTES en el .env (JSON con las mismas claves).
 */
export const DEFAULT_BASELINE = {
  // Una vez por familia: leer el brief, explorar el estilo y armar el sistema de la pieza
  setup: 120,
  // Minutos por pieza
  linkedin: 40, // imagen de un posteo (cada formato)
  "linkedin-text": 20, // redacción del posteo
  slack: 20,
  "slack-text": 10,
  "agenda-slide": 15,
  "agenda-summary": 30,
  badge: 4, // por persona: combinar datos y revisar
  "badge-sheet": 20, // armado de cada hoja para imprimir
  certificate: 3,
  landing: 240,
  // Espera de agencia (días hábiles) cuando la familia se encarga afuera
  agencyLeadDays: 4,
} satisfies Record<PieceType | "setup" | "agencyLeadDays", number>;

export type Baseline = typeof DEFAULT_BASELINE;

export function baseline(): Baseline {
  try {
    return { ...DEFAULT_BASELINE, ...(process.env.BASELINE_MINUTES ? JSON.parse(process.env.BASELINE_MINUTES) : {}) };
  } catch {
    return DEFAULT_BASELINE;
  }
}

/** Minutos de trabajo manual equivalentes a una familia de piezas. */
export function manualMinutes(pieces: Pick<GeneratedPiece, "type">[], b: Baseline = baseline()) {
  if (!pieces.length) return 0;
  return b.setup + pieces.reduce((sum, p) => sum + (b[p.type] ?? 0), 0);
}
