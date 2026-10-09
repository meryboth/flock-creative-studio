import { after } from "next/server";
import { OUTPUT_IDS, type OutputId } from "@flock/studio";
import { runGeneration, setOutputs } from "@/lib/studio";

// Cambia qué grupos de piezas genera el evento y regenera (sin volver a redactar los textos)
export async function POST(req: Request, ctx: RouteContext<"/api/eventos/[id]/piezas">) {
  const { id } = await ctx.params;
  const { outputs = [] } = (await req.json()) as { outputs?: string[] };
  try {
    await setOutputs(id, outputs.filter((o): o is OutputId => (OUTPUT_IDS as string[]).includes(o)));
    after(() => runGeneration(id, { rewriteCopy: false }));
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "No se pudo actualizar" }, { status: 400 });
  }
}
