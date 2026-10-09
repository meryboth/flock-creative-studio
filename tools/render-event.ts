// Genera todas las piezas de un evento definido en events/<slug>/ (sin pasar por la app).
// Uso: pnpm render:event ai-day-2026 [--style grilla] [--seed 3] [--copy gemini]
//   event.json   datos del evento y estilo
//   content.json textos (opcional: si falta, o con --copy gemini, se redactan con Gemini)
//   agenda.csv, attendees.csv
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { fallbackCopy, writeEventCopy } from "@flock/agents";
import { generateFamily, parseAgenda, parseAttendees } from "@flock/studio";
import { buildKit, type EventContent, type KitInput, type StyleId } from "@flock/templates";

const ROOT = resolve(import.meta.dirname, "..");
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { style: { type: "string" }, seed: { type: "string" }, copy: { type: "string" } },
});
const slug = positionals[0];
if (!slug) {
  console.error("Uso: pnpm render:event <slug> [--style iridiscente|grilla|flock|organico] [--seed N] [--copy gemini]");
  process.exit(1);
}

const eventDir = join(ROOT, "events", slug);
const spec: Omit<KitInput, "keyVisual"> & { keyVisual?: string } = JSON.parse(await readFile(join(eventDir, "event.json"), "utf8"));
const read = async (f: string) => (existsSync(join(eventDir, f)) ? readFile(join(eventDir, f), "utf8") : "");
const agenda = parseAgenda(await read("agenda.csv"));
const attendees = parseAttendees(await read("attendees.csv"));

const styleId = (values.style as StyleId) ?? spec.styleId;
const kit = buildKit({
  ...spec,
  styleId,
  seed: values.seed ? Number(values.seed) : spec.seed,
  // la imagen propia solo acompaña al estilo para el que fue pensada
  keyVisual:
    spec.keyVisual && styleId === spec.styleId && existsSync(join(eventDir, spec.keyVisual)) ? { file: spec.keyVisual, fit: "top" } : undefined,
});

let content: EventContent;
if (values.copy === "gemini" || !existsSync(join(eventDir, "content.json"))) {
  console.log("Redactando textos con Gemini…");
  const result = await writeEventCopy({ event: kit.event, agenda });
  console.log(`  textos: ${result.source}${result.model ? ` (${result.model})` : ""}${result.error ? ` · ${result.error}` : ""}`);
  content = result.content;
} else {
  content = JSON.parse(await readFile(join(eventDir, "content.json"), "utf8"));
}
content ??= fallbackCopy({ event: kit.event, agenda });

const outName = values.style || values.seed ? `${slug}--${styleId}-${kit.style.seed}` : slug;
console.log(`Renderizando ${kit.event.name} · estilo ${styleId} · semilla ${kit.style.seed} → storage/${outName}`);
const result = await generateFamily({
  kit,
  content,
  agenda,
  attendees,
  repoRoot: ROOT,
  outDir: join(ROOT, "storage", outName),
  keyVisualPath: kit.style.keyVisual ? join(eventDir, kit.style.keyVisual.file) : undefined,
});
console.log(`Listo: ${result.pieces.length} piezas en ${result.seconds.toFixed(1)} s`);
console.log(`QA de diseño: ${result.qaReport}`);
