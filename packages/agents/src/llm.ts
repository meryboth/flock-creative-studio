import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { z } from "zod";

/**
 * Proveedores de LLM intercambiables (texto, edición y visión). El orden sale de LLM_PROVIDERS
 * (ej. "claude,gemini"): se prueban los modelos de cada proveedor en orden hasta que uno responde.
 * Las imágenes (key visual, elementos) siguen en keyvisual.ts: Claude no genera imágenes.
 */
export type Task = "text" | "vision";
type Provider = "claude" | "gemini";

const list = (value: string | undefined, fallback: string) =>
  (value ?? fallback)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

function modelsFor(provider: Provider, task: Task) {
  if (provider === "claude")
    return task === "vision"
      ? list(process.env.CLAUDE_VISION_MODELS, "claude-sonnet-5-5,claude-haiku-5-5")
      : list(process.env.CLAUDE_MODELS, "claude-sonnet-5-5,claude-haiku-5-5");
  return task === "vision"
    ? list(process.env.GEMINI_VISION_MODELS, "gemini-3.5-flash,gemini-3.1-flash-lite")
    : list(process.env.GEMINI_MODELS, "gemini-3.5-flash,gemini-flash-latest");
}

function create(provider: Provider, model: string, temperature: number) {
  // Los modelos Claude 5.x no aceptan temperature: la consistencia la da el prompt y el esquema cerrado
  if (provider === "claude") return new ChatAnthropic({ model, apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1, maxTokens: 8192 });
  return new ChatGoogleGenerativeAI({ model, apiKey: process.env.GOOGLE_API_KEY, temperature, maxRetries: 1 });
}

// ─── Telemetría ─────────────────────────────────────────────────────────────

/** Registro de una llamada a un modelo (ver tabla llm_calls y docs/metricas-y-evals.md). */
export type LlmCallRecord = {
  task: string; // copy | editor | reference | critic | keyvisual | elements | eval
  provider: string;
  model: string;
  attempt: number; // 1 = primer modelo de la cadena; >1 = respaldo
  ok: boolean;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
};

// En globalThis: la app (Next) puede cargar este módulo más de una vez y el observador tiene que ser uno solo
const g = globalThis as { __flockLlmObserver?: (r: LlmCallRecord) => void };

/** La app registra acá dónde guardar cada llamada (la base); sin observador, no se guarda nada. */
export function setLlmObserver(fn: ((r: LlmCallRecord) => void) | null) {
  g.__flockLlmObserver = fn ?? undefined;
}

export function reportLlmCall(r: LlmCallRecord) {
  try {
    g.__flockLlmObserver?.(r);
  } catch {
    // la telemetría nunca rompe el flujo
  }
}

const TASK_BY_NAME: Record<string, string> = { event_copy: "copy", change_set: "editor", reference_style: "reference", critique: "critic", piece_reading: "verifier" };

/** Proveedores habilitados (con su key), en el orden configurado. */
export function providers(): Provider[] {
  const keys: Record<Provider, string | undefined> = { claude: process.env.ANTHROPIC_API_KEY, gemini: process.env.GOOGLE_API_KEY };
  return list(process.env.LLM_PROVIDERS, "claude,gemini").filter((p): p is Provider => (p === "claude" || p === "gemini") && Boolean(keys[p]));
}

/**
 * Pide una salida estructurada (zod) probando proveedor por proveedor y modelo por modelo.
 * Devuelve el resultado y el modelo que respondió ("claude:claude-sonnet-5-5").
 */
export async function invokeStructured<S extends z.ZodType>(
  task: Task,
  schema: S,
  input: BaseLanguageModelInput,
  { name, temperature, timeoutMs }: { name: string; temperature: number; timeoutMs: number },
): Promise<{ out: z.infer<S>; model: string }> {
  const enabled = providers();
  if (!enabled.length) throw new Error("No hay proveedor de LLM configurado (ANTHROPIC_API_KEY o GOOGLE_API_KEY)");
  const errors: string[] = [];
  const label = TASK_BY_NAME[name] ?? name;
  let attempt = 0;
  for (const provider of enabled) {
    for (const model of modelsFor(provider, task)) {
      attempt++;
      const t0 = Date.now();
      try {
        const llm = create(provider, model, temperature);
        const method = provider === "claude" ? "jsonSchema" : undefined;
        // includeRaw: además del resultado, el mensaje crudo con el uso de tokens
        const res = (await llm
          .withStructuredOutput(schema, { name, includeRaw: true, ...(method && { method }) })
          .invoke(input, { signal: AbortSignal.timeout(timeoutMs) })) as unknown as { raw: { usage_metadata?: { input_tokens?: number; output_tokens?: number } }; parsed: z.infer<S> | null };
        if (res.parsed == null) throw new Error("respuesta sin el formato pedido");
        const usage = res.raw?.usage_metadata;
        reportLlmCall({ task: label, provider, model, attempt, ok: true, latencyMs: Date.now() - t0, inputTokens: usage?.input_tokens, outputTokens: usage?.output_tokens });
        return { out: res.parsed, model: `${provider}:${model}` };
      } catch (err) {
        const message = err instanceof Error ? err.message.split("\n")[0] : String(err);
        reportLlmCall({ task: label, provider, model, attempt, ok: false, latencyMs: Date.now() - t0, error: message.slice(0, 500) });
        errors.push(`${provider}:${model}: ${message}`);
      }
    }
  }
  throw new Error(errors.join(" | "));
}
