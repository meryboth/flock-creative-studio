import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Attendee } from "@flock/templates";
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
 * Pendiente. Plan: Microsoft Graph con una app registrada en Entra ID (permiso de lectura de archivos):
 *   1. codificar el link compartido → shareId ("u!" + base64url del link)
 *   2. GET /shares/{shareId}/driveItem/content → .xlsx
 *   3. leer la hoja y mapear columnas (nombre, apellido, área, rol) con parseAttendees
 */
async function fetchSharePointExcel(_url: string, _sheet?: string): Promise<Attendee[]> {
  throw new Error("La conexión con SharePoint todavía no está configurada (ver docs/PROPUESTA_TECNICA.md, sección de credenciales).");
}
