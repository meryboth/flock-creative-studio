/** @jsxRuntime automatic @jsxImportSource @flock/templates */
import type { CSSProperties } from "./jsx-runtime.js";
import type { RenderContext } from "./kit.js";

export function Logo({ ctx, style }: { ctx: RenderContext; style: CSSProperties }) {
  return <img src={ctx.assets.logo} alt="Flock" style={{ position: "absolute", height: "auto", ...style }} />;
}

// Achica la tipografía de los elementos [data-fit] hasta que entren en su caja.
// Por defecto controla el ancho (una línea); data-fit="height" controla también el alto (multilínea).
// Corre en el navegador antes de la captura; marca window.__fitDone al terminar.
export const FIT_TEXT_SCRIPT = `
(async () => {
  await document.fonts.ready;
  for (const el of document.querySelectorAll("[data-fit]")) {
    const min = Number(el.dataset.fitMin || 12);
    let size = parseFloat(getComputedStyle(el).fontSize);
    const checkHeight = el.dataset.fit === "height";
    const overflows = () =>
      el.scrollWidth > el.clientWidth + 1 ||
      // los glifos display sobresalen ~10% de su caja: no cuenta como desborde
      (checkHeight && el.scrollHeight > el.clientHeight + size * 0.15);
    while (overflows() && size > min) {
      size -= 1;
      el.style.fontSize = size + "px";
    }
  }
  window.__fitDone = true;
})();
`;

export function FitScript() {
  return <script dangerouslySetInnerHTML={{ __html: FIT_TEXT_SCRIPT }} />;
}

/** Forma con trama de puntos (semitono), para acompañar al visual o a un bloque. */
export function Halftone({ x, y, size, color, round = true }: { x: number; y: number; size: number; color: string; round?: boolean }) {
  return (
    <div
      className="halftone"
      style={{ position: "absolute", left: x, top: y, width: size, height: size, borderRadius: round ? "50%" : 0, "--ht": color, pointerEvents: "none" }}
    />
  );
}
