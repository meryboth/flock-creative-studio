/** @jsxRuntime automatic @jsxImportSource @flock/templates */
import { FitScript, Logo } from "../components.js";
import { renderDocument } from "../document.js";
import type { Attendee, RenderContext } from "../kit.js";
import { Backdrop } from "../visuals.js";

// Credencial vertical CR80 (54 × 85,6 mm) a 300 dpi
export const BADGE_MM = { width: 54, height: 85.6 };

export const badge = {
  id: "badge",
  size: { width: 638, height: 1011 },
  render(ctx: RenderContext, person: Attendee) {
    const { event } = ctx.kit;
    return renderDocument(
      <div className="canvas">
        <Backdrop ctx={ctx} canvas={this.size} area={{ x: 260, y: -60, w: 460, h: 400 }} salt="badge" />
        <Logo ctx={ctx} style={{ left: 52, top: 96, width: 170 }} />
        <main className="who">
          <p className="display first" data-fit data-fit-min="34">
            {person.firstName}
          </p>
          <p className="display last" data-fit data-fit-min="24">
            {person.lastName}
          </p>
          {person.role && <p className="role muted">{person.role}</p>}
          {person.area && <span className="pill area">{person.area}</span>}
        </main>
        <footer>
          <p className="display event">{event.name}</p>
          <p className="meta muted">
            {event.dateLabel} · {event.hashtag}
          </p>
        </footer>
        <FitScript />
      </div>,
      {
        ctx,
        title: `${person.firstName} ${person.lastName}`,
        size: this.size,
        css: `
.canvas > * { position: absolute; }
.who { left: 52px; right: 52px; top: 420px; }
.first, .last { white-space: nowrap; overflow: hidden; }
.first { font-size: 74px; }
.last { font-size: 46px; margin-top: 8px; opacity: .92; }
.role { margin-top: 28px; font-size: 26px; }
.area { margin-top: 18px; font-size: 18px; padding: 8px 20px; }
footer { left: 52px; right: 52px; bottom: 52px; padding-top: 22px; border-top: 2px solid color-mix(in srgb, var(--line) 30%, transparent); }
.event { font-size: 30px; }
.meta { margin-top: 8px; font-size: 18px; font-weight: 600; letter-spacing: .08em; }
`,
      },
    );
  },
};

// Hoja A4 con 9 credenciales (3×3) y marcas de corte, para imprimir en PDF
export function badgeSheet(ctx: RenderContext, badgePngs: string[]) {
  const { width: w, height: h } = BADGE_MM;
  const cols = 3;
  const rows = 3;
  const gap = 4; // mm entre credenciales para marcas de corte
  const left = (210 - (cols * w + (cols - 1) * gap)) / 2;
  const top = (297 - (rows * h + (rows - 1) * gap)) / 2;

  const marks: { x: number; y: number }[] = [];
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) {
      const x = left + c * (w + gap);
      const y = top + r * (h + gap);
      marks.push({ x, y }, { x: x + w, y }, { x, y: y + h }, { x: x + w, y: y + h });
    }

  return renderDocument(
    <div className="sheet">
      {/* Las marcas van debajo: la imagen tapa la parte que cae dentro de la credencial */}
      {marks.map((m, i) => (
        <span key={i} className="mark" style={{ left: `${m.x}mm`, top: `${m.y}mm` }} />
      ))}
      {badgePngs.map((src, i) => (
        <img
          key={i}
          src={src}
          alt=""
          style={{ left: `${left + (i % cols) * (w + gap)}mm`, top: `${top + Math.floor(i / cols) * (h + gap)}mm`, width: `${w}mm`, height: `${h}mm` }}
        />
      ))}
    </div>,
    {
      ctx,
      title: "Credenciales",
      css: `
@page { size: A4; margin: 0; }
html, body { background: #fff; width: 210mm; height: 297mm; }
.sheet { position: relative; width: 210mm; height: 297mm; }
.sheet img { position: absolute; }
.mark { position: absolute; width: 0; height: 0; }
.mark::before, .mark::after { content: ""; position: absolute; background: #000; }
.mark::before { left: -1.5mm; top: -0.05mm; width: 3mm; height: 0.1mm; }
.mark::after { top: -1.5mm; left: -0.05mm; height: 3mm; width: 0.1mm; }
`,
    },
  );
}
