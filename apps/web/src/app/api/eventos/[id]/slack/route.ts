import { scheduleSlackPost } from "@/lib/schedule";

// Programa una pieza cualquiera del evento en un canal de Slack (con o sin la app de Slack conectada)
export async function POST(req: Request, ctx: RouteContext<"/api/eventos/[id]/slack">) {
  const { id } = await ctx.params;
  const body = (await req.json()) as { pieceFile?: string; text?: string; target?: string; scheduledAt?: string };
  try {
    const row = await scheduleSlackPost({
      eventId: id,
      pieceFile: body.pieceFile ?? "",
      text: body.text ?? "",
      target: body.target ?? "",
      scheduledAt: new Date(body.scheduledAt ?? ""),
    });
    return Response.json({ ok: true, id: row.id });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "No se pudo programar" }, { status: 400 });
  }
}
