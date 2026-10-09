import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { removeBackground } from "@imgly/background-removal-node";
import { converter } from "culori";
import sharp from "sharp";

export type KeyVisualResult =
  | { ok: true; file: string; provider: string; model: string; seconds: number }
  | { ok: false; error: string; quota?: boolean };

type KeyVisualOptions = {
  references: string[]; // imágenes de referencia (solo las usa Gemini; ComfyUI trabaja con el prompt)
  prompt: string; // descripción del visual, escrita por el modelo de visión
  ground: string; // color de fondo del estilo, para que el visual se funda con las piezas
  outFile: string;
  repoRoot: string; // para leer los workflows de comfy/workflows
  seed?: number;
};

type Provider = (opts: KeyVisualOptions) => Promise<{ model: string }>;

const NEGATIVE =
  "text, letters, words, numbers, typography, watermark, logo, signature, frame, border, ui, full frame texture, busy background, pattern, cropped, pedestal, stand, floor, table, horizon, low quality, blurry, jpeg artifacts";

/**
 * Prompt del visual. Los modelos de difusión dan más peso al principio del texto y no entienden
 * colores en hexadecimal: primero la composición, y el fondo descrito con palabras.
 */
const visualPrompt = (o: KeyVisualOptions) =>
  `A single abstract 3D sculpture floating in empty space, centered, no pedestal, no floor, surrounded by lots of negative space, isolated on a plain flat ${colorName(o.ground)} background. Object style: ${o.prompt}. No text, no letters, no logos.`;

const toOklch = converter("oklch");

/** Nombre aproximado de un color en inglés ("dark navy blue", "light warm gray"…) para prompts. */
export function colorName(hex: string) {
  const c = toOklch(hex);
  if (!c) return "dark";
  const l = c.l;
  const chroma = c.c ?? 0;
  const h = c.h ?? 0;
  const tone = l < 0.25 ? "very dark" : l < 0.45 ? "dark" : l < 0.7 ? "medium" : l < 0.9 ? "light" : "very light";
  if (chroma < 0.03) return `${tone} ${l < 0.15 ? "black" : l > 0.95 ? "white" : "gray"}`;
  const hues: [number, string][] = [
    [20, "red"], [55, "orange"], [85, "amber"], [115, "yellow"], [170, "green"], [200, "teal"],
    [240, "cyan blue"], [280, "navy blue"], [305, "indigo violet"], [335, "purple"], [360, "magenta red"],
  ];
  return `${tone} ${hues.find(([max]) => h < max)?.[1] ?? "red"}`;
}

/**
 * Genera un visual original inspirado en la referencia, sin texto ni logos.
 * Prueba los proveedores de KEYVISUAL_PROVIDERS en orden (por defecto: ComfyUI local, después Gemini).
 */
export async function generateKeyVisual(opts: KeyVisualOptions): Promise<KeyVisualResult> {
  const order = (process.env.KEYVISUAL_PROVIDERS ?? "comfyui,gemini").split(",").map((p) => p.trim());
  const providers: Record<string, Provider> = { comfyui: comfyui, gemini: geminiImage };
  const errors: string[] = [];
  let quota = false;

  for (const name of order) {
    const provider = providers[name];
    if (!provider) continue;
    const t0 = Date.now();
    try {
      const { model } = await provider(opts);
      // Si el recorte falla, la imagen generada igual sirve (con su fondo): no se pierde el trabajo
      await cutout(opts.outFile).catch((err) => console.warn("[keyvisual] no se pudo recortar:", err instanceof Error ? err.message : err));
      return { ok: true, file: opts.outFile, provider: name, model, seconds: (Date.now() - t0) / 1000 };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (err instanceof QuotaError) quota = true;
      errors.push(`${name}: ${message}`);
    }
  }
  return {
    ok: false,
    quota,
    error: errors.length
      ? `No se pudo generar el key visual. ${errors.join(" · ")}`
      : "No hay proveedores de imagen configurados (KEYVISUAL_PROVIDERS)",
  };
}

class QuotaError extends Error {}

/**
 * Recorta el objeto generado (fondo transparente, local con ONNX) para que se apoye sobre el fondo real
 * del estilo: los modelos no siempre respetan el color de fondo pedido.
 */
