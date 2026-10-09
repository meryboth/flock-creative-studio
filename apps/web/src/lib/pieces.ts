import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { STORAGE_DIR } from "./paths";

export type PieceGroup = { id: string; title: string; files: string[] };

const GROUPS: { id: string; title: string }[] = [
  { id: "linkedin", title: "LinkedIn" },
  { id: "cronograma", title: "Cronograma" },
  { id: "credenciales", title: "Credenciales" },
  { id: "certificados", title: "Certificados" },
  { id: "landing", title: "Landing" },
];

export async function listPieces(slug: string): Promise<PieceGroup[]> {
  const base = join(STORAGE_DIR, slug);
  return Promise.all(
    GROUPS.map(async (g) => {
      const files = await readdir(join(base, g.id)).catch(() => [] as string[]);
      return { ...g, files: files.sort().map((f) => `${slug}/${g.id}/${f}`) };
    }),
  );
}

export async function readText(path: string) {
  return readFile(join(STORAGE_DIR, path), "utf8");
}

export const storageUrl = (path: string) => `/api/storage/${path}`;

/** Miniatura de un evento: su primer posteo cuadrado, si ya se generó. */
export async function eventThumbnail(folder: string) {
  const files = await readdir(join(STORAGE_DIR, folder, "linkedin")).catch(() => [] as string[]);
  const squares = files.filter((f) => f.endsWith("-square.png"));
  // el anuncio es la pieza que mejor representa al evento
  const square = squares.find((f) => /^(anuncio|save-the-date)/.test(f)) ?? squares.sort()[0];
  return square ? storageUrl(`${folder}/linkedin/${square}`) : null;
}
