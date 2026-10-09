// Números de regla de la plancha de corte (bordes superior e izquierdo), fijos como la grilla del fondo
const CELL = 28;
const COLS = Array.from({ length: 80 }, (_, i) => i);
const ROWS = Array.from({ length: 45 }, (_, i) => i);

export function CuttingMatRulers() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-0 hidden select-none font-mono text-[9px] leading-none text-white/70 sm:block">
      {COLS.map((i) => (
        <span key={`c${i}`} className="absolute top-1.5" style={{ left: i * CELL + 3 }}>
          {i}
        </span>
      ))}
      {ROWS.slice(1).map((i) => (
        <span key={`r${i}`} className="absolute left-1" style={{ top: i * CELL + 3 }}>
          {i}
        </span>
      ))}
      <span className="absolute right-3 top-0.5 bg-desk px-2 py-1 font-sans text-[10px] tracking-wide text-white/85">Tabla de corte · Flock Creative Studio</span>
    </div>
  );
}
