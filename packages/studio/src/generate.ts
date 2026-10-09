import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { promisify } from "node:util";
import { llmProviders, verifyPieceReading, type ExpectedField, type FieldCheck } from "@flock/agents";
import { closeRenderer, renderFullPage, renderPdf, renderPngChecked, type RenderIssue } from "@flock/renderer";
import { OUTPUT_IDS, type OutputId } from "./outputs";
import {
  agendaSlide,
  agendaSummary,
  badge,
  badgeSheet,
  certificate,
  landing,
  linkedinPost,
  resolveAssets,
  type AgendaItem,
  type Attendee,
  type EventContent,
  type EventKit,
  type LinkedInFormat,
  type PieceOptions,
  type RenderContext,
  type ResolvedAssets,
} from "@flock/templates";

export type PieceType = "linkedin" | "linkedin-text" | "slack" | "slack-text" | "agenda-slide" | "agenda-summary" | "badge" | "badge-sheet" | "certificate" | "landing";

export type GeneratedPiece = { type: PieceType; template: string; file: string; label: string };

export type GenerateInput = {
  kit: EventKit;
  content: EventContent;
  agenda: AgendaItem[];
  attendees: Attendee[];
  repoRoot: string;
  outDir: string; // carpeta absoluta de salida (se reemplazan sus carpetas de piezas)
  keyVisualPath?: string;
  elementPaths?: string[]; // elementos decorativos generados para el estilo
  outputs?: OutputId[]; // grupos a generar (por defecto, todos)
  // Verificador de lectura con visión sobre una muestra de piezas (por defecto, si hay un LLM configurado)
  verifyReading?: boolean;
  // Ajustes por pieza (editor conversacional). `file` es la ruta relativa de la pieza, ej. "linkedin/anuncio-square.png"
  adjust?: (piece: { file: string; type: PieceType }) => PieceAdjust | undefined;
  onProgress?: (done: number, total: number, label: string) => void | Promise<void>;
};

/** Control de calidad de una pieza: geométrico (todas) y de lectura (una muestra). */
export type PieceCheck = { issues: RenderIssue[]; autoFixed: number; reading?: FieldCheck[] };

export type GenerateResult = {
  pieces: GeneratedPiece[];
  qaReport: string;
  seconds: number;
  checks: Record<string, PieceCheck>; // clave: ruta de la pieza; solo las que tienen algo para revisar o se corrigieron solas
  verified: number; // piezas que leyó el verificador
};

/** Ajuste de una pieza pedido en el editor: otro kit (colores, fuentes) y/o opciones de plantilla. */
export type PieceAdjust = { kit?: EventKit; options?: PieceOptions };

