import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db, schema } from "./index";

const manifestPath = new URL("../../../brand/brand.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

// Una versión nueva solo si el manifiesto cambió respecto de la activa
const [active] = await db.select().from(schema.brandKits).where(eq(schema.brandKits.isActive, true));

if (active && JSON.stringify(active.manifest) === JSON.stringify(manifest)) {
  console.log(`= brand kit sin cambios (v${active.version})`);
} else {
  const version = (active?.version ?? 0) + 1;
  await db.transaction(async (tx) => {
    if (active) await tx.update(schema.brandKits).set({ isActive: false }).where(eq(schema.brandKits.id, active.id));
    await tx.insert(schema.brandKits).values({ name: manifest.name, version, manifest });
  });
  console.log(`✓ brand kit cargado (v${version})`);
}

process.exit(0);
