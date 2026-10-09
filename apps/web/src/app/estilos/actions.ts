"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createLibraryStyle, deleteLibraryStyle } from "@/lib/style-library";

export type StyleFormState = { error?: string };

export async function createStyleAction(_prev: StyleFormState, form: FormData): Promise<StyleFormState> {
  const name = String(form.get("name") ?? "").trim();
  const uploadId = String(form.get("uploadId") ?? "");
  if (!name) return { error: "Ponele un nombre al estilo." };
  if (!uploadId) return { error: "Subí al menos una imagen de referencia." };
  let id: string;
  try {
    id = await createLibraryStyle(name, uploadId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo guardar el estilo." };
  }
  revalidatePath("/estilos");
  redirect(`/estilos/${id}`);
}

export async function deleteStyleAction(id: string) {
  await deleteLibraryStyle(id);
  revalidatePath("/estilos");
  redirect("/estilos");
}
