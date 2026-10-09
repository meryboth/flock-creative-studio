/**
 * Precios para estimar el costo de cada llamada a un modelo (tabla llm_calls, costo por corrida).
 *
 * ⚠ Son ESTIMADOS de referencia, no precios verificados: revisalos contra las páginas de precios de
 * Anthropic y Google antes de usar los números para decidir, y ajustalos sin tocar código con
 * MODEL_PRICES en el .env (JSON con el mismo formato; pisa o agrega modelos).
 * Texto y visión: USD por millón de tokens. Imágenes: USD por imagen. ComfyUI corre local: costo 0.
 */
export type Price = { input?: number; output?: number; perImage?: number };

export const DEFAULT_PRICES: Record<string, Price> = {
  "claude-sonnet-5-5": { input: 3, output: 15 },
  "claude-haiku-5-5": { input: 1, output: 5 },
  "gemini-3.5-flash": { input: 0.3, output: 2.5 },
  "gemini-3.8-flash": { input: 0.3, output: 2.5 },
  "gemini-flash-latest": { input: 0.3, output: 2.5 },
  "gemini-3.1-flash-lite": { input: 0.1, output: 0.4 },
  "gemini-3.1-flash-image": { perImage: 0.04 },
  "gemini-2.5-flash-image": { perImage: 0.04 },
};

let cached: Record<string, Price> | null = null;
export function prices(): Record<string, Price> {
  if (cached) return cached;
  let custom: Record<string, Price> = {};
  try {
    custom = process.env.MODEL_PRICES ? JSON.parse(process.env.MODEL_PRICES) : {};
  } catch {
    console.warn("[precios] MODEL_PRICES no es un JSON válido: se usan los precios por defecto");
  }
  cached = { ...DEFAULT_PRICES, ...custom };
  return cached;
}

/** Costo estimado de una llamada, en USD (null si el modelo no tiene precio cargado). */
export function costOf(r: { provider: string; model: string; inputTokens?: number; outputTokens?: number; images?: number; ok?: boolean }): number | null {
  if (r.provider === "comfyui") return 0;
  const p = prices()[r.model];
  if (!p) return null;
  if (r.images != null || p.perImage != null) return r.ok === false ? 0 : (r.images ?? 1) * (p.perImage ?? 0);
  return ((r.inputTokens ?? 0) * (p.input ?? 0) + (r.outputTokens ?? 0) * (p.output ?? 0)) / 1_000_000;
}
