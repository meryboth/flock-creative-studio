import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
export const detectorPath = (repoRoot: string) => join(repoRoot, ".claude/skills/impeccable/scripts/impeccable");

/**
 * Corre el detector de Impeccable sobre documentos HTML y devuelve los hallazgos por documento
 * (sin las notas de sugerencia). Si el detector no está instalado, devuelve null.
 */
export async function detectFindings(repoRoot: string, docs: Record<string, string>): Promise<Record<string, string[]> | null> {
  const detector = detectorPath(repoRoot);
  if (!existsSync(detector)) return null;
  const dir = await mkdtemp(join(tmpdir(), "flock-qa-"));
  try {
    await mkdir(dir, { recursive: true });
    const files = await Promise.all(
      Object.entries(docs).map(async ([name, html]) => {
        const file = join(dir, `${name}.html`);
        await writeFile(file, html);
        return file;
      }),
    );
    let out: string;
    try {
      out = (await run(detector, ["detect", "--no-advisory", ...files], { cwd: repoRoot, maxBuffer: 10 * 1024 * 1024 })).stdout;
    } catch (err) {
      out = (err as { stdout?: string }).stdout ?? "";
    }
    const findings: Record<string, string[]> = Object.fromEntries(Object.keys(docs).map((n) => [n, []]));
    let current = "";
    for (const line of out.split("\n")) {
      const file = line.trim().match(/([^/]+)\.html$/);
      if (file && findings[file[1]]) current = file[1];
      else if (current && /^\s+\[[\w-]+\]/.test(line)) findings[current].push(line.trim());
    }
    return findings;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
