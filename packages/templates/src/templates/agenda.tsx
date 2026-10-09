/** @jsxRuntime automatic @jsxImportSource @flock/templates */
import { FitScript, Logo } from "../components.js";
import { renderDocument } from "../document.js";
import { t } from "../i18n.js";
import type { AgendaItem, RenderContext } from "../kit.js";
import { Backdrop } from "../visuals.js";

const range = (item: AgendaItem, suffix: string) =>
  `${item.start}${item.end ? ` – ${item.end}` : ""}${suffix ? ` ${suffix}` : ""}`;

// Una slide por bloque horario
export const agendaSlide = {
  id: "agenda-slide",
  size: { width: 1920, height: 1080 },
  render(ctx: RenderContext, item: AgendaItem, index = 0) {
    const tr = t(ctx.kit.event.language);
    return renderDocument(
      <div className="canvas">
        <Backdrop ctx={ctx} canvas={this.size} area={{ x: 1060, y: -80, w: 980, h: 560 }} salt={`slide-${index}`} />
        <Logo ctx={ctx} style={{ left: 120, top: 100, width: 300 }} />
        <div className="box outline-box">
          <span className="slot display" data-fit data-fit-min="28">
            <b>{range(item, tr.hoursSuffix)}</b>
            <span className="sep"> | </span>
            <span className="title">{item.title}</span>
          </span>
        </div>
        {(item.speaker || item.room) && <p className="meta">{[item.speaker, item.room].filter(Boolean).join(" · ")}</p>}
        <p className="hashtag display">{ctx.kit.event.hashtag}</p>
        <FitScript />
      </div>,
      {
        ctx,
        title: `${ctx.kit.event.name} · ${item.title}`,
        size: this.size,
        css: `
.canvas > * { position: absolute; }
.box { left: 120px; right: 120px; top: 500px; height: 220px; display: flex; align-items: center; padding: 0 76px; }
.slot { display: block; width: 100%; white-space: nowrap; overflow: hidden; font-size: calc(56px * var(--title-scale)); }
.slot b { font-weight: var(--display-weight); }
.sep, .title { font-weight: calc(var(--display-weight) - 400); }
.meta { left: 196px; top: 744px; font-size: 30px; color: var(--muted); }
.hashtag { left: 120px; bottom: 110px; font-size: 60px; }
`,
      },
    );
  },
};

// Cronograma completo en una sola pieza (formato LinkedIn vertical)
export const agendaSummary = {
  id: "agenda-summary",
  size: { width: 1080, height: 1350 },
  render(ctx: RenderContext, items: AgendaItem[]) {
    const tr = t(ctx.kit.event.language);
    return renderDocument(
      <div className="canvas">
        <Backdrop ctx={ctx} canvas={this.size} area={{ x: 520, y: -100, w: 640, h: 460 }} salt="summary" />
        <Logo ctx={ctx} style={{ left: 72, top: 72, width: 220 }} />
        <header className="head">
          <span className="pill date">{ctx.kit.event.dateLabel}</span>
          <h1 className="display" data-fit data-fit-min="48">
            {tr.agenda}
          </h1>
          <p className="event muted">{ctx.kit.event.name}</p>
        </header>
        <ol className="rows">
          {items.map((it) => (
            <li key={`${it.start}-${it.title}`}>
              <span className="time">{it.end ? `${it.start} – ${it.end}` : it.start}</span>
              <span className="what" data-fit data-fit-min="18">
                {it.title}
              </span>
            </li>
          ))}
        </ol>
        <p className="hashtag display">{ctx.kit.event.hashtag}</p>
        <FitScript />
      </div>,
      {
        ctx,
        title: `${ctx.kit.event.name} · ${tr.agenda}`,
        size: this.size,
        css: `
.canvas > * { position: absolute; }
.head { left: 72px; right: 72px; top: 400px; }
.date { font-size: 22px; padding: 8px 22px; }
.head h1 { margin-top: 28px; font-size: calc(96px * var(--title-scale)); white-space: nowrap; overflow: hidden; }
.event { margin-top: 14px; font-size: 26px; }
.rows { left: 72px; right: 72px; top: 650px; list-style: none; }
.rows li { display: flex; align-items: baseline; gap: 28px; padding: 20px 0; border-top: 1.5px solid color-mix(in srgb, var(--line) 25%, transparent); }
.rows li:last-child { border-bottom: 1.5px solid color-mix(in srgb, var(--line) 25%, transparent); }
.time { flex: 0 0 250px; font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; }
.what { flex: 1; font-size: 28px; white-space: nowrap; overflow: hidden; }
.hashtag { left: 72px; bottom: 68px; font-size: 38px; }
`,
      },
    );
  },
};
