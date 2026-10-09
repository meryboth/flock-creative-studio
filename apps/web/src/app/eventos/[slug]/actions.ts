"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@flock/db";
import { runGeneration, type StyleChoice } from "@/lib/studio";

/** Otra variante visual: cambia la semilla y regenera sin volver a redactar los textos. */
export async function newVariantAction(eventId: string) {
  const [event] = await db.select().from(schema.events).where(eq(schema.events.id, eventId));
  if (!event) return;
  const style = event.style as StyleChoice;
  await db.update(schema.events).set({ style: { ...style, seed: style.seed + 1 }, status: "producing" }).where(eq(schema.events.id, eventId));
  after(() => runGeneration(eventId, { rewriteCopy: false }));
  revalidatePath(`/eventos/${eventId}`);
}

/** Vuelve a pedirle los textos a Gemini y regenera. */
export async function rewriteCopyAction(eventId: string) {
  await db.update(schema.events).set({ status: "producing" }).where(eq(schema.events.id, eventId));
  after(() => runGeneration(eventId, { rewriteCopy: true }));
  revalidatePath(`/eventos/${eventId}`);
}
