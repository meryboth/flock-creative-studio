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
