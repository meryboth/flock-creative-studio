// Event Kit: todo lo que una plantilla necesita saber del evento (ver docs/PROPUESTA_TECNICA.md §10)

export type Language = "es" | "en";

export type StyleId = "iridiscente" | "grilla" | "flock" | "organico" | "referencia";

/** Generador del visual de cada pieza (ver visuals.tsx). */
export type Generator = "orbs" | "grid" | "pieces" | "blobs" | "pixel" | "doodle";

/** Motivos que dibujan los generadores "pixel" y "doodle". */
export type Motif = "flower" | "cloud" | "heart" | "star" | "sparkle" | "squiggle";

/** Textura del fondo de las piezas. */
export type Texture = "none" | "grid" | "dots" | "lines";

/**
 * Estilo derivado de una imagen de referencia (lectura con IA + colores extraídos por código).
 * Combina piezas del catálogo: no inventa fuentes ni visuales, elige y ajusta.
 */
export type ReferenceStyle = {
  description: string; // qué se ve en la referencia
  mood: string[];
  scheme: "dark" | "light";
  colors: { ground: string; ink: string; accent: string; accent2: string; shapes: string[] };
  typography: {
    display: string; // familia del catálogo
    body: string;
    case: "upper" | "title" | "lower";
    weight: "regular" | "bold" | "black";
    width: "condensed" | "normal" | "extended";
  };
  generator: Generator;
  motifs?: Motif[];
  texture?: Texture;
  corners: "sharp" | "soft" | "round";
  ground: "flat" | "gradient";
};

export type Palette = {
  scheme: "dark" | "light";
  ground: string; // fondo principal
  groundDeep: string; // fondo secundario (bordes del degradado, bandas)
  ink: string; // texto principal
  muted: string; // texto secundario (AA sobre ground)
  accent: string;
  accent2: string;
  line: string; // filetes y contornos
  shapes: string[]; // colores para el visual generado
};

export type EventInfo = {
  name: string;
  date: string; // ISO yyyy-mm-dd
  dateLabel: string; // ej. 09.10.26
  location?: string;
  hashtag: string;
  tagline?: string;
  description?: string;
  language: Language;
};

export type EventKit = {
  event: EventInfo;
  style: {
    id: StyleId;
    seed: number;
    palette: Palette;
    fonts: { display: string; body: string };
    // Solo en el estilo "referencia": cómo se armó a partir de la imagen
    reference?: ReferenceStyle;
    // Imagen propia opcional:
    //  - "top": recorte de una pieza existente, anclado al borde superior (ej. la flor del AI Day)
    //  - "blend": visual completo (imagen con fondo) que se funde con el fondo de la pieza
    //  - "object": objeto recortado (fondo transparente, ej. generado con IA), centrado en la zona del visual
    keyVisual?: { file: string; fit?: "top" | "blend" | "object" };
  };
  logo: { onDark: string; onLight: string };
};

export type AgendaItem = {
  start: string;
  end?: string;
  title: string;
  speaker?: string;
  room?: string;
};

export type Attendee = {
  firstName: string;
  lastName: string;
  area?: string;
  role?: string;
};

// Assets resueltos (data URIs para render final, URLs para previews en la app)
export type ResolvedAssets = {
  logo: string; // la variante que corresponde al esquema del estilo
  keyVisual?: string;
  brandPiece: string; // elemento decorativo de marca (SVG)
  fontCss: string;
};

export type RenderContext = { kit: EventKit; assets: ResolvedAssets };

export type LinkedInPost = { id: string; headline: string; body?: string; post: string };

export type LandingContent = {
  intro: string;
  highlights: { title: string; text: string }[];
  cta?: { label: string; href: string };
};

export type EventContent = { linkedin: LinkedInPost[]; landing: LandingContent };
