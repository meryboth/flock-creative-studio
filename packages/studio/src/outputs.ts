/** Grupos de piezas que un evento puede generar. Cada evento elige los suyos (se pueden sumar después). */
export type OutputId = "linkedin" | "slack" | "cronograma" | "credenciales" | "certificados" | "landing";

export const OUTPUTS: { id: OutputId; label: string; description: string; default: boolean }[] = [
  { id: "linkedin", label: "Posteos de LinkedIn", description: "Antes, durante y después, en cuadrado y apaisado, con su texto", default: true },
  { id: "slack", label: "Mensajes de Slack", description: "Imagen y mensaje para los canales internos", default: true },
  { id: "cronograma", label: "Cronograma", description: "Una slide por bloque y el resumen (si cargaste la agenda)", default: true },
  { id: "credenciales", label: "Credenciales", description: "Una por persona que va presencial, más hojas A4 para imprimir", default: true },
  { id: "certificados", label: "Certificados", description: "De participación, uno por persona confirmada", default: false },
  { id: "landing", label: "Landing", description: "Página de una sola hoja con la info y el cronograma", default: true },
];

export const OUTPUT_IDS = OUTPUTS.map((o) => o.id);
export const DEFAULT_OUTPUTS = OUTPUTS.filter((o) => o.default).map((o) => o.id);

/** Grupos a generar: los elegidos o, en eventos anteriores a esta opción (null), todos. */
export const outputsOf = (value: unknown): OutputId[] =>
  Array.isArray(value) ? value.filter((v): v is OutputId => OUTPUT_IDS.includes(v)) : OUTPUT_IDS;
