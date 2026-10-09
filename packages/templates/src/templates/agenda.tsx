/** @jsxRuntime automatic @jsxImportSource @flock/templates */
import { FitScript, Halftone, Logo } from "../components.js";
import { renderDocument } from "../document.js";
import { t } from "../i18n.js";
import type { Html } from "../jsx-runtime.js";
import type { AgendaItem, RenderContext } from "../kit.js";
import { layoutOf } from "../styles.js";
import { Backdrop, type Area } from "../visuals.js";

const range = (item: AgendaItem, suffix: string) => `${item.start}${item.end ? ` – ${item.end}` : ""}${suffix ? ` ${suffix}` : ""}`;
const meta = (item: AgendaItem) => [item.speaker, item.room].filter(Boolean).join(" · ");

// ─── Una slide por bloque horario ───────────────────────────────────────────

const SLIDE = { width: 1920, height: 1080 };
const SLIDE_AREAS: Record<string, Area> = {
  clasico: { x: 1060, y: -80, w: 980, h: 560 },
  tipografico: { x: 1240, y: 90, w: 640, h: 560 },
  bloques: { x: -40, y: 560, w: 760, h: 600 },
};

export const agendaSlide = {
  id: "agenda-slide",
  size: SLIDE,
  render(ctx: RenderContext, item: AgendaItem, index = 0) {
    const layout = layoutOf(ctx.kit, ctx.options);
    const area = SLIDE_AREAS[layout];
    const backdrop = <Backdrop ctx={ctx} canvas={SLIDE} area={area} salt={`slide-${index}`} />;
    const body =
      layout === "tipografico" ? slideTypographic(ctx, item, index, area, backdrop) : layout === "bloques" ? slideBlocks(ctx, item, index, backdrop) : slideClassic(ctx, item, backdrop);
    return renderDocument(
      <div className={`canvas ${layout}`}>
        {body}
        <FitScript />
      </div>,
      { ctx, title: `${ctx.kit.event.name} · ${item.title}`, size: SLIDE, css: SLIDE_CSS },
    );
  },
};

// Clásico: la caja "hora | título" del AI Day
function slideClassic(ctx: RenderContext, item: AgendaItem, backdrop: Html) {
  const tr = t(ctx.kit.event.language);
  return (
    <>
      {backdrop}
      <Logo ctx={ctx} style={{ left: 120, top: 100, width: 300 }} />
      <div className="box outline-box">
        <span className="slot display" data-fit data-fit-min="28">
          <b>{range(item, tr.hoursSuffix)}</b>
          <span className="sep"> | </span>
          <span className="title">{item.title}</span>
        </span>
      </div>
      {meta(item) && <p className="meta">{meta(item)}</p>}
      <p className="hashtag display">{ctx.kit.event.hashtag}</p>
    </>
  );
}

// Tipográfico: la hora de inicio es la imagen
function slideTypographic(ctx: RenderContext, item: AgendaItem, index: number, area: Area, backdrop: Html) {
  const { event } = ctx.kit;
  const pills = ctx.kit.style.devices?.pills;
  return (
    <>
      <Logo ctx={ctx} style={{ left: 120, top: 92, width: 250 }} />
      <div className="chips">
        <span className="pill date">{event.dateLabel}</span>
        {item.room && <span className="pill">{item.room}</span>}
      </div>
      <p className="label index">{String(index + 1).padStart(2, "0")}</p>
      <p className="display num big-time">{item.start}</p>
      {item.end && <p className="until num">→ {item.end}</p>}
      {ctx.kit.style.devices?.halftone && <Halftone x={area.x + 60} y={area.y + 40} size={Math.min(area.w, area.h) * 0.8} color="var(--accent2)" />}
      {backdrop}
      <h1 className="display title-big" data-fit="height" data-fit-min="48">
        {item.title}
      </h1>
      {item.speaker && <p className="meta">{item.speaker}</p>}
      <p className={`display hashtag ${pills ? "pill" : ""}`}>{event.hashtag}</p>
    </>
  );
}

