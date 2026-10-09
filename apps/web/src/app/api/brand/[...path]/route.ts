import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import type { NextRequest } from "next/server";
import { BRAND_DIR } from "@/lib/paths";

const MIME: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".otf": "font/otf",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".pdf": "application/pdf",
};

// Sirve archivos de brand/ (logos, fuentes, elementos) sin copiarlos a public/
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/brand/[...path]">) {
  const { path } = await ctx.params;
  const file = resolve(BRAND_DIR, ...path);
  if (!file.startsWith(BRAND_DIR + sep)) return new Response("Not found", { status: 404 });

  const type = MIME[extname(file).toLowerCase()];
  if (!type) return new Response("Not found", { status: 404 });

  try {
    const body = await readFile(file);
    return new Response(body, { headers: { "Content-Type": type, "Cache-Control": "no-cache" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
