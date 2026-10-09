import { Suspense } from "react";
import { brandUrl, getActiveBrandKit, type BrandLogo } from "@/lib/brand";

export default function BrandPage() {
  return (
    <main className="px-5 py-12 sm:px-10">
      <header className="mb-12 border-b border-border pb-8">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Marca</h1>
        <p className="mt-2 max-w-xl text-muted">
          La base que heredan todos los eventos: logos, colores institucionales y reglas. Se edita en{" "}
          <code className="font-mono text-sm">brand/brand.json</code> y se carga con <code className="font-mono text-sm">pnpm db:seed</code>.
        </p>
      </header>

      <Suspense fallback={<p className="text-muted">Cargando brand kit…</p>}>
        <BrandKit />
      </Suspense>
    </main>
  );
}

async function BrandKit() {
  const kit = await getActiveBrandKit();
  if (!kit) {
    return (
      <p className="border-[1.5px] border-ink bg-surface p-6 text-muted">
        No hay un brand kit cargado. Corré <code className="font-mono">pnpm bootstrap</code>.
      </p>
    );
  }

  const { manifest } = kit;
  const colors = Object.entries(manifest.colors).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].startsWith("#"),
  );
  const gradient = (manifest.colors.gradient as Record<string, string> | undefined)?.brand;

  return (
    <div className="space-y-14">
      <p className="text-sm text-muted">
        {manifest.name} · versión {kit.version} · cargada el {kit.createdAt.toLocaleString("es-AR")}
      </p>

      <Section title="Logos">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {manifest.logos.map((logo) => (
            <LogoCard key={logo.id} logo={logo} />
          ))}
        </div>
      </Section>

      <Section title="Colores">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {colors.map(([name, hex]) => (
            <div key={name} className="overflow-hidden border-[1.5px] border-ink">
              <div className="h-20" style={{ background: hex }} />
              <div className="bg-surface p-3">
                <p className="text-sm">{name}</p>
                <p className="font-mono text-xs text-muted">{hex}</p>
              </div>
            </div>
          ))}
          {gradient && (
            <div className="overflow-hidden border-[1.5px] border-ink">
              <div className="h-20" style={{ background: gradient }} />
              <div className="bg-surface p-3">
                <p className="text-sm">gradient.brand</p>
                <p className="font-mono text-xs text-muted">naranja → violeta</p>
              </div>
            </div>
          )}
        </div>
      </Section>

      {manifest.elements && manifest.elements.length > 0 && (
        <Section title="Elementos gráficos">
          <div className="grid gap-4 sm:grid-cols-2">
            {manifest.elements.map((el) => (
              <figure key={el.id} className="overflow-hidden border-[1.5px] border-ink bg-surface">
                <div className="flex h-56 items-center justify-center bg-[#0d0118] p-6">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={brandUrl(el.file)} alt={el.desc} className="max-h-full max-w-full object-contain" />
                </div>
                <figcaption className="p-4">
                  <p className="text-sm">{el.desc}</p>
                  <p className="mt-1 text-xs text-muted">{el.useAs}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </Section>
      )}

      <Section title="Reglas">
        <ul className="space-y-2">
          {manifest.rules.doNot.map((rule) => (
            <li key={rule} className="flex gap-3 text-muted">
              <span className="text-orange">✕</span>
              <span>No {rule}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="boxed mb-6 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function LogoCard({ logo }: { logo: BrandLogo }) {
  const pending = logo.status.startsWith("pendiente");
  const onLight = logo.useOn.startsWith("light");
  return (
    <div className="overflow-hidden border-[1.5px] border-ink">
      <div className={`flex h-40 items-center justify-center p-8 ${onLight ? "bg-white" : "bg-ink"}`}>
        {pending ? (
          <span className="text-sm text-muted">Pendiente</span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brandUrl(logo.file)}
            alt={logo.id}
            className={logo.type === "isotipo" ? "h-20" : "h-12"}
          />
        )}
      </div>
      <div className="border-t-[1.5px] border-ink bg-surface p-4">
        <p className="text-sm">{logo.id}</p>
        <p className="font-mono text-xs text-muted">
          {logo.type} · {logo.color} · fondo {logo.useOn}
        </p>
        <p className={`mt-1 text-xs ${pending ? "text-orange" : "text-muted"}`}>{logo.status}</p>
      </div>
    </div>
  );
}
