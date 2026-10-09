import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { PreviewFrame } from "@/components/preview-frame";
import { ReferencePanel } from "@/components/reference-panel";
import { countEventsUsing, getLibraryStyle } from "@/lib/style-library";
import { deleteStyleAction } from "../actions";

const SAMPLE = new URLSearchParams({ name: "Evento de ejemplo", date: "2027-04-15", description: "Así se vería tu evento con este estilo.", language: "es" });

export default function StylePage({ params }: PageProps<"/estilos/[id]">) {
  return (
    <main className="px-5 py-10 sm:px-10">
      <Link href="/estilos" className="label-mono text-muted hover:text-ink">
        ← Estilos
      </Link>
      <Suspense fallback={<p className="mt-10 font-hand text-2xl text-muted">abriendo el estilo…</p>}>
        <StyleDetail params={params} />
      </Suspense>
    </main>
  );
}

async function StyleDetail({ params }: { params: PageProps<"/estilos/[id]">["params"] }) {
  const { id } = await params;
  const style = await getLibraryStyle(id);
  if (!style) notFound();
  const used = await countEventsUsing(id);
  const preview = (piece: string) => `/api/preview?${SAMPLE}&style=referencia&lib=${id}&piece=${piece}`;

  return (
    <>
      <header className="mb-10 mt-4 flex flex-wrap items-end justify-between gap-6 border-b border-border pb-8">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{style.name}</h1>
          <p className="mt-2 text-muted">
            Creado el {style.createdAt.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
            {" · "}
            {used ? `usado en ${used} ${used === 1 ? "evento" : "eventos"}` : "todavía no se usó en ningún evento"}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={`/eventos/nuevo?estilo=${id}`} className="btn-ink">
            Usar en un evento
          </Link>
          <form action={deleteStyleAction.bind(null, id)}>
            <ConfirmSubmit
              className="btn-line hover:!bg-orange hover:text-white"
              message={
                used
                  ? `¿Borrar "${style.name}"? Los ${used} eventos que lo usaron conservan sus piezas, pero no vas a poder elegirlo para eventos nuevos.`
                  : `¿Borrar "${style.name}" de la biblioteca?`
              }
            >
              Borrar estilo
            </ConfirmSubmit>
          </form>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="min-w-0 space-y-8">
          <div>
            <h2 className="boxed mb-5 text-lg font-semibold">referencias</h2>
            <div className="flex flex-wrap gap-3">
              {style.images.map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src} src={`/api/storage/${src}`} alt="Referencia del estilo" className="h-28 w-28 border-[1.5px] border-ink object-cover" />
              ))}
              {style.keyVisual && (
                <figure className="taped border-[1.5px] border-ink bg-[#ecebe5] p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/storage/${style.keyVisual}`} alt="Key visual generado" className="h-28 w-28 object-contain" />
                  <figcaption className="label-mono px-1 pt-1 text-muted">key visual</figcaption>
                </figure>
              )}
            </div>
          </div>
          <ReferencePanel reading={style.reference} />
        </div>

        <div className="min-w-0 space-y-8">
          <h2 className="font-hand text-3xl font-bold leading-none">así se aplica</h2>
          <div className="taped -rotate-[0.4deg] border-[1.5px] border-ink bg-surface p-2 shadow-lg">
            <PreviewFrame src={preview("slide")} width={1920} height={1080} title="Ejemplo: cronograma" />
          </div>
          <div className="grid grid-cols-[1.4fr_1fr] gap-6">
            <div className="rotate-[0.6deg] border-[1.5px] border-ink bg-surface p-2 shadow-md">
              <PreviewFrame src={preview("linkedin")} width={1200} height={1200} title="Ejemplo: posteo" />
            </div>
            <div className="-rotate-[0.8deg] border-[1.5px] border-ink bg-surface p-2 shadow-md">
              <PreviewFrame src={preview("badge")} width={638} height={1011} title="Ejemplo: credencial" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