// Bloques: la hora vive en un plano de color, el título en el fondo
function slideBlocks(ctx: RenderContext, item: AgendaItem, index: number, backdrop: Html) {
  const { event } = ctx.kit;
  const pills = ctx.kit.style.devices?.pills;
  return (
    <>
      <div className="block">
        {ctx.kit.style.devices?.halftone && <div className="halftone block-dots" />}
        <div className="block-copy">
          <p className="label index">{String(index + 1).padStart(2, "0")}</p>
          <p className="display num big-time">{item.start}</p>
          {item.end && <p className="until num">{t(event.language).until} {item.end}</p>}
        </div>
      </div>
      {backdrop}
      <div className="chips">
        <span className="pill date">{event.dateLabel}</span>
        {item.room && <span className="pill">{item.room}</span>}
      </div>
      <h1 className="display title-big" data-fit="height" data-fit-min="48">
        {item.title}
      </h1>
      {item.speaker && <p className="meta">{item.speaker}</p>}
      <p className={`display hashtag ${pills ? "pill" : ""}`}>{event.hashtag}</p>
      <Logo ctx={ctx} style={{ right: 120, bottom: 96, width: 250 }} />
    </>
  );
}

const SLIDE_CSS = `
.canvas > * { position: absolute; }
.chips { display: flex; flex-wrap: wrap; gap: 14px; }
.pill { padding: 10px 26px; font-size: 26px; }
.hashtag.pill { padding: 10px 28px; letter-spacing: 0; }
/* impeccable-disable tight-leading -- números y títulos display (≥96px) con interlineado propio del estilo */
.big-time { line-height: 0.82; white-space: nowrap; font-variant-numeric: tabular-nums; }

/* Clásico */
.clasico .box { left: 120px; right: 120px; top: 500px; height: 220px; display: flex; align-items: center; padding: 0 76px; }
.clasico .slot { display: block; width: 100%; white-space: nowrap; overflow: hidden; font-size: calc(56px * var(--title-scale)); }
.clasico .slot b { font-weight: var(--display-weight); }
.clasico .sep, .clasico .title { font-weight: calc(var(--display-weight) - 400); }
.clasico .meta { left: 196px; top: 744px; font-size: 30px; color: var(--muted); }
.clasico .hashtag { left: 120px; bottom: 110px; font-size: 60px; }

/* Tipográfico */
.tipografico .chips { right: 120px; top: 92px; justify-content: flex-end; }
.tipografico .index { left: 124px; top: 250px; font-size: 26px; color: var(--muted); }
.tipografico .big-time { left: 104px; top: 290px; font-size: calc(340px * var(--title-scale)); }
.tipografico .until { left: 124px; top: 600px; font-size: 44px; color: var(--muted); font-weight: 600; }
.tipografico .title-big { left: 120px; right: 120px; top: 690px; height: 230px; font-size: calc(104px * var(--title-scale)); overflow: hidden; }
.tipografico .meta { left: 124px; bottom: 110px; font-size: 30px; color: var(--muted); }
.tipografico .hashtag { right: 120px; bottom: 100px; font-size: 34px; }

/* Bloques */
.bloques .block { left: 0; top: 0; bottom: 0; width: 760px; background: var(--accent); overflow: hidden; border-radius: 0 var(--block-radius) var(--block-radius) 0; }
.bloques .block-dots { position: absolute; right: -80px; top: -80px; width: 460px; height: 460px; border-radius: 50%; --ht: var(--on-accent); opacity: .22; }
.bloques .block { color: var(--on-accent); }
.bloques .block-copy { position: absolute; left: 104px; top: 150px; }
.bloques .block-copy .index { font-size: 26px; opacity: .8; }
.bloques .big-time { margin-top: 24px; font-size: calc(250px * var(--title-scale)); }
.bloques .until { margin-top: 20px; font-size: 42px; font-weight: 600; opacity: .85; }
.bloques .chips { left: 860px; top: 120px; }
.bloques .title-big { left: 860px; right: 120px; top: 330px; height: 400px; font-size: calc(96px * var(--title-scale)); overflow: hidden; }
.bloques .meta { left: 864px; top: 760px; font-size: 32px; color: var(--muted); }
.bloques .hashtag { left: 860px; bottom: 104px; font-size: 32px; }
`;

// ─── Cronograma completo en una sola pieza (formato LinkedIn vertical) ──────

const SUMMARY = { width: 1080, height: 1350 };
const SUMMARY_AREAS: Record<string, Area> = {
  clasico: { x: 520, y: -100, w: 640, h: 460 },
  tipografico: { x: 640, y: 40, w: 420, h: 360 },
  bloques: { x: 560, y: -20, w: 520, h: 440 },
};

