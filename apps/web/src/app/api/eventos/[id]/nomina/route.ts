import { after } from "next/server";
import { runGeneration, syncRoster } from "@/lib/studio";

// Sincroniza credenciales y certificados con la nómina (Excel en SharePoint) y regenera las piezas
export async function POST(req: Request, ctx: RouteContext<"/api/eventos/[id]/nomina">) {
  const { id } = await ctx.params;
  const { url } = (await req.json()) as { url?: string };
  if (!url?.trim()) return Response.json({ error: "Pegá el link del Excel de la nómina" }, { status: 400 });
  try {
    const count = await syncRoster(id, url.trim());
    after(() => runGeneration(id, { rewriteCopy: false }));
    return Response.json({ ok: true, count });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "No se pudo leer la nómina" }, { status: 400 });
  }
}
