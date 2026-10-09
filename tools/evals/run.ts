// Evals de Flock Creative Studio: miden la calidad de los agentes y del diseño con casos fijos.
// Uso: pnpm evals [--suite copy,editor,reference,verifier,design]
// Guarda cada corrida en la base (eval_runs, eval_results) y escribe docs/evals/resultados.md.
// Ver docs/metricas-y-evals.md.
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs, promisify } from "node:util";
import { analyzeReference, interpretEdit, llmProviders, verifyPieceReading, writeEventCopy, type EditOperation } from "@flock/agents";
import { db, schema } from "@flock/db";
import { desc, eq } from "drizzle-orm";
import { closeRenderer, renderPngChecked } from "@flock/renderer";
import {
  agendaSlide,
  badge,
  buildKit,
  fontMeta,
  linkedinPost,
  resolveAssets,
  resolveStyle,
  STYLE_LIST,
  type AgendaItem,
  type EventInfo,
  type EventKit,
  type ReferenceStyle,
} from "@flock/templates";
import { differenceCiede2000 } from "culori";
import sharp from "sharp";

const ROOT = resolve(import.meta.dirname, "../..");
const run = promisify(execFile);
const { values } = parseArgs({ options: { suite: { type: "string", default: "copy,editor,reference,verifier,design" } } });
const suites = values.suite!.split(",").map((s) => s.trim());

type CaseResult = { caseId: string; score: number; passed: boolean; metrics: Record<string, unknown>; notes?: string; latencyMs?: number };
type Suite = { id: string; title: string; description: string; run: () => Promise<CaseResult[]> };

const casos = async <T>(name: string): Promise<T> => JSON.parse(await readFile(join(ROOT, "tools/evals/casos", `${name}.json`), "utf8"));
/** Corre tareas con un límite de concurrencia (las llamadas a modelos en paralelo, sin saturar). */
async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>) {
  const out: R[] = [];
  const queue = items.map((t, i) => [t, i] as const);
  await Promise.all(
    Array.from({ length: n }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) out[item[1]] = await fn(item[0]);
    }),
  );
  return out;
}
const timedCase = async (fn: () => Promise<Omit<CaseResult, "latencyMs">>): Promise<CaseResult> => {
  const t0 = Date.now();
  try {
    return { ...(await fn()), latencyMs: Date.now() - t0 };
  } catch (err) {
    return { caseId: "?", score: 0, passed: false, metrics: {}, notes: `error: ${err instanceof Error ? err.message : err}`, latencyMs: Date.now() - t0 };
  }
};
const ratio = (checks: Record<string, boolean>) => Object.values(checks).filter(Boolean).length / Object.values(checks).length;

// ─── 1. Textos ───────────────────────────────────────────────────────────────

const VOSEO = /\b(sumate|venite|vení|agendá|agendalo|anotate|sabés|tenés|podés|querés|contás|sumás|traé|preparate|acompañanos|hacé|mirá|participá)\b/i;
const EMOJI = /\p{Extended_Pictographic}/gu;

