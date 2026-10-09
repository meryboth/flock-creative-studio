import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { listPrompts, promptsLockPath, promptsSnapshot, renderTemplate } from "../src/prompts";

describe("prompts versionados", () => {
  const lock: Record<string, { version: number; hash: string }> = JSON.parse(readFileSync(promptsLockPath(), "utf8"));
  const current = promptsSnapshot();

  it.each(Object.keys(current).map((id) => [id]))("%s coincide con prompts.lock.json", (id) => {
    const now = current[id];
    const locked = lock[id];
    expect(locked, `${id} no está en el lock: corré pnpm prompts:lock`).toBeDefined();
    if (now.version === locked.version) expect(now.hash, `${id} cambió sin subir la versión`).toBe(locked.hash);
    else expect.fail(`${id} subió a la versión ${now.version}: corré pnpm prompts:lock`);
  });

  it("cada prompt tiene id, versión y descripción", () => {
    for (const p of listPrompts()) {
      expect(p.version).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(10);
    }
  });

  it("una variable faltante es un error, no un hueco en el prompt", () => {
    expect(() => renderTemplate("Hola {{nombre}}", {}, "test")).toThrow(/nombre/);
    expect(renderTemplate("Hola {{nombre}}", { nombre: "Flock" })).toBe("Hola Flock");
    // las variables de plantilla (en mayúsculas) quedan para el modelo
    expect(renderTemplate("{{EVENT_NAME}} · {{x}}", { x: 1 })).toBe("{{EVENT_NAME}} · 1");
  });
});
