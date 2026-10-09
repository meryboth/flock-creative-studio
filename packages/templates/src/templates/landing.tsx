/** @jsxRuntime automatic @jsxImportSource @flock/templates */
import { renderDocument } from "../document.js";
import { formatLongDate, t } from "../i18n.js";
import type { AgendaItem, LandingContent, RenderContext } from "../kit.js";
import { Backdrop } from "../visuals.js";

// Landing de una sola página, autocontenida (imágenes y fuentes embebidas)
export const landing = {
  id: "landing",
  render(ctx: RenderContext, content: LandingContent, agenda: AgendaItem[]) {
    const { event } = ctx.kit;
    const tr = t(event.language);
    return renderDocument(
      <>
        <header className="hero">
          <div className="hero-art" aria-hidden="true">
            <Backdrop ctx={ctx} canvas={{ width: 1440, height: 860 }} area={{ x: 760, y: -120, w: 760, h: 720 }} salt="landing" />
          </div>
          <nav>
            <img className="logo" src={ctx.assets.logo} alt="Flock" />
            <span className="display tag">{event.hashtag}</span>
          </nav>
          <div className="hero-copy">
            <span className="pill date">{event.dateLabel}</span>
            <h1 className="display">{event.name}</h1>
            {event.description && <p className="lead muted">{event.description}</p>}
            {content.cta && (
              <a className="cta" href={content.cta.href}>
                {content.cta.label}
              </a>
            )}
          </div>
        </header>

        <main>
          <section className="intro wrap">
            <p>{content.intro}</p>
            <dl className="facts">
              <div>
                <dt className="label muted">{tr.date}</dt>
                <dd>{formatLongDate(event.date, event.language)}</dd>
              </div>
              {event.location && (
                <div>
                  <dt className="label muted">{tr.where}</dt>
                  <dd>{event.location}</dd>
                </div>
              )}
            </dl>
          </section>

          {content.highlights.length > 0 && (
            <section className="highlights wrap">
              {content.highlights.map((h) => (
                <article key={h.title}>
                  <h2 className="display">{h.title}</h2>
                  <p className="muted">{h.text}</p>
                </article>
              ))}
            </section>
          )}

          {agenda.length > 0 && (
            <section id="agenda" className="agenda wrap">
              <h2 className="display">{tr.agenda}</h2>
              <ol>
                {agenda.map((it) => (
                  <li key={`${it.start}-${it.title}`}>
                    <span className="time">{it.end ? `${it.start} – ${it.end}` : it.start}</span>
                    <span className="what">
                      <strong>{it.title}</strong>
                      {(it.speaker || it.room) && <small className="muted">{[it.speaker, it.room].filter(Boolean).join(" · ")}</small>}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </main>

        <footer className="wrap">
          <img className="logo" src={ctx.assets.logo} alt="Flock" />
          <span className="display">{event.hashtag}</span>
        </footer>
      </>,
      {
        ctx,
        title: `${event.name} · Flock`,
        css: `
body { line-height: 1.6; overflow-x: hidden; }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
.wrap { width: min(1080px, 100% - 32px); margin-inline: auto; }
.hero { position: relative; min-height: min(92vh, 860px); overflow: hidden; display: flex; flex-direction: column;
  padding: 32px max(16px, (100% - 1080px) / 2) 80px; }
.hero-art { position: absolute; top: 0; right: 0; width: 1440px; height: 860px; transform-origin: top right; pointer-events: none; }
nav { position: relative; display: flex; justify-content: space-between; align-items: center; }
nav .logo { width: 140px; }
nav .tag { font-size: 14px; }
.hero-copy { position: relative; margin-top: auto; max-width: 720px; }
.date { font-size: 15px; padding: 6px 18px; }
.hero h1 { margin-top: 24px; font-size: clamp(48px, 8.5vw, 96px); text-wrap: balance; }
.lead { margin-top: 24px; font-size: clamp(17px, 2vw, 21px); max-width: 34em; }
.cta { display: inline-block; margin-top: 32px; padding: 16px 30px; border-radius: var(--pill-radius); background: var(--ink);
  color: var(--ground); font-weight: 700; font-size: 15px; text-decoration: none; transition: transform .2s cubic-bezier(.2,.8,.2,1); }
.cta:hover { transform: translateY(-2px); }
.intro { padding: 112px 0 64px; display: grid; gap: 48px; grid-template-columns: 1.7fr 1fr; }
.intro > p { font-size: clamp(20px, 2.3vw, 27px); line-height: 1.5; max-width: 36em; }
.facts { display: grid; gap: 24px; align-content: start; }
.facts dt { font-size: 12px; }
.facts dd { font-size: 19px; margin-top: 4px; }
.highlights article { display: grid; grid-template-columns: 1fr 1.4fr; gap: 32px; align-items: baseline; padding: 36px 0;
  border-top: 1px solid color-mix(in srgb, var(--line) 22%, transparent); }
.highlights h2 { font-size: clamp(28px, 4vw, 44px); }
.highlights p { font-size: 19px; max-width: 34em; }
.agenda { padding: 112px 0; }
.agenda h2 { font-size: clamp(36px, 5vw, 60px); margin-bottom: 40px; }
.agenda ol { list-style: none; }
.agenda li { display: grid; grid-template-columns: 200px 1fr; gap: 24px; padding: 22px 0;
  border-top: 1px solid color-mix(in srgb, var(--line) 22%, transparent); }
.agenda li:last-child { border-bottom: 1px solid color-mix(in srgb, var(--line) 22%, transparent); }
.time { font-weight: 700; font-variant-numeric: tabular-nums; }
.what strong { display: block; font-weight: 600; font-size: 19px; }
.what small { font-size: 15px; }
footer { display: flex; justify-content: space-between; align-items: center; padding: 40px 0 56px;
  border-top: 1px solid color-mix(in srgb, var(--line) 22%, transparent); }
footer .logo { width: 120px; }
@media (max-width: 720px) {
  .hero-art { transform: scale(.55); opacity: .9; }
  .intro { grid-template-columns: 1fr; padding-top: 72px; }
  .highlights article { grid-template-columns: 1fr; gap: 8px; }
  .agenda li { grid-template-columns: 1fr; gap: 4px; }
}
`,
      },
    );
  },
};