const copySuite: Suite = {
  id: "copy",
  title: "Textos",
  description: "Redacción de posteos, mensajes de Slack y landing: estructura por momentos, hashtag, largos, voseo, cantidad de emojis y que no invente datos.",
  async run() {
    const cases = await casos<{ id: string; event: EventInfo; agenda: AgendaItem[] }[]>("copy");
    return pool(cases, 3, (c) =>
      timedCase(async () => {
        const r = await writeEventCopy({ event: c.event, agenda: c.agenda });
        const li = r.content.linkedin;
        const sl = r.content.slack ?? [];
        const all = [...li.map((p) => p.post), ...sl.map((m) => m.text)];
        // Números permitidos: los que están en los datos del evento (fecha, horarios, año del nombre)
        const allowed = new Set(JSON.stringify(c).match(/\d+/g) ?? []);
        const invented = [...new Set(all.join(" ").match(/\d+/g) ?? [])].filter((n) => !allowed.has(n) && !allowed.has(String(Number(n))));
        const checks = {
          "lo escribió el modelo (no el texto base)": r.source === "llm",
          "3 posteos: antes, durante, después": li.length === 3 && ["antes", "durante", "despues"].every((m) => li.some((p) => p.moment === m)),
          "3 mensajes de Slack": sl.length === 3,
          "hashtag en cada posteo": li.every((p) => p.post.includes(c.event.hashtag)),
          "titulares de 2 a 6 palabras": [...li, ...sl].every((p) => p.headline.trim().split(/\s+/).length <= 6),
          "posteos de 300 a 1100 caracteres": li.every((p) => p.post.length >= 300 && p.post.length <= 1100),
          "hasta 3 emojis por posteo": all.every((t) => (t.match(EMOJI) ?? []).length <= 3),
          "no inventa números": invented.length === 0,
          [c.event.language === "es" ? "voseo rioplatense" : "en inglés"]:
            c.event.language === "es" ? all.some((t) => VOSEO.test(t)) : !/\b(el|la|los|del|para|con)\b/i.test(all.join(" ")),
        };
        const score = ratio(checks);
        return { caseId: c.id, score, passed: score === 1, metrics: { ...checks, model: r.model ?? r.source }, notes: invented.length ? `números que no están en los datos: ${invented.join(", ")}` : undefined };
      }),
    );
  },
};

// ─── 2. Chat de edición ──────────────────────────────────────────────────────