async function cutout(file: string) {
  const png = await readFile(file);
  const blob = await removeBackground(new Blob([new Uint8Array(png)], { type: "image/png" }), {
    model: "medium",
    output: { format: "image/png", quality: 1 },
  });
  const { data, info } = await sharp(Buffer.from(await blob.arrayBuffer())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // Limpiar el halo casi transparente que deja el fondo original
  for (let i = 3; i < data.length; i += 4) if (data[i] < 40) data[i] = 0;
  await writeFile(file, await sharp(data, { raw: info }).trim({ threshold: 1 }).png().toBuffer());
}

// ─── ComfyUI local ──────────────────────────────────────────────────────────

const comfyui: Provider = async (opts) => {
  const base = (process.env.COMFYUI_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
  const checkpoint = process.env.COMFYUI_CHECKPOINT ?? "sd_xl_base_1.0.safetensors";

  const alive = await fetch(`${base}/system_stats`, { signal: AbortSignal.timeout(2500) }).catch(() => null);
  if (!alive?.ok) throw new Error(`no está corriendo en ${base} (abrí Comfy Desktop)`);

  const template = await readFile(join(opts.repoRoot, "comfy/workflows/keyvisual_sdxl.json"), "utf8");
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const workflow = JSON.parse(
    template
      .replace('"{{seed}}"', String(seed))
      .replace("{{checkpoint}}", checkpoint)
      .replace("{{prompt}}", jsonText(visualPrompt(opts)))
      .replace("{{negative}}", jsonText(NEGATIVE)),
  );

  const queued = await fetch(`${base}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow, client_id: randomUUID() }),
  });
  const body = (await queued.json().catch(() => ({}))) as { prompt_id?: string; error?: { message?: string }; node_errors?: unknown };
  if (!queued.ok || !body.prompt_id) {
    const detail = body.error?.message ?? JSON.stringify(body.node_errors ?? body).slice(0, 200);
    throw new Error(`rechazó el workflow: ${detail}`);
  }

  // Esperar a que termine (SDXL en Apple Silicon tarda entre uno y tres minutos)
  const deadline = Date.now() + 6 * 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    const history = (await (await fetch(`${base}/history/${body.prompt_id}`)).json()) as Record<
      string,
      { status?: { status_str?: string; messages?: unknown[] }; outputs?: Record<string, { images?: { filename: string; subfolder: string; type: string }[] }> }
    >;
    const entry = history[body.prompt_id];
    if (!entry) continue;
    if (entry.status?.status_str === "error") throw new Error("falló al generar (ver la consola de ComfyUI)");
    const image = Object.values(entry.outputs ?? {}).flatMap((o) => o.images ?? [])[0];
    if (!image) continue;
    const q = new URLSearchParams({ filename: image.filename, subfolder: image.subfolder, type: image.type });
    const png = Buffer.from(await (await fetch(`${base}/view?${q}`)).arrayBuffer());
    await writeFile(opts.outFile, await sharp(png).png().toBuffer());
    return { model: checkpoint };
  }
  throw new Error("tardó más de 6 minutos");
};

// Texto seguro para insertar dentro de un string JSON del workflow
const jsonText = (s: string) => JSON.stringify(s).slice(1, -1);

// ─── Gemini (API) ───────────────────────────────────────────────────────────

const geminiImage: Provider = async (opts) => {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY no configurada");
  const models = (process.env.GEMINI_IMAGE_MODELS ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  if (!models.length) throw new Error("no hay modelos de imagen configurados (GEMINI_IMAGE_MODELS)");
  const refs = await Promise.all(
    opts.references.slice(0, 3).map(async (f) => (await sharp(await readFile(f)).resize(1024, 1024, { fit: "inside" }).jpeg({ quality: 85 }).toBuffer()).toString("base64")),
  );
  const prompt = `${visualPrompt(opts)}
Use the attached images ONLY as stylistic inspiration (palette, materials, lighting, mood); do not copy them. Square format.`;

  let lastError = "";
  let quota = false;
  for (const model of models) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [...refs.map((data) => ({ inline_data: { mime_type: "image/jpeg", data } })), { text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
      signal: AbortSignal.timeout(120_000),
    }).catch((err: Error) => ({ ok: false, status: 0, json: async () => ({ error: { message: err.message } }) }) as const);
    const body = (await res.json().catch(() => ({}))) as {
      error?: { message: string };
      candidates?: { content?: { parts?: { inlineData?: { data: string } }[] } }[];
    };
    if (res.status === 429) quota = true;
    const image = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
    if (image) {
      await writeFile(opts.outFile, await sharp(Buffer.from(image, "base64")).png().toBuffer());
      return { model };
    }
    lastError = `${model}: ${body.error?.message?.split(".")[0] ?? "la respuesta no trajo imagen"}`;
  }
  throw quota ? new QuotaError("sin cuota para generar imágenes (hay que activar la facturación)") : new Error(lastError);
};
