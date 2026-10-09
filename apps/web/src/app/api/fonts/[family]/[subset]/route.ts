import { readFile } from "node:fs/promises";
import type { NextRequest } from "next/server";
import { FONT_CATALOG, fontFilePath } from "@flock/templates";

// Sirve las fuentes del catálogo para las vistas previas
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/fonts/[family]/[subset]">) {
  const { family, subset } = await ctx.params;
  const name = decodeURIComponent(family);
  if (!FONT_CATALOG[name] || !["latin", "latin-ext"].includes(subset)) return new Response("Not found", { status: 404 });
  try {
    return new Response(await readFile(fontFilePath(name, subset)), {
      headers: { "Content-Type": "font/woff2", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
