import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { AgendaItem, EventContent, EventInfo } from "@flock/templates";
import { z } from "zod";

const ContentSchema = z.object({
  linkedin: z
    .array(
      z.object({
        id: z.enum(["anuncio", "agenda", "gracias"]),
        headline: z.string().describe("Titular de la imagen: 2 a 5 palabras, sin hashtag ni emojis"),
        body: z.string().describe("Bajada de la imagen: una frase de 8 a 18 palabras"),
        post: z.string().describe("Texto completo del posteo de LinkedIn: 400 a 900 caracteres, párrafos cortos, hasta 3 emojis, termina con hashtags"),
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
export type CopyResult = { content: EventContent; source: "gemini" | "fallback"; model?: string; error?: string };

/**
 * Redacta los textos del evento con Gemini (salida estructurada).
 * Prueba los modelos de GEMINI_MODELS en orden; si ninguno responde, usa textos base.
 */
export async function writeEventCopy(input: CopyInput): Promise<CopyResult> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const models = (process.env.GEMINI_MODELS ?? "gemini-3.5-flash,gemini-flash-latest").split(",").map((m) => m.trim()).filter(Boolean);
  if (!apiKey) return { content: fallbackCopy(input), source: "fallback", error: "GOOGLE_API_KEY no configurada" };

  const errors: string[] = [];
  for (const model of models) {
    try {
      const llm = new ChatGoogleGenerativeAI({ model, apiKey, temperature: 0.7, maxRetries: 1 });
      const out = await llm.withStructuredOutput(ContentSchema, { name: "event_copy" }).invoke(prompt(input), {
        signal: AbortSignal.timeout(90_000),
      });
      return { content: toContent(out), source: "gemini", model };
    } catch (err) {
      errors.push(`${model}: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
    }
  }
  return { content: fallbackCopy(input), source: "fallback", error: errors.join(" | ") };
}

function prompt({ event, agenda }: CopyInput) {
  const lang = event.language === "es" ? "español rioplatense (voseo)" : "inglés";
  const agendaText = agenda.length
    ? agenda.map((a) => `- ${a.start}${a.end ? `–${a.end}` : ""} ${a.title}${a.speaker ? ` (${a.speaker})` : ""}`).join("\n")
    : "(sin agenda cargada)";
  return `Sos redactor de comunicación interna de Flock IT, una empresa de tecnología. Escribí los textos de un evento interno para flockers (las personas de Flock).

Idioma: ${lang}. Tono: cercano, entusiasta y profesional; nada de clichés corporativos ni exageraciones.

Datos del evento (no inventes nada que no esté acá: ni speakers, ni cifras, ni premios, ni lugares):
- Nombre: ${event.name}
- Fecha: ${event.date}
- Lugar: ${event.location ?? "a confirmar"}
- Hashtag: ${event.hashtag}
- Frase: ${event.tagline ?? "-"}
- Descripción: ${event.description ?? "-"}
- Agenda:
${agendaText}

Escribí:
1. Tres posteos de LinkedIn, en este orden e id: "anuncio" (save the date / invitación), "agenda" (cómo viene el día${agenda.length ? "" : "; si no hay agenda, contá qué se va a vivir sin inventar horarios"}) y "gracias" (agradecimiento después del evento). Cada uno con titular para la imagen, bajada y el texto del post. Todos terminan con ${event.hashtag} y como mucho otros 2 hashtags.
2. Los textos de la landing: introducción, tres destacados (qué se va a vivir) y el texto del botón.`;
}

function toContent(out: z.infer<typeof ContentSchema>): EventContent {
  return {
    linkedin: out.linkedin.map((p) => ({ id: p.id, headline: p.headline, body: p.body, post: p.post })),
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
          { id: "anuncio", headline: event.name, body: desc, post: `📅 Agendalo: ${event.name}, el ${event.dateLabel}.\n\n${desc}\n\n${event.hashtag}` },
          {
            id: "agenda",
            headline: "Así viene el día",
            body: agenda.length ? `${agenda.length} bloques para vivirlo de punta a punta.` : desc,
            post: `Así viene ${event.name}:\n\n${firstItems || desc}\n\n${event.hashtag}`,
          },
          { id: "gracias", headline: "¡Gracias, flockers!", body: `Gracias por ser parte de ${event.name}.`, post: `💜 ¡Gracias a todos los que hicieron posible ${event.name}!\n\n${event.hashtag}` },
        ]
      : [
          { id: "anuncio", headline: event.name, body: desc, post: `📅 Save the date: ${event.name}, ${event.dateLabel}.\n\n${desc}\n\n${event.hashtag}` },
          {
            id: "agenda",
            headline: "The day at a glance",
            body: agenda.length ? `${agenda.length} sessions from start to finish.` : desc,
            post: `Here's how ${event.name} unfolds:\n\n${firstItems || desc}\n\n${event.hashtag}`,
          },
          { id: "gracias", headline: "Thank you, flockers!", body: `Thanks for being part of ${event.name}.`, post: `💜 Thank you to everyone who made ${event.name} happen!\n\n${event.hashtag}` },
        ],
    landing: {
      intro: desc,
      highlights: [],
      cta: agenda.length ? { label: es ? "Ver cronograma" : "See the agenda", href: "#agenda" } : undefined,
    },
  };
}
