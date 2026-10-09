import { Suspense } from "react";
import Link from "next/link";
import { NavTabs, StaticNavTabs } from "./nav-tabs";

export function AppHeader() {
  return (
    <header className="flex items-stretch gap-4 border-b border-border bg-surface/70 px-3 sm:px-5">
      <nav className="flex items-stretch overflow-x-auto" aria-label="Principal">
        <Link href="/" className="mr-2 flex items-center py-3 pr-3" aria-label="Flock Creative Studio, inicio">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/api/brand/logos/flock-horizontal-color.svg" alt="" className="h-5 w-auto" />
        </Link>
        {/* La pestaña activa depende de la URL: se resuelve en el cliente */}
        <Suspense fallback={<StaticNavTabs />}>
          <NavTabs />
        </Suspense>
      </nav>
    </header>
  );
}
