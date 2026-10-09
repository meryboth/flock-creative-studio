import { ArrowDoodle } from "@/components/doodles";
import { NewStyleForm } from "./new-style-form";

export default function NewStylePage() {
  return (
    <main className="px-5 py-12 sm:px-10">
      <header className="mb-12 flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Nuevo estilo</h1>
          <p className="mt-3 max-w-2xl text-muted">
            Subí una o más piezas que te gusten. Leemos su esencia (colores, tipografía, formas, clima) y armamos un estilo que el equipo puede usar en cualquier evento.
          </p>
        </div>
        <p className="flex items-center gap-1 font-hand text-2xl text-orange">
          <ArrowDoodle className="h-7 w-11 rotate-180 text-orange" />
          no hace falta tener un evento
        </p>
      </header>
      <NewStyleForm />
    </main>
  );
}
