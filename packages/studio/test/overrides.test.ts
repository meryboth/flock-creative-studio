import { buildKit, contrast } from "@flock/templates";
import { describe, expect, it } from "vitest";
import { addPatch, adjustFrom, applyPatch } from "../src/overrides";
import { manualMinutes } from "../src/baseline";

const kit = buildKit({ event: { name: "Hack Night", date: "2026-11-27", language: "es" }, styleId: "grilla", seed: 1 });

describe("cambios del chat por alcance", () => {
  it("la pieza pisa al grupo y el grupo a todas", () => {
    let o = addPatch({}, { titleScale: 1.2 }, { kind: "all" });
    o = addPatch(o, { titleScale: 0.8 }, { kind: "group", group: "badge" });
    o = addPatch(o, { titleScale: 1.5 }, { kind: "piece", file: "credenciales/lucia.png" });
    const adjust = adjustFrom(kit, o)!;
    expect(adjust({ file: "linkedin/anuncio-square.png", type: "linkedin" })?.options?.titleScale).toBe(1.2);
    expect(adjust({ file: "credenciales/tomas.png", type: "badge" })?.options?.titleScale).toBe(0.8);
    expect(adjust({ file: "credenciales/lucia.png", type: "badge" })?.options?.titleScale).toBe(1.5);
  });

  it("al cambiar el fondo, el texto sigue leyéndose (AA)", () => {
    const { kit: dark } = applyPatch(kit, { colors: { ground: "#000000" } });
    expect(dark?.style.palette.scheme).toBe("dark");
    expect(contrast(dark!.style.palette.ink, "#000000")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark!.style.palette.muted, "#000000")).toBeGreaterThanOrEqual(4.5);
  });

  it("cambia la composición y los recursos gráficos", () => {
    const { kit: k } = applyPatch(kit, { layout: "tipografico", devices: { halftone: false } });
    expect(k?.style.layout).toBe("tipografico");
    expect(k?.style.devices.halftone).toBe(false);
  });
});

describe("línea base del trabajo manual", () => {
  it("suma el armado de la familia y cada pieza", () => {
    expect(manualMinutes([])).toBe(0);
    expect(manualMinutes([{ type: "linkedin" }, { type: "badge" }, { type: "badge" }])).toBe(120 + 40 + 4 + 4);
  });
});
