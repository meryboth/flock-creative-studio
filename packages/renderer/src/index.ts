import { chromium, type Browser } from "playwright";

let browser: Promise<Browser> | null = null;

// Un solo Chromium headless reutilizado para todas las piezas
function getBrowser() {
  browser ??= chromium.launch();
  return browser;
}

export async function closeRenderer() {
  if (browser) await (await browser).close();
  browser = null;
}

type Size = { width: number; height: number };

async function withPage<T>(html: string, viewport: Size, scale: number, fn: (page: import("playwright").Page) => Promise<T>) {
  const context = await (await getBrowser()).newContext({ viewport, deviceScaleFactor: scale });
  const page = await context.newPage();
  try {
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    // Las plantillas con texto ajustable avisan cuando terminaron
    await page.waitForFunction(() => !document.querySelector("[data-fit]") || (window as unknown as { __fitDone?: boolean }).__fitDone);
    return await fn(page);
  } finally {
    await context.close();
  }
}

/** HTML de tamaño fijo → PNG. `scale` multiplica la resolución (2 = retina). */
export function renderPng(html: string, size: Size, scale = 1) {
  return withPage(html, size, scale, (page) => page.screenshot({ type: "png", clip: { x: 0, y: 0, ...size } }));
}

/** Problema de lectura detectado en el render (texto recortado o fuera del lienzo). */
export type RenderIssue = { kind: "recortado" | "fuera-del-lienzo"; text: string; px: number };

/**
 * Busca textos que no se leen completos: elementos con texto propio cuyo contenido desborda su caja
 * (y la caja lo recorta) o que se salen del lienzo. Corre en el navegador después del ajuste de texto.
 */
const FIND_ISSUES = `(() => {
  const canvas = document.querySelector(".canvas") ?? document.body;
  const box = canvas.getBoundingClientRect();
  const issues = [];
  const outOfCanvas = (t) => t.left < box.left - 1 || t.right > box.right + 1 || t.top < box.top - 1 || t.bottom > box.bottom + 1;
  const ownText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  for (const el of canvas.querySelectorAll("*")) {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || el.closest(".visual-layer")) continue;
    if (!ownText(el) && !el.matches("[data-fit]")) continue;
    const text = el.textContent.trim().replace(/\\s+/g, " ").slice(0, 80);
    if (!text) continue;
    const fontSize = parseFloat(style.fontSize);
    // los glifos display sobresalen un poco de su caja: no cuenta (mismo criterio que el ajuste de texto),
    // y con interlineado menor a 1 sobresalen además lo que se "comió" el interlineado
    const lineHeight = parseFloat(style.lineHeight) || fontSize;
    const slack = fontSize * 0.15 + Math.max(0, fontSize - lineHeight);
    // 1. el texto desborda su propia caja y la caja lo recorta
    const clips = style.overflow !== "visible" || style.textOverflow === "ellipsis";
    const overW = el.scrollWidth - el.clientWidth;
    const overH = el.scrollHeight - el.clientHeight - slack;
    // umbral relativo al cuerpo: unos píxeles de rasgos que sobresalen arriba o abajo no impiden leer,
    // pero de costado cualquier recorte se come letras
    const minW = Math.max(3, fontSize * 0.03);
    const minH = Math.max(3, fontSize * 0.08);
    if (clips && (overW > minW || overH > minH)) {
      issues.push({ kind: "recortado", text, px: Math.round(Math.max(overW, overH)) });
      continue;
    }
    // 2. el texto se sale de un contenedor que lo recorta (ej. una hora que no entra en su bloque de color);
    //    el lienzo también recorta, así que esto cubre el texto que se sale de la pieza
    const range = document.createRange();
    range.selectNodeContents(el);
    const t = range.getBoundingClientRect();
    let clipped = 0;
    let px = 0;
    for (let a = el.parentElement; a && a !== canvas.parentElement; a = a.parentElement) {
      if (getComputedStyle(a).overflow === "visible") continue;
      const r = a.getBoundingClientRect();
      const sides = [r.left - t.left, t.right - r.right, r.top - t.top - slack, t.bottom - r.bottom - slack];
      clipped = Math.max(clipped, sides[0] / minW, sides[1] / minW, sides[2] / minH, sides[3] / minH);
      px = Math.max(px, ...sides);
    }
    // clipped está en unidades de umbral: > 1 es un recorte que se nota
    if (clipped > 1) {
      issues.push({ kind: outOfCanvas(t) ? "fuera-del-lienzo" : "recortado", text, px: Math.round(px) });
    }
  }
  return issues;
})()`;

/** Como renderPng, pero además devuelve los textos recortados o fuera del lienzo y el cuerpo de los textos medidos. */
export function renderPngChecked(html: string, size: Size, scale = 1, measure: string[] = []) {
  return withPage(html, size, scale, async (page) => {
    const issues = (await page.evaluate(FIND_ISSUES)) as RenderIssue[];
    // Cuerpo real (después del ajuste de texto) de los elementos pedidos, ej. ".event-name"
    const metrics = (await page.evaluate(
      `(${JSON.stringify(measure)}).map((sel) => { const el = document.querySelector(sel); return [sel, el ? parseFloat(getComputedStyle(el).fontSize) : null]; })`,
    )) as [string, number | null][];
    const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, ...size } });
    return { png, issues, metrics: Object.fromEntries(metrics) as Record<string, number | null> };
  });
}

/** HTML con `@page` definido → PDF vectorial (el texto queda seleccionable). */
export function renderPdf(html: string) {
  return withPage(html, { width: 1240, height: 1754 }, 1, (page) =>
    page.pdf({ preferCSSPageSize: true, printBackground: true }),
  );
}

/** Captura de página completa (para previsualizar la landing). */
export function renderFullPage(html: string, width: number, scale = 1) {
  return withPage(html, { width, height: 900 }, scale, (page) => page.screenshot({ type: "png", fullPage: true }));
}
