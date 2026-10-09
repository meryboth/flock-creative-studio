import { Suspense } from "react";
import Link from "next/link";
import { STYLES } from "@flock/templates";
import { AutoRefresh } from "@/components/auto-refresh";
import { GenerationProgress } from "@/components/progress-views";
import { Studio, type StudioGroup, type StudioHistoryItem } from "@/components/studio";
import { describeOperation, listChanges } from "@/lib/editor";
import { listPieces, readText, storageUrl } from "@/lib/pieces";
import type { EditOperation } from "@flock/agents";
import type { schema } from "@flock/db";
import { getEvent, type StyleChoice } from "@/lib/studio";
import { newVariantAction, rewriteCopyAction } from "./actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function EventPage({ params }: PageProps<"/eventos/[slug]">) {
  return (
    <main className="px-5 py-10 sm:px-10">
      <Link href="/" className="label-mono text-muted hover:text-ink">
        ← Eventos
      </Link>
      <Suspense fallback={<p className="mt-10 text-muted">Cargando…</p>}>
        <EventContent params={params} />
      </Suspense>
    </main>
  );
}

async function EventContent({ params }: { params: PageProps<"/eventos/[slug]">["params"] }) {
  const { slug } = await params;
  // Eventos creados en la app (uuid) o generados por CLI (carpeta en storage/)
  const data = UUID.test(slug) ? await getEvent(slug) : null;

  if (!data) {
    return (
      <>
        <header className="mb-12 mt-4 border-b border-border pb-8">
          <h1 className="text-4xl font-semibold tracking-tight">{slug}</h1>
          <p className="mt-2 text-muted">Generado desde la línea de comandos.</p>
        </header>
        <Gallery folder={slug} />
      </>
    );
  }

  const { event, run, pieces } = data;
  const style = event.style as StyleChoice | null;
  // El evento pasa a "producing" antes de que arranque la generación en segundo plano
  const running = run?.status === "running" || run?.status === "queued" || event.status === "producing";
  const failed = run?.status === "failed";
  const dateLabel = event.date
    ? new Date(`${event.date}T12:00:00`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <>
      <header className="mb-10 mt-4 flex flex-wrap items-end justify-between gap-6 border-b border-border pb-8">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{event.name}</h1>
          <p className="mt-2 text-muted">
            {[dateLabel, event.location, style && `estilo ${STYLES[style.styleId].name}`, style && `variante ${style.seed}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        {!running && (
          <div className="flex flex-wrap gap-3">
            <form action={newVariantAction.bind(null, event.id)}>
              <button className="btn-line">Otra variante</button>
            </form>
            <form action={rewriteCopyAction.bind(null, event.id)}>
              <button className="btn-line">Reescribir textos</button>
            </form>
          </div>
        )}
      </header>

      {running && (
        <section aria-live="polite" className="taped mb-12 -rotate-[0.4deg] border-[1.5px] border-ink bg-surface p-6 shadow-md">
          <AutoRefresh />
          <p className="mb-5 font-hand text-3xl font-bold leading-none">generando la familia de piezas…</p>
          <GenerationProgress stage={run?.stage ?? null} progress={run?.progress ?? 0} total={run?.total ?? 0} startedAt={run?.createdAt.getTime()} />
        </section>
      )}

      {failed && (
        <section className="mb-12 border-[1.5px] border-orange bg-surface p-6">
          <p className="font-medium">La generación falló</p>
          <p className="mt-2 font-mono text-sm text-muted">{run?.error}</p>
          <form action={rewriteCopyAction.bind(null, event.id)} className="mt-4">
            <button className="btn-ink">Reintentar</button>
          </form>
        </section>
      )}

      {!running && run?.status === "done" && (
        <p className="mb-10 font-hand text-xl leading-snug text-muted">
          {run.stage}
          {event.contentSource === "fallback" && " · Gemini no respondió: se usaron textos base."}
          {event.contentSource === "fallback" && run.error && <span className="mt-1 block font-mono text-xs not-italic">{run.error}</span>}
          {(event.roster as { source?: string } | null)?.source === "mock" && (
            <span className="mt-1 block">Las credenciales y certificados usan una nómina de ejemplo (nombres ficticios).</span>
          )}
        </p>
      )}

      <StudioSection eventId={event.id} pieces={pieces} running={running} />
    </>
  );
}

const GROUP_TITLES: { id: string; title: string }[] = [
  { id: "linkedin", title: "LinkedIn" },
  { id: "cronograma", title: "Cronograma" },
  { id: "credenciales", title: "Credenciales" },
  { id: "certificados", title: "Certificados" },
  { id: "landing", title: "Landing" },
];

type PieceRow = typeof schema.pieces.$inferSelect;

/** Galería seleccionable + chat de edición. */
async function StudioSection({ eventId, pieces, running }: { eventId: string; pieces: PieceRow[]; running: boolean }) {
  if (!pieces.length) return running ? null : <p className="text-muted">Todavía no hay piezas.</p>;
  // Versión de las piezas: cambia cuando termina una regeneración (rompe la caché del navegador)
  const v = Math.max(...pieces.map((p) => p.createdAt.getTime()));
  const label = new Map(pieces.map((p) => [p.file, (p.data as { label?: string }).label ?? p.file!]));
  const groups: StudioGroup[] = await Promise.all(
    GROUP_TITLES.map(async (g) => ({
      ...g,
      pieces: await Promise.all(
        pieces
          .filter((p) => p.file?.startsWith(`${g.id}/`))
          .map(async (p) => {
            const file = p.file!;
            const url = `${storageUrl(`${eventId}/${file}`)}?v=${v}`;
            const kind = (file.split(".").pop() as "png" | "txt" | "html" | "pdf") ?? "png";
            return {
              file,
              url,
              kind,
              label: label.get(file) ?? file,
              text: kind === "txt" ? await readText(`${eventId}/${file}`).catch(() => "") : undefined,
              previewUrl: kind === "html" ? url.replace("index.html", "preview-desktop.png") : undefined,
            };
          }),
      ),
    })),
  );
  const history: StudioHistoryItem[] = (await listChanges(eventId)).map((c) => ({
    id: c.id,
    message: c.message,
    reply: c.reply,
    operations: ((c.operations as EditOperation[] | null) ?? []).map(describeOperation),
    status: c.status,
    pieceLabel: c.pieceFile ? label.get(c.pieceFile) : undefined,
  }));
  return <Studio eventId={eventId} groups={groups.filter((g) => g.pieces.length)} history={history} running={running} />;
}

async function Gallery({ folder }: { folder: string }) {
  const groups = (await listPieces(folder)).filter((g) => g.files.length > 0);
  if (!groups.length) return <p className="text-muted">Todavía no hay piezas.</p>;
  return (
    <div className="space-y-16">
      {groups.map((g) => (
        <section key={g.id}>
          <h2 className="mb-6 flex items-baseline gap-3">
            <span className="boxed text-lg font-semibold">{g.title}</span>
            <span className="label-mono text-muted">{g.files.filter((f) => !f.includes("/preview-")).length} archivos</span>
          </h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {g.files
              .filter((f) => !f.includes("/preview-"))
              .map((f) => (
                <PieceCard key={f} path={f} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

async function PieceCard({ path }: { path: string }) {
  const name = path.split("/").pop()!;
  const url = storageUrl(path);
  let preview: React.ReactNode;
  if (name.endsWith(".png")) {
    // eslint-disable-next-line @next/next/no-img-element
    preview = <img src={url} alt={name} loading="lazy" className="max-h-72 w-auto max-w-full object-contain" />;
  } else if (name.endsWith(".txt")) {
    preview = <pre className="max-h-72 overflow-auto whitespace-pre-wrap p-4 text-left font-sans text-sm leading-relaxed">{await readText(path)}</pre>;
  } else if (name.endsWith(".html")) {
    // eslint-disable-next-line @next/next/no-img-element
    preview = <img src={url.replace("index.html", "preview-desktop.png")} alt="Landing" loading="lazy" className="max-h-72 w-auto max-w-full object-contain object-top" />;
  } else {
    preview = <span className="font-hand text-2xl text-muted">PDF para imprimir</span>;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group block border-[1.5px] border-ink bg-surface p-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[5px_5px_0_var(--yellow)]"
    >
      <div className="flex min-h-48 items-center justify-center overflow-hidden bg-[#ecebe5]">{preview}</div>
      <p className="truncate px-1 pb-1 pt-2.5 font-mono text-xs text-muted group-hover:text-ink">{name}</p>
    </a>
  );
}
