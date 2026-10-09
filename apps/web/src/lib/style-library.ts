import "server-only";
import { existsSync } from "node:fs";
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@flock/db";
import type { ReferenceStyle } from "@flock/templates";
import { STORAGE_DIR } from "./paths";
import { readReference, uploadDir } from "./reference";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LibraryStyle = {
  id: string;
  name: string;
  reference: ReferenceStyle;
  keyVisualPrompt: string | null;
  images: string[]; // rutas relativas a storage/
  keyVisual: string | null; // ruta relativa a storage/
  elements: string[]; // rutas relativas a storage/
  createdAt: Date;
};

const styleDir = (id: string) => {
  if (!UUID.test(id)) throw new Error("Estilo inválido");
  return join(STORAGE_DIR, "styles", id);
};

const toLibraryStyle = (row: typeof schema.styles.$inferSelect): LibraryStyle => ({ ...row, reference: row.reference as ReferenceStyle });

export async function listLibraryStyles() {
  return (await db.select().from(schema.styles).orderBy(desc(schema.styles.createdAt))).map(toLibraryStyle);
}

export async function getLibraryStyle(id: string) {
  if (!UUID.test(id)) return null;
  const [row] = await db.select().from(schema.styles).where(eq(schema.styles.id, id));
  return row ? toLibraryStyle(row) : null;
}

/** Eventos creados con un estilo de la biblioteca (guardan su propia copia del estilo). */
export async function countEventsUsing(id: string) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.events)
    .where(sql`${schema.events.style}->>'libraryStyleId' = ${id}`);
  return count;
}

/** Guarda en la biblioteca una referencia ya analizada (subida de moodboard + su lectura). */
export async function createLibraryStyle(name: string, uploadId: string) {
  const stored = await readReference(uploadId);
  if (!stored) throw new Error("No encontramos la lectura de la referencia. Volvé a subir las imágenes.");

  const [row] = await db
    .insert(schema.styles)
    .values({ name, reference: stored.style, keyVisualPrompt: stored.keyVisualPrompt })
    .returning({ id: schema.styles.id });

  // Copiar las imágenes y el key visual (si se generó) a la carpeta del estilo
  const from = uploadDir(uploadId);
  const to = styleDir(row.id);
  await mkdir(to, { recursive: true });
  const files = (await readdir(from)).filter((f) => /^\d+\.(png|jpe?g|webp)$/i.test(f) || f === "keyvisual.png");
  for (const f of files) await cp(join(from, f), join(to, f));

  // Elementos decorativos generados (si los hay)
  const fromElements = join(from, "elements");
  const elementFiles = existsSync(fromElements) ? (await readdir(fromElements)).filter((f) => f.endsWith(".png")).sort() : [];
  if (elementFiles.length) {
    await mkdir(join(to, "elements"), { recursive: true });
    for (const f of elementFiles) await cp(join(fromElements, f), join(to, "elements", f));
  }

  const rel = (f: string) => `styles/${row.id}/${f}`;
  await db
    .update(schema.styles)
    .set({
      images: files.filter((f) => f !== "keyvisual.png").map(rel),
      keyVisual: files.includes("keyvisual.png") ? rel("keyvisual.png") : null,
      elements: elementFiles.map((f) => rel(`elements/${f}`)),
    })
    .where(eq(schema.styles.id, row.id));
  return row.id;
}

export async function deleteLibraryStyle(id: string) {
  await db.delete(schema.styles).where(eq(schema.styles.id, id));
  const dir = styleDir(id);
  if (existsSync(dir)) await rm(dir, { recursive: true, force: true });
}
