"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Refresca los datos del servidor cada `ms` mientras está montado (ej. durante una generación). */
export function AutoRefresh({ ms = 2000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), ms);
    return () => clearInterval(id);
  }, [router, ms]);
  return null;
}