type EditExpect = { op: string; role?: string; value?: string; element?: string; field?: string; text?: string; number?: number; gt?: number; lt?: number; dark?: boolean; category?: string[] };
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const matches = (o: EditOperation, e: EditExpect) =>
  o.op === e.op &&
  (e.role == null || o.role === e.role) &&
  (e.value == null || o.value === e.value) &&
  (e.element == null || o.element === e.element) &&
  (e.field == null || o.field === e.field) &&
  (e.text == null || (o.text ?? "").toLowerCase().includes(e.text.toLowerCase())) &&
  (e.number == null || o.number === e.number) &&
  (e.gt == null || (o.number ?? 0) > e.gt) &&
  (e.lt == null || (o.number ?? 99) < e.lt) &&
  (!e.dark || (/^#[0-9a-f]{6}$/i.test(o.value ?? "") && luminance(o.value!) < 0.15)) &&
  (e.category == null || e.category.includes(fontMeta(o.value ?? "")?.category ?? ""));

const editorSuite: Suite = {
  id: "editor",
  title: "Chat de edición",
  description: "Pedidos en lenguaje natural → operaciones: tiene que proponer exactamente lo pedido, respetar el logo y no inventar operaciones para lo que no se puede.",
  async run() {
    const cases = await casos<{ id: string; message: string; piece?: { file: string; label: string; group: string; headline?: string; body?: string }; expect: EditExpect[]; allow?: EditExpect[]; forbid?: string[]; scope?: string }[]>("editor");
    return pool(cases, 4, (c) =>
      timedCase(async () => {
        const r = await interpretEdit({
          message: c.message,
          event: { name: "Hack Night 2026", style: "Grilla" },
          palette: { ground: "#fbf9f7", ink: "#1d1a17", accent: "#ff5102", accent2: "#3d7cff" },
          fonts: { display: "Archivo", body: "Archivo" },
          layout: "clasico",
          piece: c.piece ?? null,
          canRegenerateGraphics: false,
        });
        const found = c.expect.map((e) => r.operations.some((o) => matches(o, e)));
        // operaciones de más: las que no se pidieron ni son consecuencia aceptable (ej. ajustar el texto al cambiar el fondo)
        const extra = r.operations.filter((o) => ![...c.expect, ...(c.allow ?? [])].some((e) => matches(o, e)));
        const checks: Record<string, boolean> = {
          "propone lo pedido": found.every(Boolean),
          "no agrega operaciones de más": c.expect.length ? extra.length === 0 : r.operations.length === 0,
          ...(c.forbid ? { "no toca lo prohibido": !r.operations.some((o) => c.forbid!.includes(o.op)) } : {}),
          ...(c.scope ? { "alcance sugerido correcto": r.scope === c.scope } : {}),
        };
        const score = ratio(checks);
        return { caseId: c.id, score, passed: score === 1, metrics: { ...checks, ops: r.operations.map((o) => `${o.op}${o.value ? `:${o.value}` : ""}${o.element ? `:${o.element}` : ""}${o.number != null ? `:${o.number}` : ""}`) }, notes: r.reply };
      }),
    );
  },
};

// ─── 3. Lectura de referencias (ida y vuelta) ────────────────────────────────

const EVENT = { name: "Design Sprint 2027", date: "2027-04-15", language: "es" as const, location: "Oficinas Flock" };
async function render(kit: EventKit, piece: "post" | "slide" = "post") {
  const ctx = { kit, assets: await resolveAssets(kit, { kind: "inline", brandDir: join(ROOT, "brand") }) };
  return piece === "post"
    ? renderPngChecked(linkedinPost.render(ctx, { id: "a", headline: "Se viene el Design Sprint", body: "Cinco días para pasar de una idea a un prototipo.", post: "" }, "square"), linkedinPost.sizes.square)
    : renderPngChecked(agendaSlide.render(ctx, { start: "9:30", end: "10:30", title: "Charla de apertura" }, 0), agendaSlide.size);
}

const referenceSuite: Suite = {
  id: "reference",
  title: "Lectura de referencias",
  description:
    "Ida y vuelta: se renderiza una pieza con un estilo conocido, el modelo con visión la lee como si fuera una referencia y se compara lo que leyó con el estilo de origen (composición, caja, esquema, tipo de letra, color de fondo).",
  async run() {
    const fixtures: Record<string, ReferenceStyle> = JSON.parse(await readFile(join(ROOT, "tools/diversidad/fixtures.json"), "utf8"));
    const tmp = join(ROOT, "storage", "evals");
    await mkdir(tmp, { recursive: true });
    const sources = [
      ...Object.entries(fixtures).map(([id, ref]) => ({ id, kit: buildKit({ event: EVENT, styleId: "referencia", seed: 1, reference: ref }) })),
      ...STYLE_LIST.map((s) => ({ id: s.id, kit: buildKit({ event: EVENT, styleId: s.id, seed: 2 }) })),
    ];
    const images = [];
    for (const s of sources) {
      const file = join(tmp, `ref-${s.id}.png`);
      await writeFile(file, (await render(s.kit)).png);
      images.push({ ...s, file });
    }
    await closeRenderer();
    return pool(images, 3, (s) =>
      timedCase(async () => {
        const r = await analyzeReference([s.file]);
        const want = s.kit.style;
        // caja efectiva de los títulos: la del estilo, ajustada por la combinación de fuentes de la variante
        const transform = { ...resolveStyle(s.kit).display, ...s.kit.style.display }.transform;
        const expectedCase = transform === "uppercase" ? "upper" : transform === "lowercase" ? "lower" : "title";
        // En "bloques" el plano de color ocupa casi toda la pieza: leerlo como fondo también es correcto
        const de = differenceCiede2000();
        const candidates = want.layout === "bloques" ? [want.palette.ground, want.palette.accent] : [want.palette.ground];
        const groundDelta = Math.min(...candidates.map((c) => de(r.style.colors.ground, c)));
        const schemeOk = want.layout === "bloques" ? true : r.style.scheme === want.palette.scheme;
        const checks: Record<string, boolean> = {
          "composición": r.style.layout === want.layout,
          "esquema claro / oscuro": schemeOk,
          "tipo de letra (categoría)": fontMeta(r.style.typography.display)?.category === fontMeta(want.fonts.display)?.category,
          "color de fondo (ΔE < 12)": groundDelta < 12,
          "caja de los títulos": r.style.typography.case === expectedCase,
        };
        const score = ratio(checks);
        return {
          caseId: s.id,
          score,
          passed: score >= 0.8,
          metrics: { ...checks, leído: `${r.style.layout} · ${r.style.typography.display} · ${r.style.typography.case} · ${r.style.colors.ground}`, origen: `${want.layout} · ${want.fonts.display} · ${want.palette.ground}`, deltaE: Math.round(groundDelta) },
        };
      }),
    );
  },
};

// ─── 4. Verificador de lectura ───────────────────────────────────────────────

const verifierSuite: Suite = {
  id: "verifier",
  title: "Verificador de lectura",
  description: "Piezas sanas y piezas rotas a propósito (hora cortada, nombre tapado, título que se sale): el verificador tiene que marcar las rotas y dejar pasar las sanas.",
  async run() {
    const kit = buildKit({ event: { name: "Hack Night 2026", date: "2026-11-27", language: "es" }, styleId: "iridiscente", seed: 3 });
    const ctx = { kit, assets: await resolveAssets(kit, { kind: "inline", brandDir: join(ROOT, "brand") }) };
    const slide = agendaSlide.render(ctx, { start: "19:00", end: "19:30", title: "Armado de equipos" }, 0);
    const person = { firstName: "María Constanza", lastName: "Fernández de la Fuente", area: "Desarrollo" };
    const card = badge.render(ctx, person);
    const cases = [
      { id: "slide-sana", html: slide, size: agendaSlide.size, broken: false, expected: [{ field: "hora de inicio", value: "19:00" }, { field: "título", value: "Armado de equipos" }] },
      {
        id: "slide-hora-cortada",
        html: slide.replace('data-fit data-fit-min="120"', "").replace("</style>", ".bloques .big-time{width:auto!important;font-size:300px}</style>"),
        size: agendaSlide.size,
        broken: true,
        expected: [{ field: "hora de inicio", value: "19:00" }, { field: "título", value: "Armado de equipos" }],
      },
      { id: "credencial-sana", html: card, size: badge.size, broken: false, expected: [{ field: "nombre", value: person.firstName }, { field: "apellido", value: person.lastName }] },
      {
        id: "credencial-apellido-tapado",
        // el apellido se corta a la mitad: caja angosta que lo recorta (lo que haría un nombre largo sin ajuste)
        html: card.replace('data-fit data-fit-min="24"', "").replace("</style>", ".last{width:180px!important;overflow:hidden!important;white-space:nowrap!important}</style>"),
        size: badge.size,
        broken: true,
        expected: [{ field: "nombre", value: person.firstName }, { field: "apellido", value: person.lastName }],
      },
      {
        id: "slide-titulo-fuera",
        html: slide.replace("</style>", ".bloques .title-big{left:1500px!important;right:auto!important;width:1200px;white-space:nowrap}</style>"),
        size: agendaSlide.size,
        broken: true,
        expected: [{ field: "hora de inicio", value: "19:00" }, { field: "título", value: "Armado de equipos" }],
      },
    ];
    const shots = [];
    for (const c of cases) shots.push({ ...c, png: (await renderPngChecked(c.html, c.size)).png });
    await closeRenderer();
    return pool(shots, 3, (c) =>
      timedCase(async () => {
        const r = await verifyPieceReading(c.png, c.expected);
        const flagged = !r.ok;
        const passed = flagged === c.broken;
        return {
          caseId: c.id,
          score: passed ? 1 : 0,
          passed,
          metrics: { "rota a propósito": c.broken, "marcada": flagged, leído: r.fields.map((f) => `${f.field}: ${f.status} «${f.read}»`) },
        };
      }),
    );
  },
};

// ─── 5. Diseño y diversidad (sin modelos) ────────────────────────────────────

const designSuite: Suite = {
  id: "design",
  title: "Diseño y diversidad",
  description:
    "Sin modelos: cada estilo del catálogo en sus 3 variantes, posteo y slide. Ningún texto recortado, el detector de Impeccable sin hallazgos, y que las variantes se diferencien de verdad (distancia visual y combinaciones distintas de composición y fuente).",
  async run() {
    const results: CaseResult[] = [];
    const thumbs: { id: string; data: Buffer }[] = [];
    const combos = new Set<string>();
    const qa = join(ROOT, "storage", "evals", "design");
    await mkdir(qa, { recursive: true });
    const htmlFiles: string[] = [];
    for (const s of STYLE_LIST)
      for (const seed of [1, 2, 3]) {
        const kit = buildKit({ event: { ...EVENT, tagline: "Diseñar juntos, más rápido" }, styleId: s.id, seed });
        combos.add(`${kit.style.layout}|${kit.style.fonts.display}`);
        const t0 = Date.now();
        const post = await render(kit, "post");
        const slide = await render(kit, "slide");
        const ctx = { kit, assets: await resolveAssets(kit, { kind: "inline", brandDir: join(ROOT, "brand") }) };
        const htmlFile = join(qa, `${s.id}-${seed}.html`);
        await writeFile(htmlFile, linkedinPost.render(ctx, { id: "a", headline: "Se viene el Design Sprint", body: "Cinco días.", post: "" }, "square"));
        htmlFiles.push(htmlFile);
        thumbs.push({ id: `${s.id}-${seed}`, data: await sharp(post.png).resize(24, 24, { fit: "fill" }).removeAlpha().raw().toBuffer() });
        const issues = [...post.issues, ...slide.issues];
        results.push({
          caseId: `${s.id}-${seed}`,
          score: issues.length ? 0 : 1,
          passed: !issues.length,
          metrics: { composición: kit.style.layout, fuente: kit.style.fonts.display, "textos recortados": issues.length },
          notes: issues.map((i) => `${i.kind}: ${i.text}`).join(" · ") || undefined,
          latencyMs: Date.now() - t0,
        });
      }
    await closeRenderer();

    // Impeccable sobre los posteos
    let findings = 0;
    try {
      await run(join(ROOT, ".claude/skills/impeccable/scripts/impeccable"), ["detect", "--no-advisory", ...htmlFiles], { cwd: ROOT });
    } catch (err) {
      findings = ((err as { stdout?: string }).stdout ?? "").split("\n").filter((l) => /^\s+\[/.test(l)).length;
    }
    results.push({ caseId: "impeccable", score: findings ? 0 : 1, passed: !findings, metrics: { hallazgos: findings } });

    // Diversidad: distancia media entre miniaturas (0 = idénticas, 1 = opuestas) y combinaciones distintas
    let sum = 0;
    let pairs = 0;
    for (let i = 0; i < thumbs.length; i++)
      for (let j = i + 1; j < thumbs.length; j++) {
        let d = 0;
        for (let k = 0; k < thumbs[i].data.length; k++) d += Math.abs(thumbs[i].data[k] - thumbs[j].data[k]);
        sum += d / (thumbs[i].data.length * 255);
        pairs++;
      }
    const distance = sum / pairs;
    results.push({
      caseId: "diversidad",
      score: Math.min(1, distance / 0.25) * 0.5 + Math.min(1, combos.size / thumbs.length) * 0.5,
      passed: distance >= 0.2 && combos.size >= thumbs.length * 0.75,
      metrics: { "distancia visual media": Number(distance.toFixed(3)), "combinaciones composición + fuente": `${combos.size} de ${thumbs.length}` },
    });
    return results;
  },
};

// ─── Corrida ─────────────────────────────────────────────────────────────────

const ALL = [copySuite, editorSuite, referenceSuite, verifierSuite, designSuite];
const needsLlm = new Set(["copy", "editor", "reference", "verifier"]);
const sha = (await run("git", ["rev-parse", "HEAD"], { cwd: ROOT }).catch(() => ({ stdout: "" }))).stdout.trim() || null;
const config = { providers: llmProviders(), claude: process.env.CLAUDE_MODELS, gemini: process.env.GEMINI_MODELS };
const ran: string[] = [];
const when = (d: Date) => d.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" });

for (const suite of ALL.filter((s) => suites.includes(s.id))) {
  if (needsLlm.has(suite.id) && !llmProviders().length) {
    console.log(`· ${suite.title}: sin proveedor de LLM, se saltea`);
    continue;
  }
  console.log(`▸ ${suite.title}…`);
  const t0 = Date.now();
  const results = await suite.run();
  const score = results.reduce((a, r) => a + r.score, 0) / (results.length || 1);
  const passed = results.filter((r) => r.passed).length;
  const [row] = await db
    .insert(schema.evalRuns)
    .values({ suite: suite.id, durationMs: Date.now() - t0, gitSha: sha, config, cases: results.length, passed, score })
    .returning();
  if (results.length) await db.insert(schema.evalResults).values(results.map((r) => ({ runId: row.id, ...r })));
  console.log(`  ${passed}/${results.length} casos · puntaje ${Math.round(score * 100)} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  for (const r of results.filter((x) => !x.passed)) console.log(`  ✗ ${r.caseId}: ${JSON.stringify(r.metrics)}${r.notes ? ` · ${r.notes}` : ""}`);

  ran.push(suite.id);
}

// Reporte con la última corrida de cada suite (no solo las de esta vez)
if (ran.length) {
  const report: string[] = [];
  for (const suite of ALL) {
    const [last] = await db.select().from(schema.evalRuns).where(eq(schema.evalRuns.suite, suite.id)).orderBy(desc(schema.evalRuns.startedAt)).limit(1);
    if (!last) continue;
    const results = await db.select().from(schema.evalResults).where(eq(schema.evalResults.runId, last.id));
    report.push(
      `## ${suite.title} · ${Math.round((last.score ?? 0) * 100)}/100 (${last.passed} de ${last.cases} casos)`,
      "",
      `${suite.description}`,
      "",
      `Corrida: ${when(last.startedAt)} · ${Math.round((last.durationMs ?? 0) / 1000)} s · commit ${last.gitSha?.slice(0, 7) ?? "?"}`,
      "",
      "| Caso | Puntaje | Detalle |",
      "|---|---|---|",
      ...results.map((r) => {
        const metrics = (r.metrics ?? {}) as Record<string, unknown>;
        const failed = Object.entries(metrics)
          .filter(([, v]) => v === false)
          .map(([k]) => k);
        const info = Object.entries(metrics)
          .filter(([, v]) => typeof v !== "boolean")
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join("; ") : v}`);
        const detail = [failed.length ? `falla: ${failed.join(", ")}` : "", ...info, r.notes ?? ""].filter(Boolean).join(" · ").replace(/\|/g, "/").replace(/\n/g, " ").slice(0, 400);
        return `| ${r.passed ? "✅" : "❌"} ${r.caseId} | ${Math.round(r.score * 100)} | ${detail} |`;
      }),
      "",
    );
  }
  const header = [
    "# Resultados de las evals",
    "",
    `Generado: ${when(new Date())} · proveedores ${config.providers.join(", ") || "ninguno"}. Muestra la última corrida de cada suite.`,
    "Se genera con `pnpm evals` (ver [../metricas-y-evals.md](../metricas-y-evals.md)). El historial completo queda en la base (`eval_runs`, `eval_results`) y en la página Métricas.",
    "",
  ];
  await mkdir(join(ROOT, "docs/evals"), { recursive: true });
  await writeFile(join(ROOT, "docs/evals/resultados.md"), [...header, ...report].join("\n"));
  console.log("Reporte: docs/evals/resultados.md");
}
process.exit(0);
