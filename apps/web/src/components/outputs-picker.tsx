"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Output = { id: string; label: string; description: string };

/** Qué piezas genera el evento: se pueden sumar (ej. certificados) o sacar, y se regenera. */
export function OutputsPicker({ eventId, options, selected }: { eventId: string; options: Output[]; selected: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(new Set(selected));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = picked.size !== selected.length || selected.some((s) => !picked.has(s));

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/eventos/${eventId}/piezas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outputs: [...picked] }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "No se pudo actualizar");
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="mb-10">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="label-mono text-muted underline underline-offset-4 hover:text-ink">
        {open ? "cerrar" : `piezas del evento (${selected.length} de ${options.length}) · agregar o quitar`}
      </button>
      {open && (
        <div className="mt-3 border-[1.5px] border-ink bg-surface p-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {options.map((o) => (
              <label key={o.id} className={`flex cursor-pointer gap-3 border-[1.5px] p-3 ${picked.has(o.id) ? "border-ink bg-mint/40" : "border-ink/25"}`}>
                <input
                  type="checkbox"
                  checked={picked.has(o.id)}
                  onChange={(e) => {
                    const next = new Set(picked);
                    if (e.target.checked) next.add(o.id);
                    else next.delete(o.id);
                    setPicked(next);
                  }}
                  className="mt-1 accent-[var(--ink)]"
                />
                <span>
                  <span className="block font-semibold">{o.label}</span>
                  <span className="block text-xs text-muted">{o.description}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={save} disabled={!changed || busy || picked.size === 0} className="btn-ink">
              {busy ? "Actualizando…" : "Actualizar piezas"}
            </button>
            <span className="text-xs text-muted">Se regeneran las piezas con los textos actuales.</span>
            {error && <span className="text-sm text-orange">{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
