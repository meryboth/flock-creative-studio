// Trazos "a mano" en SVG para anotaciones (flechas y subrayados), sin emojis ni glifos
export function ArrowDoodle({ className = "", flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg viewBox="0 0 64 40" className={className} style={flip ? { transform: "scaleX(-1)" } : undefined} fill="none" aria-hidden="true">
      <path d="M4 34 C 18 30, 34 22, 52 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M40 8 L 53 7 L 50 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Squiggle({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 12" className={className} fill="none" preserveAspectRatio="none" aria-hidden="true">
      <path d="M2 8 C 14 2, 22 12, 34 6 S 56 2, 68 7 S 92 11, 104 5 S 116 4, 118 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Sparkle({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 2 C 13 9, 15 11, 22 12 C 15 13, 13 15, 12 22 C 11 15, 9 13, 2 12 C 9 11, 11 9, 12 2 Z" fill="currentColor" />
    </svg>
  );
}
