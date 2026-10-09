// Diseña las plantillas de un estilo a partir de una referencia (lo mismo que hace la app, desde la terminal).
// Uso: pnpm design:templates <imagen> [--piezas linkedin-square,agenda-slide] [--rondas 2] [--salida carpeta]
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { analyzeReference } from "@flock/agents";
import { closeRenderer } from "@flock/renderer";
import { designStyleTemplates } from "@flock/studio";
import { DESIGNED_PIECES, type DesignedPieceId } from "@flock/templates";

const ROOT = resolve(import.meta.dirname, "..");
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { piezas: { type: "string" }, rondas: { type: "string", default: "2" }, salida: { type: "string", default: join(ROOT, "storage", "diseños") } },
});
const ref = positionals[0];
if (!ref) throw new Error("Uso: pnpm design:templates <imagen> [--piezas …] [--rondas N]");
const pieces = (values.piezas?.split(",") as DesignedPieceId[] | undefined) ?? DESIGNED_PIECES;
await mkdir(values.salida!, { recursive: true });

const t0 = Date.now();
const reading = await analyzeReference([ref]);
console.log(`lectura: ${reading.model} · ${reading.style.layout} · ${reading.style.typography.display} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
const result = await designStyleTemplates({
  references: [ref],
  reading: reading.style,
  repoRoot: ROOT,
  pieces,
  rounds: Number(values.rondas),
  onProgress: (piece, step) =>
    console.log(`  ${piece}: ${typeof step === "string" ? step : `ronda ${step.round + 1} · puntaje ${step.score ?? "—"} · ${[...step.problems, ...step.fixes].slice(0, 3).join(" | ").slice(0, 220)}`}`),
});
for (const [piece, png] of Object.entries(result.previews)) await writeFile(join(values.salida!, `${piece}.png`), png!);
await writeFile(join(values.salida!, "plantillas.json"), JSON.stringify(result.templates, null, 2));
console.log(`listo en ${((Date.now() - t0) / 1000).toFixed(0)} s → ${values.salida}`, result.errors.length ? `\nerrores: ${result.errors.join(" | ")}` : "");
await closeRenderer();
