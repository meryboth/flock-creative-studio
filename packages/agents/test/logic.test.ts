import { describe, expect, it } from "vitest";
import { applyCritique } from "../src/critic";
import { costOf } from "../src/pricing";
import { reconcileFields } from "../src/verifier";
import type { ReferenceStyle } from "@flock/templates";

describe("verificador de lectura", () => {
  const expected = [
    { field: "hora de inicio", value: "19:00" },
    { field: "título", value: "Armado de equipos" },
  ];
  it("una hora leída a medias es un texto cortado aunque el modelo diga ok", () => {
    const r = reconcileFields(expected, [
      { field: "hora de inicio", status: "ok", read: "19:0" },
      { field: "título", status: "ok", read: "ARMADO DE EQUIPOS" },
    ]);
    expect(r.map((f) => f.status)).toEqual(["cortado", "ok"]);
  });
  it("lo que no devolvió el modelo cuenta como faltante", () => {
    expect(reconcileFields(expected, [])[0].status).toBe("falta");
  });
});

describe("crítico", () => {
  const style = {
    scheme: "dark",
    colors: { ground: "#111111", ink: "#ffffff", accent: "#ff0000", accent2: "#00ff00", shapes: [] },
    typography: { display: "Archivo", body: "Figtree", case: "upper", weight: "bold", width: "normal" },
    generator: "orbs",
    corners: "soft",
    ground: "flat",
  } as unknown as ReferenceStyle;

  it("aplica solo cambios válidos del catálogo", () => {
    const out = applyCritique(style, [
      { field: "layout", value: "bloques" },
      { field: "display", value: "Comic Sans" }, // no está en el catálogo
      { field: "ground", value: "amarillo" }, // no es HEX
      { field: "halftone", value: "true" },
    ]);
    expect(out.layout).toBe("bloques");
    expect(out.typography.display).toBe("Archivo");
    expect(out.colors.ground).toBe("#111111");
    expect(out.devices?.halftone).toBe(true);
  });

  it("un fondo claro cambia el esquema", () => {
    expect(applyCritique(style, [{ field: "ground", value: "#f5f0e6" }]).scheme).toBe("light");
  });
});

describe("costos", () => {
  it("texto por tokens, imágenes por unidad, ComfyUI gratis", () => {
    expect(costOf({ provider: "claude", model: "claude-sonnet-5-5", inputTokens: 1_000_000, outputTokens: 0 })).toBe(3);
    expect(costOf({ provider: "gemini", model: "gemini-3.1-flash-image", images: 2 })).toBeCloseTo(0.08);
    expect(costOf({ provider: "comfyui", model: "sdxl" })).toBe(0);
    expect(costOf({ provider: "x", model: "desconocido" })).toBeNull();
  });
});
