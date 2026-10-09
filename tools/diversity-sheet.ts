// Hoja de contactos para medir la diversidad de lo que genera el sistema.
// Renderiza las mismas piezas con un set de referencias bien distintas y con los estilos del catálogo,
// y arma una sola imagen para comparar de un vistazo (antes / después de cada cambio).
//
// Uso: pnpm diversity --label despues [--fresh] [--critic] --ref praktika=/ruta/a/imagen.webp --ref pixel=/ruta.png
//   --ref nombre=ruta  referencias reales (se leen con visión; la lectura se guarda en caché)
//   --fresh            vuelve a leer las referencias (después de cambiar el esquema de lectura)
//   --critic           además corre el crítico de fidelidad sobre cada referencia real
// Las referencias de tools/diversidad/fixtures.json son lecturas escritas a mano (no hay imagen).
// Salida: storage/diversidad/hoja-<label>.png (storage/ no se publica: las referencias pueden ser de terceros).
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { analyzeReference } from "@flock/agents";
import { closeRenderer, renderFullPage, renderPng } from "@flock/renderer";
import { refineReferenceStyle } from "@flock/studio";
import {
  agendaSlide,
  buildKit,
  linkedinPost,
  resolveAssets,
  STYLE_LIST,
  type AgendaItem,
  type EventKit,
  type KitInput,
  type ReferenceStyle,
} from "@flock/templates";
import sharp from "sharp";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = join(ROOT, "storage", "diversidad");
const { values } = parseArgs({
  options: {
    label: { type: "string", default: "hoja" },
    ref: { type: "string", multiple: true, default: [] },
    fresh: { type: "boolean", default: false },
    critic: { type: "boolean", default: false },
  },
});

const EVENT: KitInput["event"] = { name: "Design Sprint 2027", date: "2027-04-15", language: "es", location: "Oficinas Flock", tagline: "Diseñar juntos, más rápido" };
const POST = { id: "anuncio", headline: "Se viene el Design Sprint", body: "Cinco días para pasar de una idea a un prototipo probado con usuarios.", post: "" };
const ITEM: AgendaItem = { start: "9:30", end: "10:30", title: "Charla de apertura", speaker: "Equipo de Diseño" };

type Row = { name: string; note: string; thumb?: string; kits: { caption: string; kit: EventKit }[] };

await mkdir(join(OUT, "cache"), { recursive: true });
const rows: Row[] = [];

// ─── Referencias reales (lectura con visión, en caché) ──────────────────────
for (const spec of values.ref!) {
  const [name, file] = spec.split("=");
  if (!name || !file || !existsSync(file)) throw new Error(`--ref inválido: ${spec}`);
  const cache = join(OUT, "cache", `${name}.json`);
  let style: ReferenceStyle;
  let note: string;
  if (!values.fresh && existsSync(cache)) ({ style, note } = JSON.parse(await readFile(cache, "utf8")));
  else {
    console.log(`Leyendo ${name}…`);
    const analysis = await analyzeReference([file]);
    style = analysis.style;
    note = `${analysis.model} · ${analysis.medium}`;
    note += ` · ${style.layout ?? "sin composición"} · ${style.typography.display}`;
    if (values.critic) {
      const refined = await refineReferenceStyle({ references: [file], style, repoRoot: ROOT, log: (m) => console.log(`  ${m}`) });
      style = refined.style;
      note += ` · crítico: ${refined.history.map((h) => h.score).join(" → ")} · queda ${style.layout} · ${style.typography.display}`;
    }
    await writeFile(cache, JSON.stringify({ style, note }, null, 2));
  }
  const thumb = `data:image/png;base64,${(await sharp(file).resize(360, 360, { fit: "inside" }).png().toBuffer()).toString("base64")}`;
  rows.push({ name, note, thumb, kits: variants(style) });
}

// ─── Referencias escritas a mano ────────────────────────────────────────────
const fixtures: Record<string, ReferenceStyle> = JSON.parse(await readFile(join(ROOT, "tools/diversidad/fixtures.json"), "utf8"));
for (const [name, style] of Object.entries(fixtures)) rows.push({ name, note: "lectura escrita a mano", kits: variants(style) });

// ─── Estilos del catálogo ───────────────────────────────────────────────────
for (const s of STYLE_LIST)
  rows.push({
    name: s.name,
    note: "catálogo",
    kits: [1, 2, 3].map((seed) => ({ caption: `variante ${seed}`, kit: buildKit({ event: EVENT, styleId: s.id, seed }) })),
  });

function variants(reference: ReferenceStyle) {
  return [1, 2].map((seed) => ({ caption: `variante ${seed}`, kit: buildKit({ event: EVENT, styleId: "referencia", seed, reference }) }));
}

// ─── Render ─────────────────────────────────────────────────────────────────
const small = async (png: Buffer, width: number) => `data:image/png;base64,${(await sharp(png).resize(width).png().toBuffer()).toString("base64")}`;
let html = "";
try {
  for (const row of rows) {
    console.log(`Renderizando ${row.name}…`);
    const cells: string[] = [];
    for (const [i, { caption, kit }] of row.kits.entries()) {
      const ctx = { kit, assets: await resolveAssets(kit, { kind: "inline", brandDir: join(ROOT, "brand") }) };
      const square = await small(await renderPng(linkedinPost.render(ctx, POST, "square"), linkedinPost.sizes.square), 300);
      cells.push(`<figure><img src="${square}" width="300"><figcaption>posteo · ${caption}</figcaption></figure>`);
      // El cronograma solo en la primera variante (la fila ya muestra cómo cambia el posteo)
      if (i === 0) {
        const slide = await small(await renderPng(agendaSlide.render(ctx, ITEM, 0), agendaSlide.size), 533);
        cells.push(`<figure><img src="${slide}" width="533"><figcaption>cronograma · ${caption}</figcaption></figure>`);
      }
    }
    html += `<section><header><h2>${row.name}</h2><p>${row.note}</p>${row.thumb ? `<img class="ref" src="${row.thumb}">` : ""}</header>${cells.join("")}</section>`;
  }
  const page = `<!doctype html><html><head><meta charset="utf-8"><style>
body { margin: 0; padding: 40px; background: #ecebe5; font: 15px/1.4 system-ui, sans-serif; color: #161616; }
h1 { font-size: 34px; margin: 0 0 28px; }
section { display: flex; gap: 18px; align-items: flex-start; padding: 22px 0; border-top: 1.5px solid #16161633; }
header { flex: 0 0 210px; }
h2 { font-size: 19px; margin: 0 0 4px; }
header p { margin: 0 0 10px; color: #55534d; font-size: 12px; }
.ref { max-width: 200px; max-height: 200px; border: 1px solid #16161633; }
figure { margin: 0; }
figure img { display: block; border: 1px solid #16161622; }
figcaption { font-size: 11px; color: #55534d; margin-top: 5px; }
</style></head><body><h1>Diversidad · ${values.label}</h1>${html}</body></html>`;
  const out = join(OUT, `hoja-${values.label}.png`);
  await writeFile(out, await renderFullPage(page, 2200));
  console.log(`Listo: ${out}`);
} finally {
  await closeRenderer();
}