export const agendaSummary = {
  id: "agenda-summary",
  size: SUMMARY,
  render(ctx: RenderContext, items: AgendaItem[]) {
    const tr = t(ctx.kit.event.language);
    const layout = layoutOf(ctx.kit, ctx.options);
    const pills = ctx.kit.style.devices?.pills;
    const rows = (
      <ol className="rows">
        {items.map((it) => (
          <li key={`${it.start}-${it.title}`}>
            <span className={`time num ${layout !== "clasico" && pills ? "pill" : ""}`}>{it.end ? `${it.start} – ${it.end}` : it.start}</span>
            <span className="what" data-fit data-fit-min="18">
              {it.title}
            </span>
          </li>
        ))}
      </ol>
    );
    const backdrop = <Backdrop ctx={ctx} canvas={SUMMARY} area={SUMMARY_AREAS[layout]} salt="summary" />;
    const header = (
      <header className="head">
        <span className="pill date">{ctx.kit.event.dateLabel}</span>
        <h1 className="display" data-fit={layout === "tipografico" ? "height" : true} data-fit-min="48">
          {tr.agenda}
        </h1>
        <p className="event">{ctx.kit.event.name}</p>
      </header>
    );
    return renderDocument(
      <div className={`canvas ${layout}`}>
        {layout === "bloques" && (
          <div className="block">
            {ctx.kit.style.devices?.halftone && <div className="halftone block-dots" />}
            {header}
          </div>
        )}
        {backdrop}
        {layout === "bloques" ? (
          <Logo ctx={ctx} style={{ right: 72, bottom: 64, width: 200 }} />
        ) : (
          <Logo ctx={ctx} style={{ left: 72, top: 72, width: layout === "tipografico" ? 190 : 220 }} />
        )}
        {layout !== "bloques" && header}
        {rows}
        <p className={`hashtag display ${layout !== "clasico" && pills ? "pill" : ""}`}>{ctx.kit.event.hashtag}</p>
        <FitScript />
      </div>,
      { ctx, title: `${ctx.kit.event.name} · ${tr.agenda}`, size: SUMMARY, css: SUMMARY_CSS },
    );
  },
};

const SUMMARY_CSS = `
.canvas > * { position: absolute; }
.date { font-size: 22px; padding: 8px 22px; }
.event { margin-top: 14px; font-size: 26px; color: var(--muted); }
.rows { left: 72px; right: 72px; list-style: none; }
.rows li { display: flex; align-items: baseline; gap: 28px; padding: 20px 0; border-top: 1.5px solid color-mix(in srgb, var(--line) 25%, transparent); }
.rows li:last-child { border-bottom: 1.5px solid color-mix(in srgb, var(--line) 25%, transparent); }
.time { flex: 0 0 250px; font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; }
.time.pill { flex: 0 0 auto; min-width: 230px; justify-content: center; padding: 6px 16px; font-size: 22px; }
.what { flex: 1; font-size: 28px; white-space: nowrap; overflow: hidden; }
.hashtag { left: 72px; bottom: 68px; font-size: 38px; }
.hashtag.pill { padding: 8px 22px; font-size: 28px; letter-spacing: 0; }

/* Clásico */
.clasico .head { left: 72px; right: 72px; top: 400px; }
.clasico .head h1 { margin-top: 28px; font-size: calc(96px * var(--title-scale)); white-space: nowrap; overflow: hidden; }
.clasico .rows { top: 650px; }

/* Tipográfico: la palabra "cronograma" de borde a borde */
.tipografico .head { left: 40px; right: 40px; top: 200px; }
.tipografico .head .date { margin-left: 32px; }
/* impeccable-disable tight-leading -- palabra display gigante */
.tipografico .head h1 { margin-top: 18px; height: 300px; font-size: calc(220px * var(--title-scale)); line-height: 0.86; overflow: hidden; }
.tipografico .event { margin-left: 32px; }
.tipografico .rows { top: 660px; }
.tipografico .time { font-family: var(--font-display); font-weight: var(--display-weight); }

/* Bloques: encabezado en un plano de color */
.bloques .block { left: 0; top: 0; right: 0; height: 560px; background: var(--accent); overflow: hidden; border-radius: 0 0 var(--block-radius) var(--block-radius); }
.bloques .block-dots { position: absolute; right: -60px; top: -60px; width: 380px; height: 380px; border-radius: 50%; --ht: var(--on-accent); opacity: .22; }
.bloques .block { color: var(--on-accent); }
.bloques .head { position: absolute; left: 72px; right: 72px; top: 150px; }
.bloques .head h1 { margin-top: 26px; font-size: calc(120px * var(--title-scale)); white-space: nowrap; overflow: hidden; }
.bloques .event { color: var(--on-accent); opacity: .85; }
.bloques .rows { top: 640px; }
`;
