import { contrast, ensureContrast, type Devices, type EventKit, type HideableElement, type Layout, type PieceOptions } from "@flock/templates";
import type { PieceAdjust, PieceType } from "./generate";

/** Grupos de piezas para el alcance "este tipo de pieza". */
export type PieceGroup = "linkedin" | "slack" | "agenda" | "badge" | "certificate" | "landing";

export const GROUP_LABEL: Record<PieceGroup, string> = {
  linkedin: "posteos de LinkedIn",
  slack: "mensajes de Slack",
  agenda: "cronograma",
  badge: "credenciales",
  certificate: "certificados",
  landing: "landing",
};

export function groupOf(type: PieceType): PieceGroup {
  if (type === "linkedin" || type === "linkedin-text") return "linkedin";
  if (type === "slack" || type === "slack-text") return "slack";
  if (type === "agenda-slide" || type === "agenda-summary") return "agenda";
  if (type === "badge" || type === "badge-sheet") return "badge";
  return type as PieceGroup;
}

export type ColorRole = "ground" | "ink" | "accent" | "accent2" | "muted";

/** Cambio visual pedido en el editor. Todo es opcional: solo se pisa lo que el parche define. */
export type Patch = {
  colors?: Partial<Record<ColorRole, string>>;
  fonts?: { display?: string; body?: string };
  case?: "upper" | "title" | "lower";
  weight?: number;
  titleScale?: number;
  visualScale?: number;
  hide?: Partial<Record<HideableElement, boolean>>;
  layout?: Layout;
  devices?: Partial<Devices>;
};

/** Cambios guardados de un evento, en cascada: todas las piezas → grupo → pieza. */
export type Overrides = {
  all?: Patch;
  groups?: Partial<Record<PieceGroup, Patch>>;
  pieces?: Record<string, Patch>; // clave: ruta de la pieza, ej. "linkedin/anuncio-square.png"
};

export function mergePatch(base: Patch = {}, next: Patch = {}): Patch {
  return {
    ...base,
    ...next,
    colors: { ...base.colors, ...next.colors },
    fonts: { ...base.fonts, ...next.fonts },
    hide: { ...base.hide, ...next.hide },
    devices: { ...base.devices, ...next.devices },
  };
}

/** Suma un parche en el alcance pedido. */
export function addPatch(o: Overrides, patch: Patch, scope: { kind: "all" } | { kind: "group"; group: PieceGroup } | { kind: "piece"; file: string }): Overrides {
  const next: Overrides = { all: o.all, groups: { ...o.groups }, pieces: { ...o.pieces } };
  if (scope.kind === "all") next.all = mergePatch(o.all, patch);
  else if (scope.kind === "group") next.groups![scope.group] = mergePatch(o.groups?.[scope.group], patch);
  else next.pieces![scope.file] = mergePatch(o.pieces?.[scope.file], patch);
  return next;
}

const isEmpty = (p: Patch) =>
  !Object.keys(p.colors ?? {}).length &&
  !Object.keys(p.fonts ?? {}).length &&
  !Object.keys(p.hide ?? {}).length &&
  p.case === undefined &&
  p.weight === undefined &&
  p.titleScale === undefined &&
  p.visualScale === undefined;

/** Aplica un parche a un kit: devuelve el kit ajustado y las opciones de plantilla. */
export function applyPatch(kit: EventKit, patch: Patch): PieceAdjust {
  const palette = { ...kit.style.palette };
  if (patch.colors) {
    Object.assign(palette, patch.colors);
    if (patch.colors.ground) {
      palette.groundDeep = patch.colors.ground; // fondo nuevo: liso
      palette.scheme = contrast(patch.colors.ground, "#000000") > contrast(patch.colors.ground, "#ffffff") ? "light" : "dark";
      // el texto tiene que seguir leyéndose sobre el fondo nuevo
      if (!patch.colors.ink) palette.ink = ensureContrast(palette.ink, palette.ground, 7);
      if (!patch.colors.muted) palette.muted = ensureContrast(palette.muted, palette.ground, 4.5);
      palette.line = palette.ink;
    }
    if (patch.colors.ink) palette.line = palette.ink = ensureContrast(patch.colors.ink, palette.ground, 4.5);
  }
  const adjusted: EventKit = {
    ...kit,
    style: {
      ...kit.style,
      palette,
      fonts: { ...kit.style.fonts, ...patch.fonts },
      // una fuente pedida a mano no hereda el ajuste de la combinación original
      display: patch.fonts?.display ? undefined : kit.style.display,
      layout: patch.layout ?? kit.style.layout,
      devices: { ...kit.style.devices, ...patch.devices },
      displayOverride: {
        ...kit.style.displayOverride,
        ...(patch.case ? { transform: patch.case === "upper" ? "uppercase" : patch.case === "lower" ? "lowercase" : "none" } : {}),
        ...(patch.weight ? { weight: patch.weight } : {}),
      },
    },
  };
  const hide = Object.entries(patch.hide ?? {})
    .filter(([, hidden]) => hidden)
    .map(([el]) => el as HideableElement);
  const options: PieceOptions = { titleScale: patch.titleScale, visualScale: patch.visualScale, hide };
  return { kit: adjusted, options };
}

/** Función de ajuste para generateFamily a partir de los cambios guardados. */
export function adjustFrom(kit: EventKit, o: Overrides | null | undefined) {
  if (!o) return undefined;
  return ({ file, type }: { file: string; type: PieceType }): PieceAdjust | undefined => {
    const patch = mergePatch(mergePatch(o.all, o.groups?.[groupOf(type)]), o.pieces?.[file]);
    return isEmpty(patch) ? undefined : applyPatch(kit, patch);
  };
}
