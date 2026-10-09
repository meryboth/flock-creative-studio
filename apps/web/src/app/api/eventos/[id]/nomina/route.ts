import { after } from "next/server";
import { runGeneration, syncRoster } from "@/lib/studio";

const MAX_BYTES = 10 * 1024 * 1024;

// Carga la nómina del evento (link de SharePoint u Excel / CSV subido) y regenera credenciales y certificados
export async function POST(req: Request, ctx: RouteContext<"/api/eventos/[id]/nomina">) {
  const { id } = await ctx.params;
  try {
    let result;
    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      const file = (await req.formData()).get("file");
      if (!(file instanceof File)) return Response.json({ error: "Elegí un archivo" }, { status: 400 });
      if (!/\.(xlsx|csv)$/i.test(file.name)) return Response.json({ error: "Usá un Excel (.xlsx) o un CSV" }, { status: 400 });
      if (file.size > MAX_BYTES) return Response.json({ error: "El archivo pesa más de 10 MB" }, { status: 400 });
      result = await syncRoster(id, { file: Buffer.from(await file.arrayBuffer()), fileName: file.name });
    } else {
      const { url } = (await req.json()) as { url?: string };
      if (!url?.trim()) return Response.json({ error: "Pegá el link del Excel de la nómina" }, { status: 400 });
      result = await syncRoster(id, { url: url.trim() });
    }
    after(() => runGeneration(id, { rewriteCopy: false }));
    return Response.json({ ok: true, ...result });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "No se pudo leer la nómina" }, { status: 400 });
  }
}
