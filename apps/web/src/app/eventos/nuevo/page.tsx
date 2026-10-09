import { Suspense } from "react";
import { STYLE_LIST, DEFAULT_SEEDS } from "@flock/templates";
import { listLibraryStyles } from "@/lib/style-library";
import { ArrowDoodle } from "@/components/doodles";
import { NewEventForm } from "./new-event-form";

export default function NewEventPage({ searchParams }: PageProps<"/eventos/nuevo">) {
  return (
    <main className="px-5 py-12 sm:px-10">
      <header className="mb-12 flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Nuevo evento</h1>
          <p className="mt-3 max-w-2xl text-muted">
            Contanos del evento y elegí un estilo. Mientras completás los datos vas viendo cómo quedan las piezas; al final generamos la familia completa.
          </p>
        </div>
        <p className="flex items-center gap-1 font-hand text-2xl text-orange">
          <ArrowDoodle className="h-7 w-11 rotate-180 text-orange" />
          tres pasos y listo
        </p>
      </header>
      <Suspense fallback={<p className="font-hand text-2xl text-muted">preparando el formulario…</p>}>
        <FormWithLibrary searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function FormWithLibrary({ searchParams }: { searchParams: PageProps<"/eventos/nuevo">["searchParams"] }) {
  const { estilo } = await searchParams;
  const library = await listLibraryStyles();
  const styles = STYLE_LIST.map((s) => ({ id: s.id, name: s.name, description: s.description, customColors: s.customColors, defaults: DEFAULT_SEEDS[s.id] }));
  const initial = typeof estilo === "string" && library.some((l) => l.id === estilo) ? estilo : undefined;
  return (
    <NewEventForm
      styles={styles}
      library={library.map((l) => ({
        id: l.id,
        name: l.name,
        description: l.reference.description,
        colors: { accent: l.reference.colors.accent, accent2: l.reference.colors.accent2 },
      }))}
      initialLibraryId={initial}
    />
  );
}
