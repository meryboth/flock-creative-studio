import { FONT_CATALOG } from "./fonts.js";
import { FIT_TEXT_SCRIPT } from "./components.js";
import type { ResolvedAssets } from "./kit.js";

/**
 * Plantillas diseñadas por IA: el agente diseñador (packages/agents/designer.ts) escribe el HTML/CSS
 * de una pieza mirando la referencia; acá se definen las reglas fijas, se sanea, se valida y se completa
 * con los datos reales. Ver docs/informes/17.
 */

export type DesignedPieceId = "linkedin-square" | "linkedin-landscape" | "agenda-slide" | "agenda-summary";

/** Una plantilla diseñada para un tipo de pieza. */
export type DesignedTemplate = {
  piece: DesignedPieceId;
  display: string; // fuentes del catálogo
  body: string;
  css: string;
  html: string; // contenido de <body>, raíz <div class="canvas">
  rowHtml?: string; // solo en el resumen del cronograma: una fila, repetida por bloque
  notes?: string;
  model?: string;
  prompt?: { id: string; version: number };
  score?: number; // puntaje del revisor (0 a 10)
};

type Slot = { name: string; required: boolean; description: string; sample: string; stress: string };

export type PieceSpec = {
  id: DesignedPieceId;
  label: string;
  size: { width: number; height: number };
  brief: string;
  slots: Slot[];
  rowSlots?: Slot[];
  // Cuerpo mínimo (px, medido en el render con el valor más largo) de lo que tiene que dominar la pieza
  minSize: Record<string, number>;
};

const S = (name: string, description: string, sample: string, stress: string, required = true): Slot => ({ name, required, description, sample, stress });

const COMMON = [
  S("EVENT_NAME", "nombre del evento", "Hack Night 2026", "Encuentro Anual de Innovación 2026"),
  S("DATE", "fecha corta", "27.11.26", "27.11.26"),
  S("HASHTAG", "hashtag del evento", "#FLOCKHACKNIGHT2026", "#FLOCKENCUENTROANUAL2026"),
  S("LOCATION", "lugar", "Oficinas Flock", "Reserva Natural Costanera Sur", false),
];

export const PIECE_SPECS: Record<DesignedPieceId, PieceSpec> = {
  "linkedin-square": {
    id: "linkedin-square",
    label: "Posteo cuadrado",
    size: { width: 1200, height: 1200 },
    brief: "Posteo cuadrado de LinkedIn que anuncia el evento. El nombre del evento es el protagonista: es lo más grande y lo primero que se ve.",
    minSize: { ".event-name": 96 },
    slots: [...COMMON, S("HEADLINE", "titular del posteo, 2 a 6 palabras", "Se viene la Hack Night", "Llega el encuentro que estabas esperando"), S("BODY", "bajada, una frase", "Una noche para construir prototipos con IA.", "Una jornada para aprender, experimentar y evolucionar juntos con IA.", false)],
  },
  "linkedin-landscape": {
    id: "linkedin-landscape",
    label: "Posteo apaisado (LinkedIn y Slack)",
    size: { width: 1200, height: 627 },
    brief: "Posteo apaisado de LinkedIn (también se usa en Slack). Mismo sistema que el cuadrado, adaptado a un formato bajo y ancho. El nombre del evento es lo más grande.",
    minSize: { ".event-name": 60 },
    slots: [...COMMON, S("HEADLINE", "titular, 2 a 6 palabras", "Se viene la Hack Night", "Llega el encuentro que estabas esperando"), S("BODY", "bajada, una frase", "Una noche para construir prototipos con IA.", "Una jornada para aprender, experimentar y evolucionar juntos.", false)],
  },
  "agenda-slide": {
    id: "agenda-slide",
    label: "Slide del cronograma",
    size: { width: 1920, height: 1080 },
    brief: "Slide de pantalla para un bloque del cronograma: la hora de inicio y el título del bloque son lo más importante; tienen que leerse de lejos. Poné class=\"start\" en la hora de inicio y class=\"title\" en el título del bloque.",
    minSize: { ".start": 120, ".title": 72 },
    slots: [
      S("START", "hora de inicio", "19:30", "10:00"),
      S("END", "hora de fin (puede venir vacía)", "22:30", "11:30", false),
      S("TITLE", "título del bloque", "Hacking", "Cómo diseñar agentes que trabajen con personas"),
      S("SPEAKER", "quién lo da (puede venir vacío)", "Equipo de Ingeniería", "María Constanza Fernández de la Fuente", false),
      S("INDEX", "número del bloque, 2 dígitos", "02", "07", false),
      ...COMMON,
    ],
  },
  "agenda-summary": {
    id: "agenda-summary",
    label: "Cronograma completo",
    size: { width: 1080, height: 1350 },
    brief: "El cronograma completo en una pieza vertical. Las filas se repiten con la plantilla de fila (rowHtml) dentro de {{ROWS}}; tienen que entrar hasta 8 filas.",
    minSize: { ".event-name": 56 },
    slots: [S("ROWS", "lugar donde van las filas", "", ""), ...COMMON],
    rowSlots: [S("START", "hora de inicio", "19:00", "10:00"), S("END", "hora de fin", "19:30", "11:30", false), S("TITLE", "título del bloque", "Armado de equipos", "Cómo diseñar agentes que trabajen con personas")],
  },
};

