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
  for (const provider of enabled) {
    for (const model of modelsFor(provider, task)) {
      try {
        const llm = create(provider, model, temperature);
        const method = provider === "claude" ? "jsonSchema" : undefined;
        const out = (await llm.withStructuredOutput(schema, { name, ...(method && { method }) }).invoke(input, { signal: AbortSignal.timeout(timeoutMs) })) as z.infer<S>;
        return { out, model: `${provider}:${model}` };
      } catch (err) {
        errors.push(`${provider}:${model}: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
      }
    }
  }
  throw new Error(errors.join(" | "));
}
