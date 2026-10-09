"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PixelLoader } from "./processing";

type RosterInfo = { source: string; fetchedAt?: string; url?: string; count?: number; error?: string } | null;

const fmt = (iso: string) => new Date(iso).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Acciones de las credenciales: descargar todo en .zip y sincronizar con la nómina de SharePoint. */
export function CredentialsActions({ eventId, roster, suggestedUrl }: { eventId: string; roster: RosterInfo; suggestedUrl: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(roster?.url ?? suggestedUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sync(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/eventos/${eventId}/nomina`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo leer la nómina");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const status =
    roster?.source === "sharepoint-excel" && roster.fetchedAt && !roster.error
      ? `Nómina de SharePoint · ${roster.count ?? "?"} personas · sincronizada el ${fmt(roster.fetchedAt)}`
      : roster?.source === "mock" || !roster
        ? "Nómina de ejemplo (nombres ficticios)"
        : "Nómina cargada a mano";

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-3">
        <a href={`/api/eventos/${eventId}/descargar?grupo=credenciales`} className="btn-ink" download>
          Descargar todas (.zip)
        </a>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="btn-line">
          Sync con la nómina
        </button>
        <span className="text-sm text-muted">{status}</span>
      </div>

      {open && (
        <form onSubmit={sync} className="mt-4 space-y-3 border-[1.5px] border-ink bg-surface p-4">
          <p className="font-hand text-2xl font-bold leading-none">nómina en SharePoint</p>
          <p className="text-sm text-muted">
            Pegá el link del Excel de la nómina (columnas nombre y apellido, o nombre_completo; opcional área y rol). Se lee ahora y queda guardado para
            volver a sincronizar y para los próximos eventos.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://flockit.sharepoint.com/:x:/s/…"
              aria-label="Link del Excel de la nómina"
              className="min-w-0 flex-1 border-[1.5px] border-ink bg-surface px-3 py-2 font-mono text-xs focus:shadow-[3px_3px_0_var(--yellow)] focus:outline-none"
            />
            <button type="submit" disabled={busy} className="btn-ink">
              {busy ? (
                <>
                  <PixelLoader size={12} /> Leyendo…
                </>
              ) : (
                "Sincronizar"
              )}
            </button>
          </div>
          {(error ?? roster?.error) && <p className="text-sm text-orange">{error ?? roster?.error}</p>}
          <p className="text-xs text-muted">
            Las credenciales y los certificados se regeneran con los nombres de la nómina. Una nómina privada necesita la app de Entra ID que tiene que registrar IT.
          </p>
        </form>
      )}
    </div>
  );
}
