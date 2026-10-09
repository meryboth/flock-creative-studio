import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Attendee } from "@flock/templates";
import readXlsxFile from "read-excel-file/node";
import { parseAttendees } from "./csv";

/**
 * Fuente de la nómina de flockers para credenciales y certificados.
 * La nómina se lee **al generar**, así cada evento nuevo trae a los flockers vigentes;
 * el evento guarda una copia (snapshot) para que sus piezas no cambien después.
 */
export type RosterSource =
  | { kind: "mock" } // nómina ficticia de data/nomina-ejemplo.csv
  | { kind: "csv"; text: string } // pegada o subida a mano
  | { kind: "sharepoint-excel"; url: string; sheet?: string }; // pendiente: ver fetchSharePointExcel

export type RosterSnapshot = { source: RosterSource["kind"]; fetchedAt: string; attendees: Attendee[] };

export async function loadRoster(source: RosterSource, repoRoot: string): Promise<RosterSnapshot> {
  const fetchedAt = new Date().toISOString();
  switch (source.kind) {
    case "mock":
      return { source: "mock", fetchedAt, attendees: parseAttendees(await readFile(join(repoRoot, "data/nomina-ejemplo.csv"), "utf8")) };
    case "csv":
      return { source: "csv", fetchedAt, attendees: parseAttendees(source.text) };
    case "sharepoint-excel":
      return { source: "sharepoint-excel", fetchedAt, attendees: await fetchSharePointExcel(source.url, source.sheet) };
  }
}

/**
 * Lee la nómina desde un link de SharePoint / OneDrive (Excel o CSV).
 * - Hoy: links compartidos sin inicio de sesión ("cualquier persona con el link"): se descargan con ?download=1.
 * - Nómina privada (lo esperable): Microsoft Graph con una app de Entra ID con permiso de lectura:
 *     1. codificar el link compartido → shareId ("u!" + base64url del link)
 *     2. GET /shares/{shareId}/driveItem/content → .xlsx
 *   Pendiente de que IT registre la app; el resto del flujo (lectura, mapeo de columnas, snapshot) ya es este.
 */
async function fetchSharePointExcel(url: string, sheet?: string): Promise<Attendee[]> {
  let link: URL;
  try {
    link = new URL(url);
  } catch {
    throw new Error("El link de la nómina no es válido");
  }
  // Solo hosts de Microsoft 365: el servidor no descarga links arbitrarios
  const host = link.hostname.toLowerCase();
  if (link.protocol !== "https:" || !(host.endsWith(".sharepoint.com") || host === "onedrive.live.com" || host === "1drv.ms"))
    throw new Error("El link tiene que ser de SharePoint o OneDrive (https://….sharepoint.com/…)");
  link.searchParams.set("download", "1");
  const res = await fetch(link, { redirect: "follow", signal: AbortSignal.timeout(30_000) }).catch((err: Error) => {
    throw new Error(`No se pudo conectar con ${link.hostname} (${(err.cause as Error | undefined)?.message ?? err.message})`);
  });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || type.includes("text/html"))
    throw new Error(
      "SharePoint pidió iniciar sesión: para leer la nómina privada hace falta la app de Entra ID (pendiente con IT). Mientras tanto, compartí el Excel con «cualquier persona con el link» o cargá un CSV.",
    );
  const data = Buffer.from(await res.arrayBuffer());
  const csv = type.includes("csv") || link.pathname.endsWith(".csv") ? data.toString("utf8") : toCsv(await readXlsxFile(data, sheet ? { sheet } : undefined));
  const attendees = parseAttendees(csv);
  if (!attendees.length) throw new Error("No encontré personas en la nómina: revisá que tenga columnas nombre y apellido (o nombre_completo)");
  return attendees;
}

/** Filas de Excel → CSV, para reutilizar el mismo mapeo de columnas que la carga manual. */
function toCsv(rows: unknown[][]) {
  const cell = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\n");
}