/** Genera la familia completa de piezas de un evento. */
export async function generateFamily(input: GenerateInput): Promise<GenerateResult> {
  const { kit, content, repoRoot } = input;
  const want = new Set(input.outputs ?? OUTPUT_IDS);
  // Lo que no se pide no se genera (ni cuenta para el progreso)
  const agenda = want.has("cronograma") ? input.agenda : [];
  const linkedin = want.has("linkedin") ? content.linkedin : [];
  const slack = want.has("slack") ? (content.slack ?? []) : [];
  const badgePeople = want.has("credenciales") ? input.attendees.filter((a) => a.attendance !== "remoto") : [];
  const certPeople = want.has("certificados") ? input.attendees : [];
  // Se genera en una carpeta aparte y se reemplaza al final: las piezas anteriores siguen visibles mientras tanto
  const outDir = `${input.outDir}.next`;
  const t0 = Date.now();
  // Assets por combinación de fuentes y esquema (un ajuste puede cambiar la tipografía o el fondo)
  const assetsCache = new Map<string, Promise<ResolvedAssets>>();
  const assetsFor = (k: EventKit) => {
    const key = `${k.style.fonts.display}|${k.style.fonts.body}|${k.style.palette.scheme}`;
    if (!assetsCache.has(key))
      assetsCache.set(
        key,
        resolveAssets(k, { kind: "inline", brandDir: join(repoRoot, "brand"), keyVisualPath: input.keyVisualPath, elementPaths: input.elementPaths }),
      );
    return assetsCache.get(key)!;
  };
  const ctx: RenderContext = { kit, assets: await assetsFor(kit) };
  /** Contexto de una pieza, con sus ajustes del editor si los tiene. */
  const ctxFor = async (file: string, type: PieceType): Promise<RenderContext> => {
    const a = input.adjust?.({ file, type });
    if (!a) return ctx;
    const k = a.kit ?? kit;
    return { kit: k, assets: await assetsFor(k), options: a.options };
  };

  await rm(outDir, { recursive: true, force: true });
  const pieces: GeneratedPiece[] = [];
  const qaSamples = new Map<string, string>();
  const sample = (template: string, html: string) => (qaSamples.has(template) ? html : (qaSamples.set(template, html), html));

  const total =
    linkedin.length * 3 +
    slack.length * 2 +
    (agenda.length ? agenda.length + 1 : 0) +
    badgePeople.length +
    Math.ceil(badgePeople.length / 9) +
    certPeople.length +
    (want.has("landing") ? 1 : 0);
  let done = 0;
  const save = async (piece: Omit<GeneratedPiece, "file"> & { path: string }, data: Buffer | string) => {
    const file = join(outDir, piece.path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, data);
    pieces.push({ type: piece.type, template: piece.template, label: piece.label, file: relative(outDir, file) });
    await input.onProgress?.(++done, total, piece.label);
  };

  const checks: Record<string, PieceCheck> = {};
  const toVerify: { path: string; expected: ExpectedField[] }[] = [];
  /**
   * Renderiza una pieza con control geométrico: si algún texto queda recortado o fuera del lienzo,
   * la vuelve a generar con el título más chico (hasta dos veces) y registra lo que quede.
   */
  const shoot = async (template: string, path: string, type: PieceType, size: { width: number; height: number }, render: (c: RenderContext) => string) => {
    let c = await ctxFor(path, type);
    for (let attempt = 0; ; attempt++) {
      const html = render(c);
      const { png, issues } = await renderPngChecked(html, size);
      if (!issues.length || attempt === 2) {
        sample(template, html);
        if (issues.length || attempt) checks[path] = { issues, autoFixed: attempt };
        return png;
      }
      c = { ...c, options: { ...c.options, titleScale: (c.options?.titleScale ?? 1) * 0.85 } };
    }
  };

  try {
    // LinkedIn: cada post en cuadrado y apaisado + el texto
    for (const post of linkedin) {
      for (const format of ["square", "landscape"] as LinkedInFormat[]) {
        const path = `linkedin/${post.id}-${format}.png`;
        const png = await shoot(`linkedin-${format}`, path, "linkedin", linkedinPost.sizes[format], (c) => linkedinPost.render(c, post, format));
        await save({ type: "linkedin", template: `linkedin-${format}`, label: `${post.headline} (${format === "square" ? "cuadrado" : "apaisado"})`, path }, png);
        if (format === "square" && post === linkedin[0])
          toVerify.push({ path, expected: [{ field: "titular", value: post.headline }, { field: "fecha", value: kit.event.dateLabel }] });
      }
      await save({ type: "linkedin-text", template: "linkedin-text", label: `Texto: ${post.headline}`, path: `linkedin/${post.id}.txt` }, post.post);
    }

    // Slack: imagen apaisada (se lee bien en el canal) + el texto del mensaje
    for (const msg of slack) {
      const path = `slack/${msg.id}.png`;
      const png = await shoot("slack", path, "slack", linkedinPost.sizes.landscape, (c) =>
        linkedinPost.render(c, { id: `slack-${msg.id}`, headline: msg.headline, body: msg.body, post: msg.text }, "landscape"),
      );
      await save({ type: "slack", template: "slack", label: `Slack: ${msg.headline}`, path }, png);
      if (msg === slack[0]) toVerify.push({ path, expected: [{ field: "titular", value: msg.headline }] });
      await save({ type: "slack-text", template: "slack-text", label: `Mensaje: ${msg.headline}`, path: `slack/${msg.id}.txt` }, msg.text);
    }

    // Cronograma: una slide por bloque + resumen
    if (agenda.length) {
      for (const [i, item] of agenda.entries()) {
        const path = `cronograma/${String(i + 1).padStart(2, "0")}-${slugify(item.title)}.png`;
        const png = await shoot("agenda-slide", path, "agenda-slide", agendaSlide.size, (c) => agendaSlide.render(c, item, i));
        await save({ type: "agenda-slide", template: "agenda-slide", label: `${item.start} ${item.title}`, path }, png);
        // Los horarios son el dato más delicado: se verifican todas las slides
        toVerify.push({
          path,
          expected: [
            { field: "hora de inicio", value: item.start },
            ...(item.end ? [{ field: "hora de fin", value: item.end }] : []),
            { field: "título", value: item.title },
          ],
        });
      }
      const summary = await shoot("agenda-summary", "cronograma/resumen.png", "agenda-summary", agendaSummary.size, (c) => agendaSummary.render(c, agenda));
      await save({ type: "agenda-summary", template: "agenda-summary", label: "Cronograma completo", path: "cronograma/resumen.png" }, summary);
      toVerify.push({
        path: "cronograma/resumen.png",
        expected: agenda.slice(0, 4).flatMap((it, i) => [
          { field: `horario ${i + 1}`, value: it.end ? `${it.start} – ${it.end}` : it.start },
          { field: `bloque ${i + 1}`, value: it.title },
        ]),
      });
    }

    // Credenciales (PNG a 300 dpi + PDF A4 3×3) y certificados
    const badgePngs: Buffer[] = [];
    // Credencial impresa solo para quien va presencial (o si la nómina no dice cómo asiste)
    for (const person of badgePeople) {
      const path = `credenciales/${slugify(`${person.firstName}-${person.lastName}`)}.png`;
      const png = await shoot("badge", path, "badge", badge.size, (c) => badge.render(c, person));
      badgePngs.push(png);
      await save({ type: "badge", template: "badge", label: `${person.firstName} ${person.lastName}`, path }, png);
      // la credencial con el nombre más largo es la que más riesgo tiene de cortarse
      const longest = [...badgePeople].sort((a, b) => `${b.firstName} ${b.lastName}`.length - `${a.firstName} ${a.lastName}`.length)[0];
      if (person === longest)
        toVerify.push({ path, expected: [{ field: "nombre", value: person.firstName }, { field: "apellido", value: person.lastName }] });
    }
    for (let i = 0; i < badgePngs.length; i += 9) {
      const uris = badgePngs.slice(i, i + 9).map((b) => `data:image/png;base64,${b.toString("base64")}`);
      await save(
        { type: "badge-sheet", template: "badge-sheet", label: `Hoja para imprimir ${i / 9 + 1}`, path: `credenciales/imprimir-hoja-${i / 9 + 1}.pdf` },
        await renderPdf(badgeSheet(ctx, uris)),
      );
    }
    for (const person of certPeople) {
      const path = `certificados/${slugify(`${person.firstName}-${person.lastName}`)}.png`;
      const png = await shoot("certificate", path, "certificate", certificate.size, (c) => certificate.render(c, person));
      await save({ type: "certificate", template: "certificate", label: `${person.firstName} ${person.lastName}`, path }, png);
      if (person === certPeople[0]) toVerify.push({ path, expected: [{ field: "nombre completo", value: `${person.firstName} ${person.lastName}` }] });
    }

    // Landing autocontenida + capturas de control
    if (want.has("landing")) {
      const landingHtml = sample("landing", landing.render(await ctxFor("landing/index.html", "landing"), content.landing, input.agenda));
      await save({ type: "landing", template: "landing", label: "Landing", path: "landing/index.html" }, landingHtml);
      await writeFile(join(outDir, "landing/preview-desktop.png"), await renderFullPage(landingHtml, 1440));
      await writeFile(join(outDir, "landing/preview-mobile.png"), await renderFullPage(landingHtml, 390, 2));
    }
  } finally {
    await closeRenderer();
  }

  // Verificador de lectura: un modelo con visión lee la muestra y compara con los datos reales
  let verified = 0;
  if (input.verifyReading !== false && toVerify.length && llmProviders().length) {
    const queue = [...toVerify];
    const worker = async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        try {
          const result = await verifyPieceReading(await readFile(join(outDir, item.path)), item.expected);
          verified++;
          if (!result.ok) checks[item.path] = { ...(checks[item.path] ?? { issues: [], autoFixed: 0 }), reading: result.fields.filter((f) => f.status !== "ok") };
        } catch (err) {
          console.warn(`[verificador] ${item.path}: ${err instanceof Error ? err.message : err}`);
        }
      }
    };
    await input.onProgress?.(done, total, "Verificando la lectura de las piezas");
    await Promise.all(Array.from({ length: 4 }, worker));
  }

  const qaReport = await designQa(repoRoot, join(outDir, "qa"), qaSamples);
  // Reemplaza solo las carpetas de piezas: inputs/ (key visual, elementos) queda intacta.
  // Los grupos que se sacaron del evento se borran.
  await mkdir(input.outDir, { recursive: true });
  for (const group of OUTPUT_IDS) await rm(join(input.outDir, group), { recursive: true, force: true });
  for (const folder of await readdir(outDir)) {
    await rm(join(input.outDir, folder), { recursive: true, force: true });
    await rename(join(outDir, folder), join(input.outDir, folder));
  }
  await rm(outDir, { recursive: true, force: true });
  return { pieces, qaReport, seconds: (Date.now() - t0) / 1000, checks, verified };
}

// Pasa el detector de Impeccable (anti-patrones de diseño, a11y) por una pieza de cada plantilla.
async function designQa(repoRoot: string, qaDir: string, samples: Map<string, string>) {
  const detector = join(repoRoot, ".claude/skills/impeccable/scripts/impeccable");
  if (!existsSync(detector)) return "Impeccable no está instalado: QA de diseño omitido.";
  await mkdir(qaDir, { recursive: true });
  const files: string[] = [];
  for (const [template, html] of samples) {
    const file = join(qaDir, `${template}.html`);
    await writeFile(file, html);
    files.push(file);
  }
  let report: string;
  try {
    report = (await promisify(execFile)(detector, ["detect", ...files], { cwd: repoRoot, maxBuffer: 10 * 1024 * 1024 })).stdout;
  } catch (err) {
    // el detector sale con código ≠ 0 cuando encuentra problemas
    const { stdout = "", stderr = "" } = err as { stdout?: string; stderr?: string };
    report = stdout + stderr;
  }
  report = report.replaceAll(qaDir + "/", "").trim() || "Sin hallazgos.";
  await writeFile(join(qaDir, "report.txt"), report + "\n");
  return report;
}

export function slugify(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
