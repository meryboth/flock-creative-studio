import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildKit, contrast, DISPLAY_FONTS, ensureContrast, FONT_CATALOG, fontFilePath, STYLE_LIST, styleFromReference, type ReferenceStyle } from "@flock/templates"; // el paquete compilado (el mismo que usa la app)

const event = { name: "Design Sprint 2027", date: "2027-04-15", language: "es" as const };

describe("variantes", () => {
  it.each(STYLE_LIST.map((s) => [s.id]))("%s: las 3 variantes cambian composición y fuente", (id) => {
    const kits = [1, 2, 3].map((seed) => buildKit({ event, styleId: id, seed }));
    expect(new Set(kits.map((k) => k.style.layout)).size).toBe(3);
    expect(new Set(kits.map((k) => k.style.fonts.display)).size).toBe(3);
  });

  it("el estilo del AI Day es el único que arranca con la composición clásica", () => {
    const first = STYLE_LIST.map((s) => [s.id, buildKit({ event, styleId: s.id, seed: 1 }).style.layout]);
    expect(first.filter(([, l]) => l === "clasico").map(([id]) => id)).toEqual(["iridiscente"]);
  });

  it("una referencia arranca con su composición y deja la clásica para el final", () => {
    const ref = { layout: "bloques" } as ReferenceStyle;
    expect(styleFromReference({ ...minimalRef, ...ref }).layouts).toEqual(["bloques", "tipografico", "clasico"]);
  });
});

describe("fuentes", () => {
  it("todas tienen archivo con ñ y tildes (latin-ext)", () => {
    for (const family of Object.keys(FONT_CATALOG)) expect(existsSync(fontFilePath(family, "latin-ext")), family).toBe(true);
  });

  it("hay variedad de categorías para títulos", () => {
    const categories = new Set(DISPLAY_FONTS.map((f) => FONT_CATALOG[f].meta.category));
    expect(categories.size).toBeGreaterThanOrEqual(8);
  });
});

describe("paleta", () => {
  it("ensureContrast llega al contraste pedido", () => {
    expect(contrast(ensureContrast("#777777", "#808080", 4.5), "#808080")).toBeGreaterThanOrEqual(4.5);
  });
});

const minimalRef: ReferenceStyle = {
  description: "",
  mood: [],
  scheme: "light",
  colors: { ground: "#ffffff", ink: "#111111", accent: "#ff0000", accent2: "#0000ff", shapes: ["#ff0000"] },
  typography: { display: "Archivo", body: "Figtree", case: "upper", weight: "bold", width: "normal" },
  generator: "grid",
  corners: "sharp",
  ground: "flat",
};
