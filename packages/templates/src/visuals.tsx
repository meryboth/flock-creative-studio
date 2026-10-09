/** @jsxRuntime automatic @jsxImportSource @flock/templates */
import type { Html } from "./jsx-runtime.js";
import type { Generator, RenderContext } from "./kit.js";
import { DoodleMotif, layoutMotifs, PixelMotif } from "./motifs.js";
import { resolveStyle } from "./styles.js";

// Zona donde vive el visual dentro de la pieza (puede sangrar fuera del lienzo).
// El resto del lienzo queda libre para el texto.
export type Area = { x: number; y: number; w: number; h: number };
export type Canvas = { width: number; height: number };

type VisualProps = { ctx: RenderContext; area: Area; canvas: Canvas; salt: string };

/** Generador pseudoaleatorio con semilla (mulberry32): misma semilla, mismo visual. */
export function rng(seed: number, salt = "") {
  let s = seed >>> 0;
  for (const ch of salt) s = Math.imul(s ^ ch.charCodeAt(0), 2654435761) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const layer = { position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" } as const;

// ─── Iridiscente: esferas de luz desenfocadas ───────────────────────────────

function Orbs({ ctx, area, canvas, salt }: VisualProps) {
  const r = rng(ctx.kit.style.seed, salt);
  const { shapes } = ctx.kit.style.palette;
  const base = Math.min(area.w, area.h);
  const orbs = Array.from({ length: 4 }, (_, i) => {
    const size = base * (0.55 + r() * 0.5);
    return {
      size,
      left: area.x + r() * area.w - size / 2,
      top: area.y + r() * area.h - size / 2,
      color: shapes[i % shapes.length],
      blur: size * (0.18 + r() * 0.12),
      opacity: 0.75 + r() * 0.25,
    };
  });
  // Un eco tenue en la esquina opuesta, para dar profundidad
  const echo = canvas.width * 0.45;
  return (
    <div style={layer}>
      <div
        style={{
          position: "absolute",
          width: echo,
          height: echo,
          left: area.x > canvas.width / 2 ? -echo * 0.35 : canvas.width - echo * 0.65,
          top: canvas.height - echo * 0.55,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${shapes[1]} 0%, transparent 65%)`,
          filter: `blur(${echo * 0.12}px)`,
          opacity: 0.55,
        }}
      />
      {orbs.map((o, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: o.size,
            height: o.size,
            left: o.left,
            top: o.top,
            borderRadius: "50%",
            background: `radial-gradient(circle at 35% 35%, ${o.color} 0%, ${o.color}cc 35%, transparent 70%)`,
            filter: `blur(${o.blur}px)`,
            opacity: o.opacity,
            mixBlendMode: "screen",
          }}
        />
      ))}
    </div>
  );
}

// ─── Grilla: composición constructivista sobre una grilla modular ───────────

function GridShapes({ ctx, area, salt }: VisualProps) {
  const r = rng(ctx.kit.style.seed, salt);
  const { shapes, ground } = ctx.kit.style.palette;
  const rows = area.h > area.w ? 4 : 3;
  const unit = area.h / rows;
  const cols = Math.max(2, Math.round(area.w / unit));
  const pick = () => shapes[Math.floor(r() * shapes.length)];
  const cells: Html[] = [];

  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const x = col * unit;
      const y = row * unit;
      const roll = r();
      const fill = pick();
      const key = `${row}-${col}`;
      const u = unit;
      if (roll < 0.18) continue; // celda vacía: deja respirar la composición
      if (roll < 0.36) cells.push(<rect key={key} x={x} y={y} width={u} height={u} fill={fill} />);
      else if (roll < 0.54) cells.push(<circle key={key} cx={x + u / 2} cy={y + u / 2} r={u / 2} fill={fill} />);
      else if (roll < 0.78) {
        // cuarto de círculo, con el vértice en una esquina de la celda
        const corner = Math.floor(r() * 4);
        const cx = x + (corner % 2) * u;
        const cy = y + Math.floor(corner / 2) * u;
        const sx = corner % 2 ? -1 : 1;
        const sy = corner > 1 ? -1 : 1;
        cells.push(
          <path key={key} d={`M${cx},${cy} L${cx + sx * u},${cy} A${u},${u} 0 0 ${sx * sy > 0 ? 1 : 0} ${cx},${cy + sy * u} Z`} fill={fill} />,
        );
      } else {
        // medio círculo sobre un cuadrado del color del fondo
        const vertical = r() > 0.5;
        cells.push(
          <g key={key}>
            <rect x={x} y={y} width={u} height={u} fill={pick() === fill ? shapes[2] : pick()} />
            <path
              d={
                vertical
                  ? `M${x + u / 2},${y} A${u / 2},${u / 2} 0 0 1 ${x + u / 2},${y + u} Z`
                  : `M${x},${y + u / 2} A${u / 2},${u / 2} 0 0 1 ${x + u},${y + u / 2} Z`
              }
              fill={ground}
            />
          </g>,
        );
      }
    }

  return (
    <div style={layer}>
      <svg
        width={cols * unit}
        height={rows * unit}
        viewBox={`0 0 ${cols * unit} ${rows * unit}`}
        style={{ position: "absolute", left: area.x, top: area.y }}
      >
        {cells}
      </svg>
    </div>
  );
}

// ─── Flock: piezas del isotipo con degradado de marca ───────────────────────

function BrandPieces({ ctx, area, salt }: VisualProps) {
  const r = rng(ctx.kit.style.seed, salt);
  const base = Math.min(area.w, area.h);
  const pieces = [
    { size: base * 1.15, x: area.x + area.w * 0.35, y: area.y - base * 0.25 },
    { size: base * 0.62, x: area.x + area.w * 0.02, y: area.y + area.h * 0.38 },
    { size: base * 0.34, x: area.x + area.w * 0.62, y: area.y + area.h * 0.78 },
  ];
  return (
    <div style={layer}>
      <div
        style={{
          position: "absolute",
          left: area.x,
          top: area.y,
          width: area.w,
          height: area.h,
          background: `radial-gradient(circle at 70% 30%, ${ctx.kit.style.palette.accent2}55 0%, transparent 60%)`,
          filter: `blur(${base * 0.08}px)`,
        }}
      />
      {pieces.map((p, i) => (
        <img
          key={i}
          src={ctx.assets.brandPiece}
          alt=""
          style={{
            position: "absolute",
            width: p.size,
            left: p.x,
            top: p.y,
            transform: `rotate(${Math.round(r() * 360)}deg)`,
            opacity: i === 0 ? 1 : 0.9,
          }}
        />
      ))}
    </div>
  );
}

// ─── Orgánico: formas suaves superpuestas ───────────────────────────────────

function blobPath(r: () => number, cx: number, cy: number, radius: number, points = 8) {
  const pts = Array.from({ length: points }, (_, i) => {
    const angle = (i / points) * Math.PI * 2;
    const rad = radius * (0.72 + r() * 0.5);
    return [cx + Math.cos(angle) * rad, cy + Math.sin(angle) * rad];
  });
  // Catmull-Rom cerrado → curvas Bézier cúbicas
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < points; i++) {
    const p0 = pts[(i - 1 + points) % points];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % points];
    const p3 = pts[(i + 2) % points];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return `${d} Z`;
}

function Blobs({ ctx, area, canvas, salt }: VisualProps) {
  const r = rng(ctx.kit.style.seed, salt);
  const { shapes } = ctx.kit.style.palette;
  const base = Math.min(area.w, area.h);
  const cx = area.x + area.w * 0.6;
  const cy = area.y + area.h * 0.45;
  const blobs = [
    { d: blobPath(r, cx, cy, base * 0.62), fill: shapes[0] },
    { d: blobPath(r, cx - base * 0.18, cy + base * 0.12, base * 0.42), fill: shapes[1] },
    { d: blobPath(r, cx + base * 0.2, cy - base * 0.15, base * 0.28), fill: shapes[2] },
  ];
  const sun = { cx: area.x + area.w * (0.15 + r() * 0.2), cy: area.y + area.h * (0.15 + r() * 0.2), r: base * 0.09 };
  return (
    <div style={layer}>
      <svg width={canvas.width} height={canvas.height} viewBox={`0 0 ${canvas.width} ${canvas.height}`} style={{ position: "absolute", inset: 0 }}>
        {blobs.map((b, i) => (
          <path key={i} d={b.d} fill={b.fill} />
        ))}
        <circle cx={sun.cx} cy={sun.cy} r={sun.r} fill={shapes[3]} />
      </svg>
    </div>
  );
}

// ─── Pixel art y dibujo a mano: motivos elegidos por la referencia ─────────

function PixelArt({ ctx, area, canvas, salt }: VisualProps) {
  const r = rng(ctx.kit.style.seed, salt);
  return (
    <div style={layer}>
      <svg width={canvas.width} height={canvas.height} viewBox={`0 0 ${canvas.width} ${canvas.height}`} style={{ position: "absolute", inset: 0 }} shape-rendering="crispEdges">
        {layoutMotifs(ctx, area, canvas, r).map((m, i) => (
          <PixelMotif motif={m.motif} x={m.x} y={m.y} size={m.size} colors={m.colors} cells={i === 0 ? 24 : 20} />
        ))}
      </svg>
    </div>
  );
}

function Doodles({ ctx, area, canvas, salt }: VisualProps) {
  const r = rng(ctx.kit.style.seed, salt);
  return (
    <div style={layer}>
      <svg width={canvas.width} height={canvas.height} viewBox={`0 0 ${canvas.width} ${canvas.height}`} style={{ position: "absolute", inset: 0 }}>
        {layoutMotifs(ctx, area, canvas, r).map((m) => (
          <DoodleMotif motif={m.motif} x={m.x} y={m.y} size={m.size} color={m.color} rand={r} />
        ))}
      </svg>
    </div>
  );
}

// ─── Elementos generados para el estilo (imágenes) ─────────────────────────

function Elements({ ctx, area, canvas, salt }: VisualProps) {
  const r = rng(ctx.kit.style.seed, salt);
  const images = ctx.assets.elements ?? [];
  // misma ubicación sin superposición que los motivos de código, con las imágenes generadas
  const slots = layoutMotifs(ctx, area, canvas, r);
  return (
    <div style={layer}>
      {slots.map((s, i) => (
        <img
          src={images[i % images.length]}
          alt=""
          style={{ position: "absolute", left: s.x, top: s.y, width: s.size, height: s.size, objectFit: "contain", imageRendering: "pixelated" }}
        />
      ))}
    </div>
  );
}

// ─── Imagen propia (opcional, en cualquier estilo) ──────────────────────────

function KeyVisualImage({ ctx, area }: VisualProps) {
  if (!ctx.assets.keyVisual) return null;
  if (ctx.kit.style.keyVisual?.fit === "object") {
    // Objeto recortado: entra completo en la zona del visual, sin máscara
    return (
      <div style={layer}>
        <img
          src={ctx.assets.keyVisual}
          alt=""
          style={{ position: "absolute", left: area.x, top: Math.max(area.y, 0), width: area.w, height: area.h - Math.max(-area.y, 0), objectFit: "contain" }}
        />
      </div>
    );
  }
  if (ctx.kit.style.keyVisual?.fit === "blend") {
    // Visual completo (ej. generado con IA sobre el color de fondo): centrado en la zona y fundido en los bordes
    const size = Math.max(area.w, area.h);
    return (
      <div style={layer}>
        <img
          src={ctx.assets.keyVisual}
          alt=""
          style={{
            position: "absolute",
            left: area.x + area.w / 2 - size / 2,
            top: area.y + area.h / 2 - size / 2,
            width: size,
            height: size,
            objectFit: "cover",
            maskImage: "radial-gradient(closest-side, #000 62%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(closest-side, #000 62%, transparent 100%)",
          }}
        />
      </div>
    );
  }
  // Recorte de una pieza existente: anclado arriba, donde suele venir cortado
  return (
    <div style={layer}>
      <img src={ctx.assets.keyVisual} alt="" style={{ position: "absolute", left: area.x, top: 0, width: area.w }} />
    </div>
  );
}

const GENERATORS: Record<Generator, (p: VisualProps) => Html | null> = {
  orbs: Orbs,
  grid: GridShapes,
  pieces: BrandPieces,
  blobs: Blobs,
  pixel: PixelArt,
  doodle: Doodles,
};

/** Capa visual de la pieza según el estilo del kit. `salt` varía la composición entre piezas. */
export function Backdrop(props: VisualProps) {
  const Generator = GENERATORS[resolveStyle(props.ctx.kit).generator];
  // Con un key visual propio, el generador no compite con él: solo queda el brillo de las esferas detrás de un objeto
  const fit = props.ctx.kit.style.keyVisual?.fit;
  const generator = resolveStyle(props.ctx.kit).generator;
  const drawGenerator = !fit || fit === "top" || (fit === "object" && generator === "orbs");
  // Elementos generados con IA: reemplazan a los motivos de código. Si además hay un key visual (objeto),
  // la familia alterna: unas piezas llevan el key visual y otras los elementos, según la pieza (salt).
  const elements = Boolean(props.ctx.assets.elements?.length);
  const objectKv = fit === "object" && Boolean(props.ctx.assets.keyVisual);
  const useElements = elements && (!objectKv || rng(props.ctx.kit.style.seed, props.salt)() < 0.5);
  return (
    <>
      {drawGenerator && !useElements && <Generator {...props} />}
      {useElements ? <Elements {...props} /> : <KeyVisualImage {...props} />}
    </>
  );
}
