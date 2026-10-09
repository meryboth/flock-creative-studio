/** @jsxRuntime automatic @jsxImportSource @flock/templates */
import type { Html } from "./jsx-runtime.js";
import type { RenderContext } from "./kit.js";
import { fontMeta } from "./fonts.js";
import { contrast } from "./palette.js";
import { resolveStyle } from "./styles.js";

/** Negro o blanco, el que mejor se lea sobre un color (texto dentro de bloques de acento). */
const onColor = (bg: string) => (contrast(bg, "#111111") >= contrast(bg, "#ffffff") ? "#111111" : "#ffffff");

// CSS común a todas las piezas: paleta y tratamiento del estilo como variables + componentes base
export function baseCss({ kit, assets, options }: RenderContext) {
  const p = kit.style.palette;
  const base = resolveStyle(kit);
  const s = { ...base, display: { ...base.display, ...kit.style.display, ...kit.style.displayOverride } };
  const devices = kit.style.devices ?? base.devices;
  // Fuentes que dibujan mal números o "#": horarios, fechas y hashtag van con la fuente de texto
  const weakNumerals = fontMeta(kit.style.fonts.display)?.weakNumerals
    ? `.canvas .hashtag, .canvas .slot b, .canvas .time, .canvas .num { font-family: var(--font-body); font-weight: 800; letter-spacing: -0.02em; }
.canvas .slot .sep { font-family: var(--font-body); font-weight: 300; }`
    : "";
  // Excepción de diseño acotada al estilo cuyo concepto es justamente el brillo (referencia: piezas del AI Day 2026)
  const waivers =
    s.generator === "orbs" ? "/* impeccable-disable radial-halo -- generador de esferas de luz: el brillo es el concepto del estilo */\n" : "";
  return `${waivers}
${assets.fontCss}
:root {
  --ground: ${p.ground};
  --ground-deep: ${p.groundDeep};
  --ground-paint: ${s.ground(p)};
  --ink: ${p.ink};
  --muted: ${p.muted};
  --accent: ${p.accent};
  --accent2: ${p.accent2};
  --line: ${p.line};
  --font-display: "${kit.style.fonts.display}", sans-serif;
  --font-body: "${kit.style.fonts.body}", sans-serif;
  --display-weight: ${s.display.weight};
  --display-transform: ${s.display.transform};
  --display-tracking: ${s.display.tracking};
  --display-stretch: ${s.display.stretch};
  --display-leading: ${s.display.leading};
  --radius: ${s.radius}px;
  --pill-radius: ${s.pillRadius};
  --stroke: ${s.stroke}px;
  --title-scale: ${options?.titleScale ?? 1};
  --on-accent: ${onColor(p.accent)};
  --on-accent2: ${onColor(p.accent2)};
  --block-radius: ${Math.round(s.radius * 2.6)}px;
  color-scheme: ${p.scheme};
}
${(options?.hide ?? []).map((el) => `.${el === "visual" ? "visual-layer" : el} { display: none !important; }`).join("\n")}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: var(--ground-paint); background-color: var(--ground); color: var(--ink);
  font-family: var(--font-body); -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; }
::selection { background: var(--accent); color: var(--ground); }
.display { font-family: var(--font-display); font-weight: var(--display-weight); text-transform: var(--display-transform);
  letter-spacing: var(--display-tracking); font-stretch: var(--display-stretch); line-height: var(--display-leading); }
.label { font-family: var(--font-display); font-stretch: var(--display-stretch); text-transform: uppercase;
  letter-spacing: .14em; font-weight: 600; }
.pill { display: inline-flex; align-items: center; border: var(--stroke) solid var(--line);
  border-radius: var(--pill-radius); font-weight: 600; letter-spacing: .04em; font-variant-numeric: tabular-nums; }
.outline-box { border: var(--stroke) solid var(--line); border-radius: var(--radius); }
${
  devices.pills
    ? ".pill { background: var(--accent2); color: var(--on-accent2); border-color: var(--accent2); }"
    : ""
}
/* Semitono: trama de puntos para formas y bloques */
.halftone { background-image: radial-gradient(circle, var(--ht, var(--ink)) 32%, transparent 36%); background-size: 16px 16px; }
${weakNumerals}
.muted { color: var(--muted); }
${s.css ?? ""}
`;
}

type DocOptions = {
  ctx: RenderContext;
  title: string;
  css?: string;
  // Tamaño fijo en px (piezas rasterizadas). Sin tamaño = página fluida (landing).
  size?: { width: number; height: number };
};

export function renderDocument(body: Html, { ctx, title, css = "", size }: DocOptions) {
  const sizeCss = size
    ? `html, body { width: ${size.width}px; height: ${size.height}px; overflow: hidden; }
       .canvas { position: relative; width: ${size.width}px; height: ${size.height}px; overflow: hidden; }`
    : "";
  return `<!doctype html>
<html lang="${ctx.kit.event.language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${baseCss(ctx)}${sizeCss}${css}</style>
</head>
<body>${body}</body>
</html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
