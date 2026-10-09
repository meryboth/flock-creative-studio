import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { analyzeMoodboard, analyzeReference } from "@flock/agents";
import { UPLOADS_DIR } from "@/lib/paths";

const ALLOWED = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const MAX_FILES = 15;
const MAX_BYTES = 15 * 1024 * 1024;

// Recibe las imágenes del moodboard, las guarda y devuelve colores + estilo sugerido
export async function POST(req: Request) {
  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) return Response.json({ error: "Subí al menos una imagen" }, { status: 400 });
  if (files.length > MAX_FILES) return Response.json({ error: `Hasta ${MAX_FILES} imágenes` }, { status: 400 });

  const uploadId = randomUUID();
  const dir = join(UPLOADS_DIR, uploadId);
  await mkdir(dir, { recursive: true });
  const paths: string[] = [];
  for (const [i, file] of files.entries()) {
    const ext = extname(file.name).toLowerCase();
    if (!ALLOWED.has(ext)) return Response.json({ error: `Formato no soportado: ${file.name} (usá PNG, JPG o WebP)` }, { status: 400 });
    if (file.size > MAX_BYTES) return Response.json({ error: `${file.name} pesa más de 15 MB` }, { status: 400 });
    const path = join(dir, `${i + 1}${ext}`);
    await writeFile(path, Buffer.from(await file.arrayBuffer()));
    paths.push(path);
  }

  try {
    const analysis = await analyzeMoodboard(paths);
    // Lectura del estilo con un modelo de visión: si falla, igual devolvemos los colores medidos
    let reference: Awaited<ReturnType<typeof analyzeReference>> | null = null;
    let referenceError: string | null = null;
    try {
      reference = await analyzeReference(paths);
      await writeFile(join(dir, "reference.json"), JSON.stringify(reference, null, 2));
    } catch (err) {
      referenceError = err instanceof Error ? err.message : String(err);
      console.warn("[referencia]", referenceError);
    }
    return Response.json({
      uploadId,
      images: paths.map((_, i) => `uploads/${uploadId}/${i + 1}${extname(files[i].name).toLowerCase()}`),
      ...analysis,
      reference: reference?.style ?? null,
      referenceError,
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "No se pudieron analizar las imágenes" }, { status: 422 });
  }
}
