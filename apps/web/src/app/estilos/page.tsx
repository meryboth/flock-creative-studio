import { Suspense } from "react";
import Link from "next/link";
import { STYLE_LIST } from "@flock/templates";
import { PreviewFrame } from "@/components/preview-frame";
import { Squiggle } from "@/components/doodles";
import { listLibraryStyles } from "@/lib/style-library";

const SAMPLE = new URLSearchParams({ name: "Evento de ejemplo", date: "2027-04-15", description: "Así se vería tu evento con este estilo.", language: "es" });

export default function StylesPage() {
  return (
    <main className="px-5 py-12 sm:px-10">
      <header className="mb-12 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Estilos</h1>
          <p className="mt-3 max-w-2xl text-muted">
            Los estilos disponibles para los eventos. Sumá los tuyos a partir de piezas que te gusten: leemos su esencia y la convertimos en un estilo reutilizable.
          </p>
        </div>
        <Link href="/estilos/nuevo" className="btn-ink">
          Nuevo estilo
        </Link>
      </header>

      <section className="mb-16" aria-labelledby="equipo">
        <div className="mb-8 flex items-center gap-4">
          <h2 id="equipo" className="boxed text-lg font-semibold">
            del equipo
          </h2>
          <Squiggle className="h-3 w-24 text-orange" />
        </div>
        <Suspense fallback={<p className="font-hand text-2xl text-muted">buscando estilos…</p>}>
          <LibraryGrid />
        </Suspense>
      </section>

      <section aria-labelledby="catalogo">
        <div className="mb-8 flex items-center gap-4">
          <h2 id="catalogo" className="boxed text-lg font-semibold">
            del catálogo
          </h2>
        </div>
        <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STYLE_LIST.map((s) => (
            <li key={s.id} className="border-[1.5px] border-ink bg-surface p-2">
              <PreviewFrame src={`/api/preview?${SAMPLE}&style=${s.id}&piece=linkedin`} width={1200} height={1200} title={`Estilo ${s.name}`} />
              <p className="px-1 pt-3 font-semibold">{s.name}</p>
              <p className="px-1 pb-1 pt-1 text-sm text-muted">{s.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

async function LibraryGrid() {
  const styles = await listLibraryStyles();
  if (!styles.length) {
    return (
      <div className="border-[1.5px] border-dashed border-ink bg-surface/60 px-8 py-12 text-center">
        <p className="font-hand text-3xl">todavía no hay estilos del equipo</p>
        <p className="mx-auto mt-2 max-w-md text-muted">Subí una pieza que te guste (un afiche, un posteo, una portada) y convertila en un estilo para los próximos eventos.</p>
        <Link href="/estilos/nuevo" className="btn-ink mt-6">
          Crear el primer estilo
        </Link>
      </div>
    );
  }
  return (
    <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {styles.map((s, i) => (
        <li key={s.id}>
          <Link
            href={`/estilos/${s.id}`}
            className={`group block border-[1.5px] border-ink bg-surface p-2 transition hover:-translate-y-0.5 hover:shadow-[6px_6px_0_var(--yellow)] ${i % 2 ? "rotate-[0.6deg]" : "-rotate-[0.6deg]"}`}
          >
            <PreviewFrame src={`/api/preview?${SAMPLE}&style=referencia&lib=${s.id}&piece=linkedin`} width={1200} height={1200} title={`Estilo ${s.name}`} />
            <div className="px-1 pb-1 pt-3">
              <p className="text-lg font-semibold">{s.name}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {s.reference.mood.slice(0, 3).map((m) => (
                  <span key={m} className="sticker bg-mint text-xs">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
