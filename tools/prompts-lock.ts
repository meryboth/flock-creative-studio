// Actualiza packages/agents/prompts/prompts.lock.json con la versión y el hash de cada prompt.
// Correr después de cambiar un prompt (y subir su versión): pnpm prompts:lock
import { readFile, writeFile } from "node:fs/promises";
import { promptsLockPath, promptsSnapshot } from "@flock/agents";

const path = promptsLockPath();
const previous: Record<string, { version: number; hash: string }> = JSON.parse(await readFile(path, "utf8").catch(() => "{}"));
const current = promptsSnapshot();
for (const [id, p] of Object.entries(current)) {
  const before = previous[id];
  if (before && before.hash !== p.hash && before.version === p.version) {
    console.error(`✗ ${id}: el texto cambió y la versión sigue en ${p.version}. Subí "version" en el archivo del prompt.`);
    process.exit(1);
  }
  if (!before || before.version !== p.version) console.log(`· ${id}: versión ${p.version}`);
}
await writeFile(path, JSON.stringify(current, null, 2) + "\n");
console.log(`Listo: ${path}`);
