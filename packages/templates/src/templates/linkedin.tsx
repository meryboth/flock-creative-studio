/** @jsxRuntime automatic @jsxImportSource @flock/templates */
import { FitScript, Halftone, Logo } from "../components.js";
import { renderDocument } from "../document.js";
import type { Html } from "../jsx-runtime.js";
import type { LinkedInPost, RenderContext } from "../kit.js";
import { layoutOf } from "../styles.js";
import { Backdrop, type Area } from "../visuals.js";

export type LinkedInFormat = "square" | "landscape";

const SIZES = {
  square: { width: 1200, height: 1200 },
  landscape: { width: 1200, height: 627 },
} as const;

// Zona del visual según composición y formato (puede sangrar fuera del lienzo)
const AREAS: Record<string, Record<LinkedInFormat, Area>> = {
  clasico: { square: { x: 560, y: -100, w: 740, h: 620 }, landscape: { x: 720, y: -60, w: 560, h: 560 } },
  tipografico: { square: { x: 660, y: 610, w: 560, h: 470 }, landscape: { x: 830, y: 300, w: 390, h: 350 } },
  bloques: { square: { x: 650, y: 40, w: 510, h: 520 }, landscape: { x: 340, y: -40, w: 320, h: 290 } },
};

export const linkedinPost = {
  id: "linkedin-post",
  sizes: SIZES,
  render(ctx: RenderContext, post: LinkedInPost, format: LinkedInFormat) {
    const size = SIZES[format];
    const layout = layoutOf(ctx.kit, ctx.options);
    const area = AREAS[layout][format];
    const backdrop = <Backdrop ctx={ctx} canvas={size} area={area} salt={`${post.id}-${format}`} />;
    const body = layout === "tipografico" ? typographic(ctx, post, format, area, backdrop) : layout === "bloques" ? blocks(ctx, post, format, area, backdrop) : classic(ctx, post, format, backdrop);
    return renderDocument(
      <div className={`canvas ${format} ${layout}`}>
        {body}
        <FitScript />
      </div>,
      { ctx, title: `${ctx.kit.event.name} · LinkedIn`, size, css: CSS },
    );
  },
};

// ─── Clásico: el esquema del AI Day ─────────────────────────────────────────

function classic(ctx: RenderContext, post: LinkedInPost, format: LinkedInFormat, backdrop: Html) {
  const { event } = ctx.kit;
  return (
    <>
      {backdrop}
      <Logo ctx={ctx} style={format === "square" ? { left: 80, top: 80, width: 230 } : { left: 60, top: 54, width: 170 }} />
      <main className="copy">
        <span className="pill date">{event.dateLabel}</span>
        <h1 className="display headline" data-fit="height" data-fit-min="36">
          {post.headline}
        </h1>
        {post.body && <p className="body muted">{post.body}</p>}
      </main>
      <p className="display hashtag">{event.hashtag}</p>
      {format === "square" && event.tagline && <p className="label tagline">{event.tagline}</p>}
    </>
  );
}

// ─── Tipográfico: el nombre del evento es la imagen ─────────────────────────

function typographic(ctx: RenderContext, post: LinkedInPost, format: LinkedInFormat, area: Area, backdrop: Html) {
  const { event } = ctx.kit;
  const pills = ctx.kit.style.devices?.pills;
  return (
    <>
      <Logo ctx={ctx} style={format === "square" ? { left: 72, top: 68, width: 190 } : { left: 56, top: 46, width: 150 }} />
      <div className="chips">
        <span className="pill date">{event.dateLabel}</span>
        {event.location && <span className="pill">{event.location}</span>}
      </div>
      <h1 className="display hero" data-fit="height" data-fit-min="72">
        {event.name}
      </h1>
      {ctx.kit.style.devices?.halftone && (
        <Halftone x={area.x + area.w * 0.18} y={area.y + area.h * 0.12} size={Math.min(area.w, area.h) * 0.78} color="var(--accent2)" />
      )}
      {/* el visual va por delante del nombre: se superpone, como un objeto apoyado sobre la tipografía */}
      {backdrop}
      <main className="copy">
        <h2 className="display headline" data-fit="height" data-fit-min="30">
          {post.headline}
        </h2>
        {post.body && <p className="body muted">{post.body}</p>}
      </main>
      <p className={`display hashtag ${pills ? "pill" : ""}`}>{event.hashtag}</p>
      {format === "square" && event.tagline && <p className="label tagline">{event.tagline}</p>}
    </>
  );
}

// ─── Bloques: planos de color con el texto adentro ──────────────────────────

function blocks(ctx: RenderContext, post: LinkedInPost, format: LinkedInFormat, area: Area, backdrop: Html) {
  const { event } = ctx.kit;
  const pills = ctx.kit.style.devices?.pills;
  return (
    <>
      {/* el texto va dentro del bloque: se lee sobre el color del bloque */}
      <div className="block">
        {ctx.kit.style.devices?.halftone && <div className="halftone block-dots" />}
        <main className="block-copy">
          <h1 className="display headline" data-fit="height" data-fit-min="34">
            {post.headline}
          </h1>
        </main>
      </div>
      {backdrop}
      {event.tagline && <p className="tab pill tagline">{event.tagline}</p>}
      <section className="ground-copy">
        {post.body && <p className="body">{post.body}</p>}
        <div className="chips">
          <span className="pill date">{event.dateLabel}</span>
          <span className="pill">{event.name}</span>
        </div>
      </section>
      <p className={`display hashtag ${pills ? "pill" : ""}`}>{event.hashtag}</p>
      <Logo ctx={ctx} style={format === "square" ? { right: 72, bottom: 66, width: 190 } : { right: 56, top: 46, width: 150 }} />
    </>
  );
}

