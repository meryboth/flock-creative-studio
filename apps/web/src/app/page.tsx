import { Suspense } from "react";
import Link from "next/link";
import { STYLES, type StyleId } from "@flock/templates";
import { ArrowDoodle, Sparkle, Squiggle } from "@/components/doodles";
import { eventThumbnail } from "@/lib/pieces";
import { listEvents } from "@/lib/studio";

export default function Home() {
  return (
    <main>
      <Hero />
      <section className="px-5 pb-16 sm:px-10" aria-labelledby="eventos">
        <div className="mb-8 flex items-center gap-4">
          <h2 id="eventos" className="boxed text-lg font-semibold">
            tus eventos
          </h2>
          <Squiggle className="h-3 w-24 text-orange" />
        </div>
        <Suspense fallback={<p className="font-hand text-2xl text-muted">buscando eventos…</p>}>
          <EventList />
        </Suspense>
      </section>
    </main>
  );
}

function Hero() {
  return (
    <section className="relative px-5 pb-16 pt-14 text-center sm:px-10 sm:pt-20">
      <div className="relative mx-auto inline-block">
        <span className="sticker absolute -left-4 -top-7 -rotate-6 bg-mint text-xs sm:-left-24">posteos</span>
        <span className="sticker absolute -right-2 -top-8 rotate-3 bg-yellow text-xs sm:-right-24">cronograma</span>
        <h1 className="hand-frame px-6 py-3 font-pixel text-5xl font-bold leading-none tracking-tight sm:px-10 sm:text-7xl">
          CREATIVE
          <br />
          STUDIO
        </h1>
        <span className="sticker absolute -bottom-6 -left-6 rotate-2 bg-pink text-xs text-white sm:-left-28">credenciales</span>
        <span className="sticker absolute -bottom-7 -right-4 -rotate-3 bg-green text-xs text-white sm:-right-24">landing</span>
      </div>

      <p className="mx-auto mt-16 max-w-xl text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
        Definí un evento, elegí un estilo y llevate todas las piezas.
      </p>
      <div className="mt-8 flex items-center justify-center gap-3">
        <Link href="/eventos/nuevo" className="btn-ink">
          <Sparkle className="h-3.5 w-3.5 text-yellow" />
          Nuevo evento
        </Link>
        <span className="hidden items-center gap-1 font-hand text-xl text-muted sm:flex">
          <ArrowDoodle className="h-6 w-10 -scale-x-100 text-orange" />
          ¡arrancá por acá!
        </span>
      </div>
    </section>
  );
}

const STATUS: Record<string, { label: string; className: string }> = {
  exploring: { label: "borrador", className: "bg-surface" },
  kit_locked: { label: "borrador", className: "bg-surface" },
  producing: { label: "generando", className: "bg-yellow" },
  done: { label: "listo", className: "bg-mint" },
};

const TAB_COLORS = ["bg-violet text-white", "bg-ink text-white", "bg-yellow text-ink", "bg-green text-white", "bg-pink text-white"];

async function EventList() {
  const events = await listEvents();
  if (!events.length) {
    return (
      <div className="rounded-sm border-2 border-dashed border-border bg-surface/60 px-8 py-14 text-center">
        <p className="font-hand text-3xl">todavía no hay eventos</p>
        <p className="mx-auto mt-2 max-w-md text-muted">
          Cargá el nombre, la fecha y un estilo; en un par de minutos tenés la familia completa lista para publicar e imprimir.
        </p>
        <Link href="/eventos/nuevo" className="btn-ink mt-6">
          Crear el primer evento
        </Link>
      </div>
    );
  }
  const thumbs = await Promise.all(events.map((e) => eventThumbnail(e.id)));
  return (
    <ul className="space-y-10">
      {events.map((e, i) => {
        const style = (e.style as { styleId?: StyleId } | null)?.styleId;
        const status = STATUS[e.status] ?? STATUS.exploring;
        const date = e.date ? new Date(`${e.date}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" }) : "sin fecha";
        const dark = TAB_COLORS[i % TAB_COLORS.length].startsWith("bg-ink");
        return (
          <li key={e.id}>
            <Link href={`/eventos/${e.id}`} className="group block focus-visible:outline-offset-4">
              <span className={`folder-tab label-mono inline-block ${TAB_COLORS[i % TAB_COLORS.length]}`}>{date}</span>
              <div className={`grid items-center gap-6 p-6 transition-transform group-hover:-translate-y-0.5 sm:grid-cols-[1fr_auto] sm:p-8 ${dark ? "bg-ink text-white" : "bg-surface"} border border-ink`}>
                <div>
                  <p className="text-3xl font-semibold tracking-tight sm:text-4xl">{e.name}</p>
                  <p className={`mt-2 ${dark ? "text-white/70" : "text-muted"}`}>
                    {[e.location, style && `estilo ${STYLES[style].name}`].filter(Boolean).join(" · ")}
                  </p>
                  <div className="mt-5 flex flex-wrap items-center gap-4">
                    <span className={`sticker text-xs text-ink ${status.className}`}>{status.label}</span>
                    <span className="label-mono underline decoration-2 underline-offset-4 group-hover:decoration-orange">ver piezas</span>
                  </div>
                </div>
                {thumbs[i] && (
                  <div className="taped mx-auto w-40 rotate-2 bg-white p-2 shadow-md sm:w-44">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumbs[i]!} alt="" className="aspect-square w-full object-cover" />
                  </div>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
