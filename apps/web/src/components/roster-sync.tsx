"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PixelLoader } from "./processing";

type RosterInfo = { source: string; fetchedAt?: string; url?: string; fileName?: string; count?: number; presencial?: number; error?: string } | null;

const fmt = (iso: string) => new Date(iso).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Acciones de las credenciales: descargar todo en .zip y cargar la nómina (Excel / CSV o link de SharePoint). */
export function CredentialsActions({ eventId, roster, suggestedUrl }: { eventId: string; roster: RosterInfo; suggestedUrl: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(roster?.url ?? suggestedUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(body: BodyInit, headers?: HeadersInit) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/eventos/${eventId}/nomina`, { method: "POST", headers, body });
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

  const sync = (e: React.FormEvent) => {
    e.preventDefault();
    send(JSON.stringify({ url }), { "Content-Type": "application/json" });
  };

  function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    send(form);
    e.target.value = "";
  }

  const counts = roster?.count != null ? ` · ${roster.count} confirmados${roster.presencial != null ? ` · ${roster.presencial} con credencial impresa` : ""}` : "";
  const status =
    roster?.fetchedAt && !roster.error && roster.source === "sharepoint-excel"
      ? `Nómina de SharePoint${counts} · sincronizada el ${fmt(roster.fetchedAt)}`
      : roster?.fetchedAt && !roster.error && (roster.source === "xlsx" || roster.source === "csv")
        ? `Nómina: ${roster.fileName ?? "archivo"}${counts} · cargada el ${fmt(roster.fetchedAt)}`
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
          Cargar nómina
        </button>
        <span className="text-sm text-muted">{status}</span>
      </div>

      {open && (
        <div className="mt-4 space-y-4 border-[1.5px] border-ink bg-surface p-4">
          <p className="font-hand text-2xl font-bold leading-none">¿quiénes vienen?</p>
          <p className="text-sm text-muted">
            Cargá la nómina de confirmados: sirve la exportación del formulario de inscripción (Microsoft Forms) tal como sale, o cualquier Excel con
            nombre y apellido. Si tiene la pregunta de asistencia, las credenciales impresas salen solo para quienes van presencial; los que dijeron que no
            quedan afuera.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <label className={`btn-ink cursor-pointer ${busy ? "pointer-events-none opacity-50" : ""}`}>
              {busy ? (
                <>
                  <PixelLoader size={12} /> Leyendo…
                </>
              ) : (
                "Subir Excel o CSV"
              )}
              <input type="file" accept=".xlsx,.csv" onChange={upload} className="sr-only" disabled={busy} />
            </label>
            <span className="text-xs text-muted">.xlsx o .csv, hasta 10 MB</span>
          </div>

          <form onSubmit={sync} className="space-y-2 border-t border-border pt-4">
            <p className="label-mono">o un link de SharePoint / OneDrive</p>
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
              <button type="submit" disabled={busy} className="btn-line">
                Sincronizar
              </button>
            </div>
            <p className="text-xs text-muted">
              El link queda guardado para volver a sincronizar y para los próximos eventos. Una nómina privada necesita la app de Entra ID que tiene que
              registrar IT.
            </p>
          </form>
          {(error ?? roster?.error) && <p className="text-sm text-orange">{error ?? roster?.error}</p>}
        </div>
      )}
    </div>
  );
}
