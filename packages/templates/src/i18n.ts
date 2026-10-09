import type { Language } from "./kit.js";

const STRINGS = {
  es: {
    agenda: "Cronograma",
    certificate: "Certificado",
    ofParticipation: "de participación",
    awardedTo: "Se otorga a",
    forAttending: (event: string) => `por haber participado de ${event}.`,
    date: "Fecha",
    where: "Dónde",
    seeAgenda: "Ver cronograma",
    hoursSuffix: "HS",
  },
  en: {
    agenda: "Agenda",
    certificate: "Certificate",
    ofParticipation: "of participation",
    awardedTo: "Awarded to",
    forAttending: (event: string) => `for taking part in ${event}.`,
    date: "Date",
    where: "Where",
    seeAgenda: "See the agenda",
    hoursSuffix: "",
  },
} satisfies Record<Language, unknown>;

export const t = (lang: Language) => STRINGS[lang];

export function formatLongDate(iso: string, lang: Language) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(lang === "es" ? "es-AR" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function dateLabel(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y.slice(2)}`;
}
