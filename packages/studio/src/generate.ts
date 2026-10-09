import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { promisify } from "node:util";
import { closeRenderer, renderFullPage, renderPdf, renderPng } from "@flock/renderer";
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
  type RenderContext,
} from "@flock/templates";

export type PieceType = "linkedin" | "linkedin-text" | "agenda-slide" | "agenda-summary" | "badge" | "badge-sheet" | "certificate" | "landing";

export type GeneratedPiece = { type: PieceType; template: string; file: string; label: string };

export type GenerateInput = {
  kit: EventKit;
  content: EventContent;
  agenda: AgendaItem[];
  attendees: Attendee[];
  repoRoot: string;
  outDir: string; // carpeta absoluta de salida (se vacía antes de generar)
  keyVisualPath?: string;
  elementPaths?: string[]; // elementos decorativos generados para el estilo
  onProgress?: (done: number, total: number, label: string) => void | Promise<void>;
};

export type GenerateResult = { pieces: GeneratedPiece[]; qaReport: string; seconds: number };

/** Genera la familia completa de piezas de un evento. */
export async function generateFamily(input: GenerateInput): Promise<GenerateResult> {
  const { kit, content, agenda, attendees, outDir, repoRoot } = input;
  const t0 = Date.now();
  const ctx: RenderContext = {
    kit,
    assets: await resolveAssets(kit, {
      kind: "inline",
      brandDir: join(repoRoot, "brand"),
      keyVisualPath: input.keyVisualPath,
      elementPaths: input.elementPaths,
    }),
  };

  await rm(outDir, { recursive: true, force: true });
  const pieces: GeneratedPiece[] = [];
  const qaSamples = new Map<string, string>();
  const sample = (template: string, html: string) => (qaSamples.has(template) ? html : (qaSamples.set(template, html), html));

  const total =
    content.linkedin.length * 3 + (agenda.length ? agenda.length + 1 : 0) + attendees.length * 2 + Math.ceil(attendees.length / 9) + 1;
  let done = 0;
  const save = async (piece: Omit<GeneratedPiece, "file"> & { path: string }, data: Buffer | string) => {
    const file = join(outDir, piece.path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, data);
    pieces.push({ type: piece.type, template: piece.template, label: piece.label, file: relative(outDir, file) });
    await input.onProgress?.(++done, total, piece.label);
  };

  try {
    // LinkedIn: cada post en cuadrado y apaisado + el texto
    for (const post of content.linkedin) {
      for (const format of ["square", "landscape"] as LinkedInFormat[]) {
        const html = sample(`linkedin-${format}`, linkedinPost.render(ctx, post, format));
        await save(
          { type: "linkedin", template: `linkedin-${format}`, label: `${post.headline} (${format === "square" ? "cuadrado" : "apaisado"})`, path: `linkedin/${post.id}-${format}.png` },
          await renderPng(html, linkedinPost.sizes[format]),
        );
      }
      await save({ type: "linkedin-text", template: "linkedin-text", label: `Texto: ${post.headline}`, path: `linkedin/${post.id}.txt` }, post.post);
    }

    // Cronograma: una slide por bloque + resumen
    if (agenda.length) {
      for (const [i, item] of agenda.entries()) {
        const html = sample("agenda-slide", agendaSlide.render(ctx, item, i));
        await save(
          { type: "agenda-slide", template: "agenda-slide", label: `${item.start} ${item.title}`, path: `cronograma/${String(i + 1).padStart(2, "0")}-${slugify(item.title)}.png` },
          await renderPng(html, agendaSlide.size),
        );
      }
      await save(
        { type: "agenda-summary", template: "agenda-summary", label: "Cronograma completo", path: "cronograma/resumen.png" },
        await renderPng(sample("agenda-summary", agendaSummary.render(ctx, agenda)), agendaSummary.size),
      );
    }

    // Credenciales (PNG a 300 dpi + PDF A4 3×3) y certificados
    const badgePngs: Buffer[] = [];
    for (const person of attendees) {
      const name = slugify(`${person.firstName}-${person.lastName}`);
      const png = await renderPng(sample("badge", badge.render(ctx, person)), badge.size);
      badgePngs.push(png);
      await save({ type: "badge", template: "badge", label: `${person.firstName} ${person.lastName}`, path: `credenciales/${name}.png` }, png);
    }
    for (let i = 0; i < badgePngs.length; i += 9) {
      const uris = badgePngs.slice(i, i + 9).map((b) => `data:image/png;base64,${b.toString("base64")}`);
      await save(
        { type: "badge-sheet", template: "badge-sheet", label: `Hoja para imprimir ${i / 9 + 1}`, path: `credenciales/imprimir-hoja-${i / 9 + 1}.pdf` },
        await renderPdf(badgeSheet(ctx, uris)),
      );
    }
    for (const person of attendees) {
      await save(
        { type: "certificate", template: "certificate", label: `${person.firstName} ${person.lastName}`, path: `certificados/${slugify(`${person.firstName}-${person.lastName}`)}.png` },
        await renderPng(sample("certificate", certificate.render(ctx, person)), certificate.size),
      );
    }

    // Landing autocontenida + capturas de control
    const landingHtml = sample("landing", landing.render(ctx, content.landing, agenda));
    await save({ type: "landing", template: "landing", label: "Landing", path: "landing/index.html" }, landingHtml);
    await writeFile(join(outDir, "landing/preview-desktop.png"), await renderFullPage(landingHtml, 1440));
    await writeFile(join(outDir, "landing/preview-mobile.png"), await renderFullPage(landingHtml, 390, 2));
  } finally {
    await closeRenderer();
  }

  const qaReport = await designQa(repoRoot, join(outDir, "qa"), qaSamples);
  return { pieces, qaReport, seconds: (Date.now() - t0) / 1000 };
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
