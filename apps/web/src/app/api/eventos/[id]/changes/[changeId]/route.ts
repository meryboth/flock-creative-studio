import { after } from "next/server";
import { applyChange, discardChange, type Scope } from "@/lib/editor";
import { runGeneration } from "@/lib/studio";

// Aplica (en el alcance elegido) o descarta una propuesta del chat
export async function POST(req: Request, ctx: RouteContext<"/api/eventos/[id]/changes/[changeId]">) {
  const { changeId } = await ctx.params;
  const { action, scope } = (await req.json()) as { action: "apply" | "discard"; scope?: Scope };
  try {
    if (action === "discard") {
      await discardChange(changeId);
      return Response.json({ ok: true });
    }
    const eventId = await applyChange(changeId, scope ?? { kind: "all" });
    // Regenerar las piezas con los cambios (sin volver a redactar los textos)
    after(() => runGeneration(eventId, { rewriteCopy: false }));
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "No se pudo aplicar el cambio" }, { status: 400 });
  }
}
