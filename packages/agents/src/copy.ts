import type { AgendaItem, EventContent, EventInfo, Moment } from "@flock/templates";
import { z } from "zod";
import { invokeStructured, providers } from "./llm";
import { loadPrompt } from "./prompts";

const ContentSchema = z.object({
  linkedin: z
    .array(
      z.object({
        id: z.enum(["anuncio", "en-vivo", "gracias"]),
        headline: z.string().describe("Titular de la imagen: 2 a 5 palabras, sin hashtag ni emojis"),
        body: z.string().describe("Bajada de la imagen: una frase de 8 a 18 palabras"),
        post: z.string().describe("Texto completo del posteo de LinkedIn: 400 a 900 caracteres, párrafos cortos, hasta 3 emojis, termina con hashtags"),
      }),
    )
    .length(3),
  slack: z
    .array(
      z.object({
        id: z.enum(["anuncio", "hoy", "gracias"]),
        headline: z.string().describe("Titular de la imagen: 2 a 5 palabras, sin hashtag ni emojis"),
        body: z.string().describe("Bajada de la imagen: una frase de 8 a 18 palabras"),
        text: z.string().describe("Mensaje de Slack: 150 a 450 caracteres, directo, con *negritas* de Slack si suma, hasta 2 emojis, sin hashtags"),
      }),
    )
    .length(3),
  landing: z.object({
    intro: z.string().describe("2 o 3 oraciones que cuentan de qué se trata el evento y por qué ir"),
    highlights: z
      .array(z.object({ title: z.string().describe("1 a 3 palabras"), text: z.string().describe("12 a 24 palabras") }))
      .length(3),
    ctaLabel: z.string().describe("Texto del botón que lleva al cronograma, 2 a 3 palabras"),
  }),
});

export type CopyInput = { event: EventInfo; agenda: AgendaItem[] };
export type CopyResult = { content: EventContent; source: "llm" | "fallback"; model?: string; error?: string };

/**
 * Redacta los textos del evento con el LLM configurado (Claude o Gemini, salida estructurada).
 * Prueba proveedores y modelos en orden; si ninguno responde, usa textos base.
 */
export async function writeEventCopy(input: CopyInput): Promise<CopyResult> {
  if (!providers().length) return { content: fallbackCopy(input), source: "fallback", error: "No hay proveedor de LLM configurado" };
  try {
    const { out, model } = await invokeStructured("text", ContentSchema, prompt(input), { name: "event_copy", temperature: 0.7, timeoutMs: 90_000, prompt: PROMPT() });
    return { content: toContent(out), source: "llm", model };
  } catch (err) {
    return { content: fallbackCopy(input), source: "fallback", error: err instanceof Error ? err.message : String(err) };
  }
}

const PROMPT = () => loadPrompt("copy");

function prompt({ event, agenda }: CopyInput) {
  return PROMPT().render({
    lang: event.language === "es" ? "español rioplatense (voseo)" : "inglés",
    name: event.name,
    date: event.date,
    location: event.location ?? "a confirmar",
    hashtag: event.hashtag,
    tagline: event.tagline ?? "-",
    description: event.description ?? "-",
    agenda: agenda.length
      ? agenda.map((a) => `- ${a.start}${a.end ? `–${a.end}` : ""} ${a.title}${a.speaker ? ` (${a.speaker})` : ""}`).join("\n")
      : "(sin agenda cargada)",
    liveNote: agenda.length ? " (podés nombrar bloques de la agenda)" : ", sin inventar horarios",
  });
}

const LINKEDIN_MOMENT: Record<string, Moment> = { anuncio: "antes", "en-vivo": "durante", gracias: "despues" };
const SLACK_MOMENT: Record<string, Moment> = { anuncio: "antes", hoy: "durante", gracias: "despues" };