export const DESIGNED_PIECES = Object.keys(PIECE_SPECS) as DesignedPieceId[];

/** Clases obligatorias: el editor conversacional y el control de calidad las usan. */
export const REQUIRED_CLASSES = ["event-name", "hashtag", "date"] as const;

// ─── Saneamiento ─────────────────────────────────────────────────────────────

/**
 * Quita lo que una plantilla no puede tener: scripts, manejadores de eventos, recursos externos
 * (solo se permiten data: y las variables de logo) e imports de CSS.
 */
export function sanitizeTemplate<T extends Pick<DesignedTemplate, "html" | "css" | "rowHtml">>(t: T): T {
  const html = (s: string) =>
    s
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<(iframe|object|embed|link|meta|base|form)\b[^>]*>/gi, "")
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/(href|src|xlink:href)\s*=\s*("|')\s*(?!data:|\{\{LOGO_(COLOR|WHITE)\}\}|#)[^"']*\2/gi, "");
  const css = (s: string) =>
    s
      .replace(/@import[^;]*;/gi, "")
      .replace(/url\(\s*(['"]?)(?!data:|#)[^)]*\1\s*\)/gi, "none")
      .replace(/expression\s*\(/gi, "");
  return { ...t, html: html(t.html), css: css(t.css), ...(t.rowHtml != null ? { rowHtml: html(t.rowHtml) } : {}) };
}

/** Problemas de una plantilla contra las reglas fijas (vacío = válida). */
export function validateTemplate(t: DesignedTemplate): string[] {
  const spec = PIECE_SPECS[t.piece];
  const problems: string[] = [];
  const all = `${t.html}\n${t.rowHtml ?? ""}`;
  if (!/class\s*=\s*["'][^"']*\bcanvas\b/.test(t.html)) problems.push('falta la raíz <div class="canvas">');
  for (const s of spec.slots) if (s.required && !all.includes(`{{${s.name}}}`)) problems.push(`falta la variable {{${s.name}}}`);
  for (const s of spec.rowSlots ?? []) if (s.required && !(t.rowHtml ?? "").includes(`{{${s.name}}}`)) problems.push(`a la fila le falta {{${s.name}}}`);
  if (spec.rowSlots && !t.rowHtml?.trim()) problems.push("falta la plantilla de fila (rowHtml)");
  if (!/\{\{LOGO_(COLOR|WHITE)\}\}/.test(t.html)) problems.push("falta el logo de Flock ({{LOGO_COLOR}} o {{LOGO_WHITE}})");
  for (const c of REQUIRED_CLASSES) if (!new RegExp(`class\\s*=\\s*["'][^"']*\\b${c}\\b`).test(all)) problems.push(`falta la clase "${c}"`);
  if (!t.css.includes("--title-scale")) problems.push("el tamaño del título no usa var(--title-scale)");
  // Microtextos inventados: solo etiquetas cortas en español, nada "técnico" ni en inglés
  for (const label of inventedTexts(all)) {
    if (/[_/\\]|\bv\d|\b(sys|os|matrix|config|transmission|embroidery|status|active|online|loading|art|edition|vol)\b/i.test(label) || label.split(/\s+/).length > 4)
      problems.push(`microtexto inventado no permitido: «${label}» (usá etiquetas cortas en español, ej. "SAVE THE DATE", "DÓNDE", "CUÁNDO")`);
  }
  for (const v of ["--ground", "--ink", "--accent"]) if (!t.css.includes(v)) problems.push(`la paleta no define ${v}`);
  if (!FONT_CATALOG[t.display]) problems.push(`la fuente "${t.display}" no está en el catálogo`);
  if (!FONT_CATALOG[t.body]) problems.push(`la fuente "${t.body}" no está en el catálogo`);
  const families = [...t.css.matchAll(/font-family\s*:\s*([^;}]+)/g)].flatMap((m) => m[1].split(",").map((f) => f.trim().replace(/^["']|["']$/g, "")));
  const unknown = [...new Set(families.filter((f) => !FONT_CATALOG[f] && !/^(var\(|inherit|sans-serif|serif|monospace|system-ui)/.test(f)))];
  if (unknown.length) problems.push(`fuentes fuera del catálogo: ${unknown.join(", ")}`);
  return problems;
}

/** Textos fijos que escribió el diseñador (todo lo que no es una variable ni código). */
export function inventedTexts(html: string) {
  return [
    ...new Set(
      html
        .replace(/<(style|svg)[\s\S]*?<\/\1>/gi, " ")
        .replace(/<[^>]+>/g, "\n")
        .replace(/\{\{\w+\}\}/g, "\n")
        .split("\n")
        .map((t) => t.replace(/&nbsp;|&[a-z]+;/g, " ").trim())
        .filter((t) => /[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}/.test(t)),
    ),
  ];
}

// ─── Render ─────────────────────────────────────────────────────────────────

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Ajustes pedidos en el chat que una plantilla diseñada puede respetar. */
export type DesignedOverrides = { colors?: Partial<Record<"ground" | "ink" | "accent" | "accent2" | "muted", string>>; titleScale?: number; hide?: string[] };

/** Valores de las variables ({{EVENT_NAME}}…) y, en el resumen del cronograma, las filas. */
export type DesignedData = { rows?: Record<string, string>[] } & { [slot: string]: string | Record<string, string>[] | undefined };

/** Completa una plantilla con los datos (escapados) y arma el documento listo para renderizar. */
export function renderDesigned(t: DesignedTemplate, data: DesignedData, assets: Pick<ResolvedAssets, "logoColor" | "logoWhite" | "fontCss">, overrides: DesignedOverrides = {}) {
  const spec = PIECE_SPECS[t.piece];
  const clean = sanitizeTemplate(t);
  const fill = (s: string, values: Record<string, string>) =>
    s
      .replace(/\{\{LOGO_COLOR\}\}/g, assets.logoColor)
      .replace(/\{\{LOGO_WHITE\}\}/g, assets.logoWhite)
      .replace(/\{\{(\w+)\}\}/g, (m, name: string) => (name in values ? escape(values[name] ?? "") : m === "{{ROWS}}" ? m : ""));
  const values = Object.fromEntries(Object.entries(data).filter((e): e is [string, string] => typeof e[1] === "string"));
  const rows = (data.rows ?? []).map((r) => fill(clean.rowHtml ?? "", r)).join("");
  const body = fill(clean.html, values).replace("{{ROWS}}", rows);
  const override = [
    overrides.colors && Object.keys(overrides.colors).length
      ? `:root { ${Object.entries(overrides.colors)
          .map(([k, v]) => `--${k}: ${v} !important;`)
          .join(" ")} }`
      : "",
    overrides.titleScale ? `:root { --title-scale: ${overrides.titleScale} !important; }` : "",
    ...(overrides.hide ?? []).map((c) => `.${c === "visual" ? "decor" : c} { display: none !important; }`),
  ].join("\n");
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<style>
${assets.fontCss}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${spec.size.width}px; height: ${spec.size.height}px; overflow: hidden; -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; background: var(--ground, #fff); }
:root { --title-scale: 1; }
${clean.css}
.canvas { position: relative; width: ${spec.size.width}px; height: ${spec.size.height}px; overflow: hidden; }
${override}
</style>
</head>
<body>${body}<script>${FIT_TEXT_SCRIPT}</script></body>
</html>`;
}

/** Datos de muestra (normales o los más largos, para probar que nada se corte). */
export function sampleData(piece: DesignedPieceId, stress = false): DesignedData {
  const spec = PIECE_SPECS[piece];
  const data: DesignedData = Object.fromEntries(spec.slots.filter((s) => s.name !== "ROWS").map((s) => [s.name, stress ? s.stress : s.sample]));
  if (spec.rowSlots) {
    const rows = stress
      ? Array.from({ length: 8 }, (_, i) => ({ START: `${9 + i}:00`, END: `${10 + i}:00`, TITLE: i % 2 ? "Cómo diseñar agentes que trabajen con personas" : "Workshops en paralelo" }))
      : [
          { START: "19:00", END: "19:30", TITLE: "Armado de equipos" },
          { START: "19:30", END: "22:30", TITLE: "Hacking" },
          { START: "22:30", END: "23:30", TITLE: "Demos y premios" },
        ];
    data.rows = rows;
  }
  return data;
}
