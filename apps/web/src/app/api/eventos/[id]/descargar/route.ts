import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { zip, type Zippable } from "fflate";
import { db, schema } from "@flock/db";
import { eq } from "drizzle-orm";
import { slugify } from "@flock/studio";
import { STORAGE_DIR } from "@/lib/paths";

const GROUPS = ["linkedin", "slack", "cronograma", "credenciales", "certificados", "landing"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Descarga un grupo de piezas (?grupo=credenciales) o la familia completa en un .zip
export async function GET(req: Request, ctx: RouteContext<"/api/eventos/[id]/descargar">) {
  const { id } = await ctx.params;
  const grupo = new URL(req.url).searchParams.get("grupo");
  if (!UUID.test(id) || (grupo && !GROUPS.includes(grupo))) return new Response("Pedido inválido", { status: 400 });
  const [event] = await db.select({ name: schema.events.name }).from(schema.events).where(eq(schema.events.id, id));
  if (!event) return new Response("Evento inexistente", { status: 404 });

  const files: Zippable = {};
  for (const g of grupo ? [grupo] : GROUPS) {
    const dir = join(STORAGE_DIR, id, g);
    if (!existsSync(dir)) continue;
    for (const name of (await readdir(dir)).sort()) {
      if (name.startsWith("preview-") && !grupo) continue; // capturas de control de la landing
      files[`${g}/${name}`] = [new Uint8Array(await readFile(join(dir, name))), { level: name.endsWith(".png") || name.endsWith(".pdf") ? 0 : 6 }];
    }
  }
  if (!Object.keys(files).length) return new Response("Todavía no hay piezas", { status: 404 });
  const data = await new Promise<Uint8Array>((resolve, reject) => zip(files, (err, out) => (err ? reject(err) : resolve(out))));
  const filename = `${slugify(event.name)}${grupo ? `-${grupo}` : ""}.zip`;
  return new Response(new Blob([data as BlobPart]), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${filename}"` },
  });
}