function toContent(out: z.infer<typeof ContentSchema>): EventContent {
  return {
    linkedin: out.linkedin.map((p) => ({ id: p.id, moment: LINKEDIN_MOMENT[p.id], headline: p.headline, body: p.body, post: p.post })),
    slack: out.slack.map((m) => ({ id: m.id, moment: SLACK_MOMENT[m.id], headline: m.headline, body: m.body, text: m.text })),
    landing: {
      intro: out.landing.intro,
      highlights: out.landing.highlights,
      cta: { label: out.landing.ctaLabel, href: "#agenda" },
    },
  };
}

/** Textos base, sin IA, armados con los datos del evento. */
export function fallbackCopy({ event, agenda }: CopyInput): EventContent {
  const es = event.language === "es";
  const desc = event.description ?? (es ? `Te esperamos en ${event.name}.` : `Join us at ${event.name}.`);
  const firstItems = agenda.slice(0, 5).map((a) => `${a.start} ${a.title}`).join("\n");
  return {
    linkedin: es
      ? [
          { id: "anuncio", moment: "antes", headline: event.name, body: desc, post: `📅 Agendalo: ${event.name}, el ${event.dateLabel}.\n\n${desc}\n\n${event.hashtag}` },
          {
            id: "en-vivo",
            moment: "durante",
            headline: "Está pasando",
            body: agenda.length ? `${agenda.length} bloques para vivirlo de punta a punta.` : desc,
            post: `Hoy es ${event.name} y así viene el día:\n\n${firstItems || desc}\n\n${event.hashtag}`,
          },
          { id: "gracias", moment: "despues", headline: "¡Gracias, flockers!", body: `Gracias por ser parte de ${event.name}.`, post: `💜 ¡Gracias a todos los que hicieron posible ${event.name}!\n\n${event.hashtag}` },
        ]
      : [
          { id: "anuncio", moment: "antes", headline: event.name, body: desc, post: `📅 Save the date: ${event.name}, ${event.dateLabel}.\n\n${desc}\n\n${event.hashtag}` },
          {
            id: "en-vivo",
            moment: "durante",
            headline: "Happening now",
            body: agenda.length ? `${agenda.length} sessions from start to finish.` : desc,
            post: `${event.name} is happening today:\n\n${firstItems || desc}\n\n${event.hashtag}`,
          },
          { id: "gracias", moment: "despues", headline: "Thank you, flockers!", body: `Thanks for being part of ${event.name}.`, post: `💜 Thank you to everyone who made ${event.name} happen!\n\n${event.hashtag}` },
        ],
    slack: es
      ? [
          { id: "anuncio", moment: "antes", headline: event.name, body: desc, text: `📅 *Agendalo:* ${event.name}, el ${event.dateLabel}${event.location ? ` en ${event.location}` : ""}.\n${desc}` },
          { id: "hoy", moment: "durante", headline: "¡Es hoy!", body: desc, text: `¡Hoy es *${event.name}*!${agenda[0] ? ` Arrancamos a las ${agenda[0].start}.` : ""} Te esperamos.` },
          { id: "gracias", moment: "despues", headline: "¡Gracias, flockers!", body: `Gracias por ser parte de ${event.name}.`, text: `💜 ¡Gracias por sumarte a *${event.name}*!` },
        ]
      : [
          { id: "anuncio", moment: "antes", headline: event.name, body: desc, text: `📅 *Save the date:* ${event.name}, ${event.dateLabel}${event.location ? ` at ${event.location}` : ""}.\n${desc}` },
          { id: "hoy", moment: "durante", headline: "It's today!", body: desc, text: `*${event.name}* is today!${agenda[0] ? ` We start at ${agenda[0].start}.` : ""} See you there.` },
          { id: "gracias", moment: "despues", headline: "Thank you, flockers!", body: `Thanks for being part of ${event.name}.`, text: `💜 Thanks for joining *${event.name}*!` },
        ],
    landing: {
      intro: desc,
      highlights: [],
      cta: agenda.length ? { label: es ? "Ver cronograma" : "See the agenda", href: "#agenda" } : undefined,
    },
  };
}
