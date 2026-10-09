/** @jsxRuntime automatic @jsxImportSource @flock/templates */
import { FitScript, Logo } from "../components.js";
import { renderDocument } from "../document.js";
import type { LinkedInPost, RenderContext } from "../kit.js";
import { Backdrop } from "../visuals.js";

export type LinkedInFormat = "square" | "landscape";

const SIZES = {
  square: { width: 1200, height: 1200 },
  landscape: { width: 1200, height: 627 },
} as const;

const AREAS = {
  square: { x: 560, y: -100, w: 740, h: 620 },
  landscape: { x: 720, y: -60, w: 560, h: 560 },
} as const;

export const linkedinPost = {
  id: "linkedin-post",
  sizes: SIZES,
  render(ctx: RenderContext, post: LinkedInPost, format: LinkedInFormat) {
    const size = SIZES[format];
    const { event } = ctx.kit;
    return renderDocument(
      <div className={`canvas ${format}`}>
        <Backdrop ctx={ctx} canvas={size} area={AREAS[format]} salt={`${post.id}-${format}`} />
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
        <FitScript />
      </div>,
      {
        ctx,
        title: `${event.name} · LinkedIn`,
        size,
        css: `
.canvas > * { position: absolute; }
/* impeccable-disable tight-leading -- titular display (≥64px) con interlineado propio del estilo; el cuerpo usa 1.45 */
.headline { overflow: hidden; }
.body { line-height: 1.45; }
/* anclado abajo: con títulos largos el bloque crece hacia arriba, nunca sobre el hashtag */
.square .copy { left: 80px; right: 80px; bottom: 170px; }
.square .date { font-size: 24px; padding: 8px 24px; }
.square .headline { margin-top: 30px; font-size: 112px; max-height: 360px; }
.square .body { margin-top: 26px; max-width: 760px; font-size: 30px; }
.square .hashtag { left: 80px; bottom: 76px; font-size: 38px; }
.square .tagline { right: 80px; bottom: 84px; font-size: 16px; max-width: 560px; text-align: right; }
.landscape .copy { left: 60px; width: 620px; bottom: 110px; }
.landscape .date { font-size: 18px; padding: 6px 18px; }
.landscape .headline { margin-top: 20px; font-size: 68px; max-height: 230px; }
.landscape .body { margin-top: 16px; font-size: 22px; }
.landscape .hashtag { left: 60px; bottom: 44px; font-size: 26px; }
`,
      },
    );
  },
};
