"use client";

import { useEffect, useRef, useState } from "react";
import { PixelLoader } from "./processing";

/** Muestra una pieza de tamaño fijo (ej. 1200×1200) escalada al ancho de su contenedor. */
export function PreviewFrame({ src, width, height, title }: { src: string; width: number; height: number; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  // src que ya terminó de cargar: mientras cambia, la vista previa anterior queda atenuada
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const loaded = loadedSrc === src;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div ref={box} className="relative w-full overflow-hidden bg-[#0b0614]" style={{ aspectRatio: `${width} / ${height}` }}>
      {!loaded && (
        <span className="absolute inset-0 z-10 flex items-center justify-center" aria-label="Cargando vista previa">
          <PixelLoader size={22} />
        </span>
      )}
      {scale > 0 && (
        <iframe
          src={src}
          title={title}
          loading="lazy"
          onLoad={() => setLoadedSrc(src)}
          className="pointer-events-none absolute left-0 top-0 origin-top-left border-0 transition-opacity duration-300"
          style={{ width, height, transform: `scale(${scale})`, opacity: loaded ? 1 : 0.35 }}
          tabIndex={-1}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
