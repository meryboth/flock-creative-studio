import "server-only";

/**
 * Progreso de trabajos largos en curso (ej. generar un key visual), en memoria del servidor.
 * Alcanza para una app local de un solo proceso; con varios procesos iría a la base.
 */
type Entry = Record<string, unknown> & { startedAt: number };

const store = ((globalThis as unknown as { __flockProgress?: Map<string, Entry> }).__flockProgress ??= new Map());

export function setProgress(key: string, progress: Record<string, unknown>) {
  const prev = store.get(key);
  store.set(key, { ...prev, ...progress, startedAt: prev?.startedAt ?? Date.now() });
}

export function getProgress(key: string) {
  return store.get(key) ?? null;
}

export function clearProgress(key: string) {
  store.delete(key);
}
