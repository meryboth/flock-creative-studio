"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Eventos", match: (p: string) => p === "/" || (p.startsWith("/eventos/") && p !== "/eventos/nuevo") },
  { href: "/eventos/nuevo", label: "Nuevo evento", match: (p: string) => p === "/eventos/nuevo" },
  { href: "/marca", label: "Marca", match: (p: string) => p.startsWith("/marca") },
];

/** Pestañas con la sección actual resaltada (depende de la URL: va dentro de un Suspense). */
export function NavTabs() {
  const pathname = usePathname();
  return <TabList active={(match) => match(pathname)} />;
}

/** Las mismas pestañas sin resaltar, para mostrar mientras se resuelve la URL. */
export function StaticNavTabs() {
  return <TabList active={() => false} />;
}

function TabList({ active }: { active: (match: (p: string) => boolean) => boolean }) {
  return (
    <>
      {NAV.map((item) => {
        const on = active(item.match);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={`label-mono flex items-center whitespace-nowrap px-3 transition-colors ${on ? "bg-yellow text-ink" : "text-muted hover:text-ink"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
