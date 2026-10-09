import type { Moment } from "@flock/templates";
import { schedulePost, type Channel } from "@/lib/schedule";

const CHANNELS = ["slack", "linkedin"];
const MOMENTS = ["antes", "durante", "despues"];

// Programa (o reprograma) la publicación de un momento en Slack o LinkedIn
export async function POST(req: Request, ctx: RouteContext<"/api/eventos/[id]/publicaciones">) {
  const { id } = await ctx.params;
  const body = (await req.json()) as { channel: Channel; moment: Moment; scheduledAt: string; target?: string };
  if (!CHANNELS.includes(body.channel) || !MOMENTS.includes(body.moment)) return Response.json({ error: "Pedido inválido" }, { status: 400 });
  try {
    const row = await schedulePost({ eventId: id, channel: body.channel, moment: body.moment, scheduledAt: new Date(body.scheduledAt), target: body.target?.trim() });
    return Response.json({ ok: true, id: row.id });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "No se pudo programar" }, { status: 400 });
  }
}
