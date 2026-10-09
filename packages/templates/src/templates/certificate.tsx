/** @jsxRuntime automatic @jsxImportSource @flock/templates */
import { FitScript, Logo } from "../components.js";
import { renderDocument } from "../document.js";
import { t } from "../i18n.js";
import type { Attendee, RenderContext } from "../kit.js";
import { Backdrop } from "../visuals.js";

// Certificado de participación (apaisado)
export const certificate = {
  id: "certificate",
  size: { width: 2000, height: 1131 },
  render(ctx: RenderContext, person: Attendee) {
    const { event } = ctx.kit;
    const tr = t(event.language);
    return renderDocument(
      <div className="canvas">
        <Backdrop ctx={ctx} canvas={this.size} area={{ x: 1420, y: -120, w: 720, h: 720 }} salt="certificate" />
        <Logo ctx={ctx} style={{ left: 122, top: 100, width: 240 }} />
        <main className="body">
          <span className="pill date">{event.dateLabel}</span>
          <h1 className="display">
            {tr.certificate}
            <span className="sub">{tr.ofParticipation}</span>
          </h1>
          <p className="given muted">{tr.awardedTo}</p>
          <p className="display name" data-fit data-fit-min="36">
            {person.firstName} {person.lastName}
          </p>
          <p className="desc muted">{tr.forAttending(event.name)}</p>
        </main>
        <p className="display hashtag">{event.hashtag}</p>
        {event.tagline && <p className="label tagline">{event.tagline}</p>}
        <FitScript />
      </div>,
      {
        ctx,
        title: `${tr.certificate} · ${person.firstName} ${person.lastName}`,
        size: this.size,
        css: `
.canvas > * { position: absolute; }
.body { left: 122px; width: 1240px; top: 300px; }
.date { font-size: 24px; padding: 8px 26px; }
h1 { margin-top: 36px; font-size: 120px; }
h1 .sub { display: block; margin-top: 10px; font-size: 40px; opacity: .9; }
.given { margin-top: 64px; font-size: 26px; }
.name { width: 1240px; margin-top: 10px; font-size: 92px; white-space: nowrap; overflow: hidden; }
.desc { margin-top: 22px; max-width: 900px; font-size: 26px; line-height: 1.5; }
.hashtag { left: 122px; bottom: 80px; font-size: 30px; }
.tagline { right: 126px; bottom: 86px; font-size: 18px; }
`,
      },
    );
  },
};
