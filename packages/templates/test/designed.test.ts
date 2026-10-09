import { describe, expect, it } from "vitest";
import { renderDesigned, sampleData, sanitizeTemplate, validateTemplate, type DesignedTemplate } from "@flock/templates";

const valid: DesignedTemplate = {
  piece: "linkedin-square",
  display: "Pixelify Sans",
  body: "Space Grotesk",
  css: ":root{--ground:#fff;--ink:#111;--accent:#1d4ef5;--accent2:#a9c4ec;--muted:#555} .event-name{font-family:'Pixelify Sans';font-size:calc(96px * var(--title-scale))}",
  html: '<div class="canvas"><h1 class="event-name">{{EVENT_NAME}}</h1><p>{{HEADLINE}}</p><span class="date">{{DATE}}</span><span class="hashtag">{{HASHTAG}}</span><img class="logo" src="{{LOGO_WHITE}}" alt="Flock"></div>',
};
const assets = { logoColor: "data:image/svg+xml;base64,QQ==", logoWhite: "data:image/svg+xml;base64,Qg==", fontCss: "" };

describe("plantillas diseñadas por IA", () => {
  it("una plantilla que cumple las reglas es válida", () => {
    expect(validateTemplate(valid)).toEqual([]);
  });

  it("detecta reglas incumplidas", () => {
    const broken = { ...valid, html: valid.html.replace("{{DATE}}", "27/11").replace("{{LOGO_WHITE}}", "logo.png"), display: "Comic Sans" };
    const problems = validateTemplate(broken);
    expect(problems).toContain("falta la variable {{DATE}}");
    expect(problems.some((p) => p.includes("logo"))).toBe(true);
    expect(problems.some((p) => p.includes("Comic Sans"))).toBe(true);
  });

  it("rechaza microtextos inventados (técnicos o en inglés de relleno) y acepta etiquetas cortas", () => {
    const withLabels = { ...valid, html: valid.html.replace("</div>", "<small>SYS_ACTIVE</small><small>DÓNDE</small><small>SAVE THE DATE</small></div>") };
    const problems = validateTemplate(withLabels).filter((p) => p.startsWith("microtexto"));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("SYS_ACTIVE");
  });

  it("quita scripts, manejadores y recursos externos", () => {
    const dirty = sanitizeTemplate({
      css: "@import url(https://evil.test/x.css); .a{background:url(https://evil.test/x.png)}",
      html: '<div class="canvas" onclick="alert(1)"><script>alert(1)</script><img src="https://evil.test/t.png"><img src="{{LOGO_COLOR}}"></div>',
    });
    expect(dirty.html).not.toMatch(/script|onclick|evil/);
    expect(dirty.html).toContain("{{LOGO_COLOR}}");
    expect(dirty.css).not.toMatch(/evil|@import/);
  });

  it("completa las variables escapando el HTML y aplica los ajustes del chat", () => {
    const html = renderDesigned(valid, { ...sampleData("linkedin-square"), EVENT_NAME: "<b>Hack</b> & Night" }, assets, { colors: { ground: "#000000" }, titleScale: 1.2, hide: ["hashtag"] });
    expect(html).toContain("&lt;b&gt;Hack&lt;/b&gt; &amp; Night");
    expect(html).toContain(assets.logoWhite);
    expect(html).toMatch(/--ground: #000000 !important/);
    expect(html).toMatch(/--title-scale: 1.2 !important/);
    expect(html).toMatch(/\.hashtag \{ display: none !important; \}/);
    expect(html).not.toMatch(/\{\{\w+\}\}/);
  });
});
