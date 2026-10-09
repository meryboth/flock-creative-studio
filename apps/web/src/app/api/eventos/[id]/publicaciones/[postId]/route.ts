import { and, eq } from "drizzle-orm";
import { db, schema } from "@flock/db";
import { cancelPost, publishNow } from "@/lib/schedule";

// Cancela una publicación programada o la publica ya
export async function POST(req: Request, ctx: RouteContext<"/api/eventos/[id]/publicaciones/[postId]">) {
  const { id, postId } = await ctx.params;
  const { action } = (await req.json()) as { action: "cancel" | "publish" };
  const [post] = await db
    .select({ id: schema.scheduledPosts.id })
    .from(schema.scheduledPosts)
    .where(and(eq(schema.scheduledPosts.id, postId), eq(schema.scheduledPosts.eventId, id)));
  if (!post) return Response.json({ error: "Publicación inexistente" }, { status: 404 });
  try {
    if (action === "cancel") await cancelPost(postId);
    else await publishNow(postId);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "No se pudo publicar" }, { status: 400 });
  }
}
