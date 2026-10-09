import type { AgendaItem, Attendee } from "@flock/templates";

// CSV mínimo con soporte de comillas ("Pérez, Juan") y separador , o ;
export function parseCsv(text: string): Record<string, string>[] {
  const sep = (text.split("\n")[0].match(/;/g)?.length ?? 0) > (text.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) row.push(cell), (cell = "");
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell), rows.push(row), (row = []), (cell = "");
    } else cell += c;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  const [header = [], ...data] = rows;
  const keys = header.map((h) => normalizeKey(h));
  return data.filter((r) => r.some((v) => v.trim())).map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

const normalizeKey = (h: string) =>
  h.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");

const pick = (r: Record<string, string>, ...keys: string[]) => keys.map((k) => r[k]).find(Boolean) ?? "";

/** Asistentes desde CSV. Acepta encabezados en español o inglés, o una columna "nombre completo". */
export function parseAttendees(text: string): Attendee[] {
  return parseCsv(text)
    .map((r) => {
      let firstName = pick(r, "nombre", "first_name", "firstname", "name");
      let lastName = pick(r, "apellido", "last_name", "lastname", "surname");
      const full = pick(r, "nombre_completo", "full_name", "fullname");
      if (!firstName && full) {
        const [first, ...rest] = full.split(" ");
        firstName = first;
        lastName = rest.join(" ");
      }
      return { firstName, lastName, area: pick(r, "area", "team", "equipo") || undefined, role: pick(r, "rol", "role", "puesto", "cargo") || undefined };
    })
    .filter((a) => a.firstName);
}

/**
 * Agenda desde texto libre, una línea por bloque:
 *   9:15 - 9:45 Kick-off | Auditorio
 *   11:00 Workshops
 * También acepta CSV con columnas hora_inicio, hora_fin, titulo, speaker, sala.
 */
export function parseAgenda(text: string): AgendaItem[] {
  const firstLine = text.trim().split("\n")[0] ?? "";
  if (/hora|start|titulo|title/i.test(firstLine) && /[,;]/.test(firstLine)) {
    return parseCsv(text).map((r) => ({
      start: pick(r, "hora_inicio", "inicio", "start"),
      end: pick(r, "hora_fin", "fin", "end") || undefined,
      title: pick(r, "titulo", "title", "actividad"),
      speaker: pick(r, "speaker", "orador", "oradora") || undefined,
      room: pick(r, "sala", "room", "lugar") || undefined,
    })).filter((a) => a.start && a.title);
  }
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(\d{1,2}[:.]\d{2})\s*(?:[-–a]\s*(\d{1,2}[:.]\d{2}))?\s*(?:hs\.?)?\s*[-–:|]?\s*(.+)$/i);
      if (!m) return null;
      const [title, room] = m[3].split("|").map((s) => s.trim());
      return { start: m[1].replace(".", ":"), end: m[2]?.replace(".", ":"), title, room: room || undefined };
    })
    .filter((a): a is NonNullable<typeof a> => Boolean(a && a.title));
}
