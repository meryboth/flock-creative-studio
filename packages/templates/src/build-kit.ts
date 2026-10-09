import { dateLabel } from "./i18n.js";
import type { EventInfo, EventKit, ReferenceStyle, StyleId } from "./kit.js";
import { DEFAULT_SEEDS, derivePalette, paletteFromReference } from "./palette.js";
import { byVariant, STYLES, styleFromReference } from "./styles.js";

export type KitInput = {
  event: Omit<EventInfo, "dateLabel" | "hashtag"> & { hashtag?: string };
  styleId: StyleId;
  seeds?: { accent: string; accent2?: string };
  seed?: number;
  reference?: ReferenceStyle;
  keyVisual?: { file: string; fit?: "top" | "blend" | "object" };
};

/** Hashtag por defecto a partir del nombre: "AI Day 2026" → #FLOCKAIDAY2026 */
export function defaultHashtag(name: string) {
  const clean = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  return `#${clean.startsWith("FLOCK") ? clean : `FLOCK${clean}`}`;
}

export function buildKit({ event, styleId, seeds, seed = 1, keyVisual, reference }: KitInput): EventKit {
  const fromReference = styleId === "referencia" && reference;
  const style = fromReference ? styleFromReference(reference) : STYLES[styleId];
  // Flock usa siempre los colores institucionales
  const effectiveSeeds = style.customColors && seeds ? seeds : DEFAULT_SEEDS[styleId];
  // La variante rota la composición y la combinación de fuentes del estilo (la referencia mantiene sus fuentes)
  const pair = byVariant(style.fontPairs, seed);
  return {
    event: {
      ...event,
      hashtag: event.hashtag?.trim() || defaultHashtag(event.name),
      dateLabel: dateLabel(event.date),
    },
    style: {
      id: styleId,
      seed,
      palette: fromReference ? paletteFromReference(reference) : derivePalette(styleId, effectiveSeeds),
      fonts: { display: pair.display, body: pair.body },
      layout: byVariant(style.layouts, seed),
      devices: style.devices,
      display: pair.treatment,
      reference: fromReference ? reference : undefined,
      keyVisual,
    },
    logo: { onDark: "horizontal-white", onLight: "horizontal-color" },
  };
}