const CSS = `
.canvas > * { position: absolute; }
/* impeccable-disable tight-leading -- titulares display (≥64px) con interlineado propio del estilo; el cuerpo usa 1.45 */
.headline { overflow: hidden; }
.body { line-height: 1.45; }
.chips { display: flex; flex-wrap: wrap; gap: 10px; }

/* Clásico */
.clasico.square .copy { left: 80px; right: 80px; bottom: 170px; }
.clasico.square .date { font-size: 24px; padding: 8px 24px; }
.clasico.square .headline { margin-top: 30px; font-size: calc(112px * var(--title-scale)); max-height: 360px; }
.clasico.square .body { margin-top: 26px; max-width: 760px; font-size: 30px; }
.clasico.square .hashtag { left: 80px; bottom: 76px; font-size: 38px; }
.clasico.square .tagline { right: 80px; bottom: 84px; font-size: 16px; max-width: 560px; text-align: right; }
.clasico.landscape .copy { left: 60px; width: 620px; bottom: 110px; }
.clasico.landscape .date { font-size: 18px; padding: 6px 18px; }
.clasico.landscape .headline { margin-top: 20px; font-size: calc(68px * var(--title-scale)); max-height: 230px; }
.clasico.landscape .body { margin-top: 16px; font-size: 22px; }
.clasico.landscape .hashtag { left: 60px; bottom: 44px; font-size: 26px; }

/* Tipográfico */
.tipografico .hero { overflow: hidden; line-height: 0.86; overflow-wrap: normal; }
.tipografico .pill { padding: 8px 20px; font-size: 20px; }
.tipografico.square .chips { right: 72px; top: 64px; justify-content: flex-end; max-width: 640px; }
.tipografico.square .hero { left: 44px; right: 44px; top: 170px; height: 420px; font-size: calc(270px * var(--title-scale)); }
.tipografico.square .copy { left: 72px; width: 560px; bottom: 150px; }
.tipografico.square .headline { font-size: 60px; max-height: 210px; line-height: 1; }
.tipografico.square .body { margin-top: 18px; font-size: 25px; }
.tipografico.square .hashtag { left: 72px; bottom: 64px; font-size: 30px; }
.tipografico.square .tagline { right: 72px; bottom: 74px; font-size: 15px; max-width: 420px; text-align: right; }
.tipografico.landscape .chips { right: 56px; top: 42px; justify-content: flex-end; max-width: 620px; }
.tipografico.landscape .pill { padding: 6px 16px; font-size: 16px; }
.tipografico.landscape .hero { left: 34px; right: 34px; top: 112px; height: 220px; font-size: calc(170px * var(--title-scale)); }
.tipografico.landscape .copy { left: 56px; width: 640px; bottom: 96px; }
.tipografico.landscape .headline { font-size: 38px; max-height: 84px; line-height: 1; }
.tipografico.landscape .body { margin-top: 10px; font-size: 18px; }
.tipografico.landscape .hashtag { left: 56px; bottom: 36px; font-size: 22px; }
.hashtag.pill { padding: 8px 22px; letter-spacing: 0; }

/* Bloques */
.bloques .block { background: var(--accent); overflow: hidden; }
.bloques .block-dots { position: absolute; --ht: var(--on-accent); opacity: .22; }
.bloques .block, .bloques .block-copy { color: var(--on-accent); }
.bloques .block-copy { position: absolute; }
.bloques .tab { background: var(--accent2); color: var(--on-accent2); border-color: var(--accent2); }
.bloques .ground-copy .body { color: var(--ink); }
.bloques.square .block { left: 0; top: 0; right: 0; height: 720px; border-radius: 0 0 var(--block-radius) var(--block-radius); }
.bloques.square .block-dots { right: -40px; top: -40px; width: 420px; height: 420px; border-radius: 50%; }
.bloques.square .block-copy { left: 72px; width: 560px; bottom: 60px; }
.bloques.square .headline { font-size: calc(104px * var(--title-scale)); max-height: 440px; }
.bloques.square .tab { right: 72px; top: 690px; padding: 14px 30px; font-size: 22px; max-width: 560px; }
.bloques.square .ground-copy { left: 72px; width: 760px; top: 790px; }
.bloques.square .body { font-size: 28px; }
.bloques.square .chips { margin-top: 26px; }
.bloques.square .pill { padding: 8px 20px; font-size: 19px; }
.bloques.square .hashtag { left: 72px; bottom: 64px; font-size: 30px; }
.bloques.landscape .block { left: 0; top: 0; bottom: 0; width: 640px; border-radius: 0 var(--block-radius) var(--block-radius) 0; }
.bloques.landscape .block-dots { left: -60px; bottom: -60px; width: 300px; height: 300px; border-radius: 50%; }
.bloques.landscape .block-copy { left: 56px; width: 520px; bottom: 56px; }
.bloques.landscape .headline { font-size: calc(66px * var(--title-scale)); max-height: 260px; }
.bloques.landscape .tab { display: none; }
.bloques.landscape .ground-copy { left: 690px; right: 56px; top: 150px; }
.bloques.landscape .body { font-size: 20px; }
.bloques.landscape .chips { margin-top: 18px; }
.bloques.landscape .pill { padding: 6px 15px; font-size: 15px; }
.bloques.landscape .hashtag { left: 690px; bottom: 44px; font-size: 22px; }
`;
