import "server-only";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { DesignedPieceId, DesignedTemplate, ReferenceStyle } from "@flock/templates";
import { UPLOADS_DIR } from "./paths";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type StoredReference = { style: ReferenceStyle; keyVisualPrompt: string; medium?: string; elements?: string[]; model: string };

/** Carpeta de una subida de moodboard (valida el id para no salir de uploads/). */
export function uploadDir(uploadId: string) {
  if (!UUID.test(uploadId)) throw new Error("Subida inválida");
  return join(UPLOADS_DIR, uploadId);
}

export async function readReference(uploadId: string): Promise<StoredReference | null> {
  const file = join(uploadDir(uploadId), "reference.json");
  return existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : null;
}

/** Imágenes subidas por la persona (excluye lo que genera el sistema). */
export async function referenceImages(uploadId: string) {
  const dir = uploadDir(uploadId);
  return (await readdir(dir)).filter((f) => /^\d+\.(png|jpe?g|webp)$/i.test(f)).map((f) => join(dir, f));
}

export const keyVisualPath = (uploadId: string) => join(uploadDir(uploadId), "keyvisual.png");
export const keyVisualUrl = (uploadId: string) => `/api/storage/uploads/${uploadId}/keyvisual.png`;

export const elementsDir = (uploadId: string) => join(uploadDir(uploadId), "elements");

/** Elementos decorativos generados para una subida (rutas relativas a storage/). */
export async function uploadElements(uploadId: string) {
  const dir = elementsDir(uploadId);
  if (!existsSync(dir)) return [];
  return (await readdir(dir)).filter((f) => f.endsWith(".png")).sort().map((f) => `uploads/${uploadId}/elements/${f}`);
}

// ─── Plantillas diseñadas por IA para una subida ───────────────────────────

export type DesignedSet = Partial<Record<DesignedPieceId, DesignedTemplate>>;

export const templatesDir = (uploadId: string) => join(uploadDir(uploadId), "templates");

export async function readTemplates(uploadId: string): Promise<DesignedSet | null> {
  const file = join(templatesDir(uploadId), "templates.json");
  return existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : null;
}

/** Miniaturas de las plantillas diseñadas (rutas relativas a storage/). */
export async function templatePreviews(uploadId: string) {
  const dir = templatesDir(uploadId);
  if (!existsSync(dir)) return [];
  return (await readdir(dir)).filter((f) => f.endsWith(".png")).sort().map((f) => `uploads/${uploadId}/templates/${f}`);
}
