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
 * Composición de las piezas (posteo, cronograma). Es lo que más define cómo se ve una familia:
 *  - "clasico": logo arriba, título abajo, visual en la esquina, caja "hora | título" (el esquema del AI Day)
 *  - "tipografico": la tipografía es la imagen; nombre o número gigante de borde a borde, el visual se le superpone
 *  - "bloques": planos de color grandes con esquinas redondeadas; el texto vive dentro de los bloques
 */
export type Layout = "clasico" | "tipografico" | "bloques";
export const LAYOUTS: Layout[] = ["clasico", "tipografico", "bloques"];

/** Recursos gráficos que acompañan a la composición. */
export type Devices = {
  pills: boolean; // fecha, hashtag y etiquetas en píldoras de color (si no, píldoras de contorno)
  halftone: boolean; // tramas de puntos (semitono) en formas y bloques
};

/** Tratamiento tipográfico de los títulos (lo define el estilo; una combinación de fuentes puede ajustarlo). */
export type DisplayTreatment = { weight: number; transform: "uppercase" | "lowercase" | "none"; tracking: string; stretch: string; leading: number };

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
  layout?: Layout;
  devices?: Devices;
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
    layout: Layout;
    devices: Devices;
    // Ajustes de la combinación de fuentes elegida sobre el tratamiento del estilo
    display?: Partial<DisplayTreatment>;
    // Solo en el estilo "referencia": cómo se armó a partir de la imagen
    reference?: ReferenceStyle;
    // Imagen propia opcional:
    //  - "top": recorte de una pieza existente, anclado al borde superior (ej. la flor del AI Day)
    //  - "blend": visual completo (imagen con fondo) que se funde con el fondo de la pieza
    //  - "object": objeto recortado (fondo transparente, ej. generado con IA), centrado en la zona del visual
    keyVisual?: { file: string; fit?: "top" | "blend" | "object" };
    // Ajustes del tratamiento de títulos pedidos en el editor (pisan los del estilo)
    displayOverride?: { transform?: "uppercase" | "lowercase" | "none"; weight?: number };
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
  email?: string;
  // Cómo confirmó: las credenciales impresas son solo para quienes van presencial
  attendance?: "presencial" | "remoto";
};

// Assets resueltos (data URIs para render final, URLs para previews en la app)
export type ResolvedAssets = {
  logo: string; // la variante que corresponde al esquema del estilo
  logoColor: string; // las dos versiones, para las plantillas diseñadas (eligen según el fondo de cada zona)
  logoWhite: string;
  keyVisual?: string;
  elements?: string[]; // elementos decorativos generados para el estilo (reemplazan a los motivos de código)
  brandPiece: string; // elemento decorativo de marca (SVG)
  fontCss: string;
};

/** Elementos que el editor puede ocultar (el logo no: regla de marca). */
export type HideableElement = "hashtag" | "tagline" | "date" | "visual";

/** Ajustes de una pieza pedidos en el editor conversacional. */
export type PieceOptions = {
  layout?: Layout; // composición pedida en el editor (pisa la del kit)
  titleScale?: number; // 1 = tamaño de la plantilla
  visualScale?: number; // 1 = tamaño de la plantilla
  hide?: HideableElement[];
};

export type RenderContext = { kit: EventKit; assets: ResolvedAssets; options?: PieceOptions };

/** Momento de la comunicación respecto del evento: se viene, está pasando, ya pasó. */
export type Moment = "antes" | "durante" | "despues";
export const MOMENTS: Moment[] = ["antes", "durante", "despues"];
export const MOMENT_LABEL: Record<Moment, string> = { antes: "Se viene", durante: "En vivo", despues: "Después" };

export type LinkedInPost = { id: string; moment?: Moment; headline: string; body?: string; post: string };
/** Mensaje para un canal interno de Slack: imagen + texto. */
export type SlackMessage = { id: string; moment: Moment; headline: string; body?: string; text: string };

/** Momento de un posteo (los eventos anteriores no lo guardaban: se deduce del id). */
export function momentOf(post: { id: string; moment?: Moment }): Moment {
  if (post.moment) return post.moment;
  return ({ agenda: "durante", "en-vivo": "durante", gracias: "despues" } as Record<string, Moment>)[post.id] ?? "antes";
}

export type LandingContent = {
  intro: string;
  highlights: { title: string; text: string }[];
  cta?: { label: string; href: string };
};

export type EventContent = { linkedin: LinkedInPost[]; slack?: SlackMessage[]; landing: LandingContent };
