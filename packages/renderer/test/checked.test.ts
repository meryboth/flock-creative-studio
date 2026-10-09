import { afterAll, describe, expect, it } from "vitest";
import { closeRenderer, renderPngChecked } from "../src/index";

const page = (css: string, text: string) =>
  `<!doctype html><html><body style="margin:0"><div class="canvas" style="position:relative;width:600px;height:300px;overflow:hidden;font:40px sans-serif">
  <div class="block" style="position:absolute;left:0;top:0;width:200px;height:300px;overflow:hidden"><p style="${css}">${text}</p></div></div></body></html>`;

describe("control geométrico", () => {
  afterAll(() => closeRenderer());

  it("detecta una hora que no entra en su bloque", async () => {
    const { issues } = await renderPngChecked(page("margin:0;font-size:120px;white-space:nowrap", "19:00"), { width: 600, height: 300 });
    expect(issues.map((i) => i.text)).toContain("19:00");
  });

  it("no marca texto que entra", async () => {
    const { issues } = await renderPngChecked(page("margin:0;font-size:40px", "19:00"), { width: 600, height: 300 });
    expect(issues).toEqual([]);
  });
});
