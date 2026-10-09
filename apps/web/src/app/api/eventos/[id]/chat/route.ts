import { proposeChange } from "@/lib/editor";

// Interpreta un pedido del chat y devuelve la propuesta (todavía no aplica nada)
export async function POST(req: Request, ctx: RouteContext<"/api/eventos/[id]/chat">) {
  const { id } = await ctx.params;
  const { message, pieceFile } = (await req.json()) as { message?: string; pieceFile?: string | null };
  if (!message?.trim()) return Response.json({ error: "Escribí qué querés cambiar" }, { status: 400 });
  try {
    return Response.json(await proposeChange(id, message.trim().slice(0, 1000), pieceFile ?? null));
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "No se pudo interpretar el pedido" }, { status: 502 });
  }
}
