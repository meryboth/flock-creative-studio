import { existsSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db, schema } from "@flock/db";
import { BRAND_DIR } from "./paths";

export type BrandLogo = {
  id: string;
  file: string;
  type: string;
  color: string;
  useOn: string;
  status: string;
  minWidthPx?: number;
};

export type BrandElement = { id: string; file: string; desc: string; useAs: string };

export type BrandManifest = {
  name: string;
  logos: BrandLogo[];
  colors: Record<string, string | Record<string, string>>;
  elements?: BrandElement[];
  rules: { doNot: string[] };
};

export async function getActiveBrandKit() {
  const [kit] = await db.select().from(schema.brandKits).where(eq(schema.brandKits.isActive, true));
  if (!kit) return null;
  const manifest = kit.manifest as BrandManifest;
  // Algunos elementos son material interno y no vienen en el repo público
  const elements = manifest.elements?.filter((el) => existsSync(join(BRAND_DIR, el.file)));
  return { ...kit, manifest: { ...manifest, elements } };
}

export const brandUrl = (file: string) => `/api/brand/${file}`;
