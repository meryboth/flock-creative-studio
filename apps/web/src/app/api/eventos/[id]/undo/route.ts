import { after } from "next/server";
import { undoLastChange } from "@/lib/editor";
import { runGeneration } from "@/lib/studio";

// Deshace el último cambio aplicado y regenera
export async function POST(_req: Request, ctx: RouteContext<"/api/eventos/[id]/undo">) {
  const { id } = await ctx.params;
  if (!(await undoLastChange(id))) return Response.json({ error: "No hay cambios para deshacer" }, { status: 400 });
  after(() => runGeneration(id, { rewriteCopy: false }));
  return Response.json({ ok: true });
}
