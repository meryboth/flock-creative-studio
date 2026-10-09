import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Prompts versionados: viven en packages/agents/prompts/<id>.md, con frontmatter
 *   ---
 *   id: critic
 *   version: 2
 *   description: …
 *   ---
 * y el cuerpo con variables {{nombre}}. Cada llamada a un modelo registra id y versión (tabla llm_calls).
 * prompts.lock.json guarda el hash de cada versión: si el texto cambia sin subir la versión, el test falla.
 */

export type Prompt = { id: string; version: number; description: string; hash: string; body: string; render: (vars: Record<string, string | number>) => string };

/** Carpeta de los prompts: junto a este paquete, o buscándola desde el directorio de trabajo (la app empaqueta el código). */
function promptsDir() {
  const candidates: string[] = [];
  try {
    candidates.push(join(dirname(fileURLToPath(import.meta.url)), "../prompts"));
  } catch {
    // empaquetado sin import.meta.url utilizable
  }
  for (let dir = process.cwd(), i = 0; i < 5; i++, dir = dirname(dir)) candidates.push(join(dir, "packages/agents/prompts"));
  const found = candidates.find((d) => existsSync(join(d, "copy.md")));
  if (!found) throw new Error("No encontré la carpeta de prompts (packages/agents/prompts)");
  return found;
}

const cache = new Map<string, Prompt>();

export function parsePrompt(text: string): Omit<Prompt, "render"> {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error("Prompt sin frontmatter");
  const meta = Object.fromEntries(
    m[1].split("\n").map((l) => {
      const i = l.indexOf(":");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
  );
  const body = m[2].replace(/\n+$/, "");
  return { id: meta.id, version: Number(meta.version), description: meta.description ?? "", body, hash: createHash("sha256").update(body).digest("hex").slice(0, 16) };
}

/** Reemplaza las {{variables}}; falla si falta alguna (mejor un error que un prompt con huecos). */
export function renderTemplate(body: string, vars: Record<string, string | number>, id = "prompt") {
  return body.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    if (!(name in vars)) throw new Error(`Al prompt "${id}" le falta la variable {{${name}}}`);
    return String(vars[name]);
  });
}

export function loadPrompt(id: string): Prompt {
  const hit = cache.get(id);
  if (hit) return hit;
  const parsed = parsePrompt(readFileSync(join(promptsDir(), `${id}.md`), "utf8"));
  if (parsed.id !== id) throw new Error(`El archivo ${id}.md declara id "${parsed.id}"`);
  const prompt = { ...parsed, render: (vars: Record<string, string | number>) => renderTemplate(parsed.body, vars, id) };
  cache.set(id, prompt);
  return prompt;
}

/** Todos los prompts (para el test de versiones y la documentación). */
export function listPrompts() {
  return readdirSync(promptsDir())
    .filter((f) => f.endsWith(".md"))
    .map((f) => loadPrompt(f.replace(/\.md$/, "")));
}

/** Fragmentos de prompt en JSON (ej. frases por técnica para las imágenes), también versionados. */
export function loadFragments<T>(id: string): { id: string; version: number; data: T } {
  const raw = JSON.parse(readFileSync(join(promptsDir(), `${id}.json`), "utf8")) as { id: string; version: number; data: T };
  return raw;
}

/** Estado actual de todos los prompts y fragmentos: id → versión y hash (lo que guarda prompts.lock.json). */
export function promptsSnapshot() {
  const dir = promptsDir();
  const out: Record<string, { version: number; hash: string }> = {};
  for (const p of listPrompts()) out[p.id] = { version: p.version, hash: p.hash };
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json") && x !== "prompts.lock.json")) {
    const raw = readFileSync(join(dir, f), "utf8");
    const { id, version, data } = JSON.parse(raw) as { id: string; version: number; data: unknown };
    out[id] = { version, hash: createHash("sha256").update(JSON.stringify(data)).digest("hex").slice(0, 16) };
  }
  return out;
}

export const promptsLockPath = () => join(promptsDir(), "prompts.lock.json");
