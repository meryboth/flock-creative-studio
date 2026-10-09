"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { parseAgenda, parseAttendees } from "@flock/studio";
import { STYLES, type StyleId } from "@flock/templates";
import { existsSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { STORAGE_DIR } from "@/lib/paths";
import { getLibraryStyle } from "@/lib/style-library";
import { keyVisualPath, readReference } from "@/lib/reference";
import { uploadElements } from "@/lib/reference";
import { createEvent, runGeneration, setEventGraphics, type StyleChoice } from "@/lib/studio";

export type FormState = { error?: string; field?: string };

const HEX = /^#[0-9a-f]{6}$/i;

export async function createEventAction(_prev: FormState, form: FormData): Promise<FormState> {
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const name = get("name");
  const date = get("date");
  const styleId = get("styleId") as StyleId;
  if (!name) return { error: "Poné un nombre para el evento.", field: "name" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Elegí la fecha del evento.", field: "date" };
  if (!STYLES[styleId]) return { error: "Elegí un estilo.", field: "style" };

  const agendaText = get("agenda");
  const agenda = parseAgenda(agendaText);
  if (agendaText && !agenda.length)
    return { error: "No pudimos leer la agenda. Escribí un bloque por línea, por ejemplo: 9:30 - 10:30 Charla de apertura", field: "agenda" };

  const attendeesText = get("attendees");
  const attendees = parseAttendees(attendeesText);
  if (attendeesText && !attendees.length)
    return { error: "No pudimos leer la lista de asistentes. La primera fila tiene que tener los encabezados: nombre, apellido, area, rol", field: "attendees" };

  const accent = get("accent");
  const accent2 = get("accent2");
  let moodboard: unknown = null;
  try {
    moodboard = get("moodboard") ? JSON.parse(get("moodboard")) : null;
  } catch {
    moodboard = null;
  }

  const style: StyleChoice = {
    styleId,
    seeds: { accent: HEX.test(accent) ? accent : "#2b3bff", accent2: HEX.test(accent2) ? accent2 : undefined },
    seed: Number(get("seed")) || 1,
  };
  const libraryStyleId = get("libraryStyleId");
  if (styleId === "referencia" && libraryStyleId) {
    const library = await getLibraryStyle(libraryStyleId);
    if (!library) return { error: "Ese estilo ya no está en la biblioteca. Elegí otro.", field: "style" };
    style.reference = library.reference;
    style.libraryStyleId = library.id;
    if (library.keyVisual) style.keyVisual = library.keyVisual; // se copian al evento después de crearlo
    if (library.elements.length) style.elements = library.elements;
  } else if (styleId === "referencia") {
    const upload = get("referenceUpload");
    const stored = upload ? await readReference(upload).catch(() => null) : null;
    if (!stored) return { error: "No encontramos la lectura de tu referencia. Volvé a subir la imagen.", field: "style" };
    style.reference = stored.style;
    style.referenceUpload = upload;
    if (get("keyVisual") === "1" && existsSync(keyVisualPath(upload))) style.keyVisual = `uploads/${upload}/keyvisual.png`;
    if (get("elements") === "1") style.elements = await uploadElements(upload);
  }

  const id = await createEvent({
    name,
    date,
    location: get("location"),
    language: get("language") === "en" ? "en" : "es",
    hashtag: get("hashtag"),
    tagline: get("tagline"),
    description: get("description"),
    style,
    moodboard,
    agenda,
    attendees,
  });

  // El evento guarda su propia copia de los gráficos: si después se borra el estilo o la subida, no se pierden
  const graphics: { keyVisual?: string; elements?: string[] } = {};
  await mkdir(join(STORAGE_DIR, id, "inputs"), { recursive: true });
  if (style.keyVisual && existsSync(join(STORAGE_DIR, style.keyVisual))) {
    graphics.keyVisual = `${id}/inputs/keyvisual.png`;
    await copyFile(join(STORAGE_DIR, style.keyVisual), join(STORAGE_DIR, graphics.keyVisual));
  }
  if (style.elements?.length) {
    graphics.elements = [];
    for (const [i, e] of style.elements.entries()) {
      if (!existsSync(join(STORAGE_DIR, e))) continue;
      const own = `${id}/inputs/element-${i + 1}.png`;
      await copyFile(join(STORAGE_DIR, e), join(STORAGE_DIR, own));
      graphics.elements.push(own);
    }
  }
  if (graphics.keyVisual || graphics.elements) await setEventGraphics(id, graphics);

  // La generación (Gemini + render) tarda: corre después de responder y la página muestra el progreso
  after(() => runGeneration(id));
  redirect(`/eventos/${id}`);
}
