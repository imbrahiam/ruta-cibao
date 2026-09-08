import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import type { RetrievedPlace } from "./retrieve";

/**
 * Turning what was found into an answer.
 *
 * Behind a provider boundary, with a deterministic template underneath it. That
 * is not a hedge — it is the deployment story: a municipality that never signs
 * up for an API key still gets a working assistant, because the retrieval is
 * the part that does the real work and the sentence around it can be written by
 * hand. When a key is present, the same retrieved places are handed to Claude
 * and the sentence gets better.
 *
 * Both providers are grounded in exactly the same rows. The model is never
 * asked what it knows about Santiago Rodríguez; it is asked to phrase what the
 * database already returned, and told to say so when that is nothing. A civic
 * map that invents a clinic is worse than one that says it has not been mapped.
 */
export type AnswerChunk = { type: "text"; text: string };

export function isGenerativeAnswerEnabled(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}

const SYSTEM = `Eres el asistente de Ruta Cibao, el mapa ciudadano de la provincia Santiago Rodríguez, República Dominicana.

Reglas, en orden de importancia:
1. Lugares solo del contexto: responde con los lugares que aparecen ahí. Nunca inventes un lugar, una dirección, un teléfono ni un horario.
2. Si preguntan por un lugar y el contexto viene vacío o no responde, dilo con claridad y sugiere que la persona agregue ese lugar al mapa.
3. Charla breve (saludos, gracias, despedidas): responde natural y corto, sin lugares ni tarjetas.
4. Preguntas generales que no son de lugares: responde breve con lo que sabes. No inventes datos locales; si es algo de la provincia que el mapa podría tener, sugiere buscarlo ahí.
5. Escribe en español dominicano, cercano y directo. Tutea.
6. Sé breve: dos o tres oraciones. Las tarjetas de los lugares se muestran debajo de tu respuesta, así que no repitas direcciones ni listas completas.
7. Menciona los lugares por su nombre exacto, tal como aparecen en el contexto.
8. No uses markdown, ni viñetas, ni encabezados. Texto corrido.
9. Sin rayas largas (—); usa comas o puntos. No repitas ni cites la pregunta, responde directo.`;

function contextBlock(places: RetrievedPlace[]): string {
  if (places.length === 0) return "No se encontró ningún lugar en el mapa.";

  return places
    .map((place, index) =>
      [
        `${index + 1}. ${place.name}`,
        `   Categoría: ${place.categoryName}`,
        `   Municipio: ${place.municipalityName}`,
        place.address ? `   Dirección: ${place.address}` : null,
        place.description ? `   Descripción: ${place.description}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}

/**
 * The answer with no API key: real sentences assembled from real rows.
 *
 * Deliberately not a bulleted list — the cards below already are one. This is
 * the connective sentence that says what was found and where.
 */
function templateAnswer(places: RetrievedPlace[]): string {
  if (places.length === 0) {
    return "De eso todavía no hay nada en el mapa. Si conoces el lugar, súbelo con el botón de agregar y un moderador de tu municipio lo revisa para publicarlo.";
  }

  const municipalities = [
    ...new Set(places.map((place) => place.municipalityName)),
  ];
  const where =
    municipalities.length === 1
      ? ` en ${municipalities[0]}`
      : ` en ${municipalities.slice(0, -1).join(", ")} y ${municipalities.at(-1)}`;

  const first = places[0];
  if (!first) return "";

  const lead =
    places.length === 1
      ? `Mira lo que hay${where}: ${first.name}, de ${first.categoryName.toLowerCase()}.`
      : `Mira lo que hay${where}: lo que más se parece a lo que buscas es ${first.name}, de ${first.categoryName.toLowerCase()}.`;

  return `${lead} Toca cualquiera para verlo en el mapa y llegar.`;
}

let client: Anthropic | undefined;

function anthropic(): Anthropic {
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

export type Turn = { role: "user" | "assistant"; content: string };

/**
 * Streams the answer.
 *
 * An async generator rather than a callback, so the route handler owns the
 * transport and this file owns nothing but the words. The model provider
 * yields as it writes; the template provider yields word by word on a short
 * beat, so a deterministic answer still arrives as a stream instead of
 * popping in whole.
 */
export async function* streamAnswer(
  question: string,
  places: RetrievedPlace[],
  history: Turn[] = [],
  canned: string | null = null,
): AsyncGenerator<AnswerChunk> {
  // Charla breve, answered directly in both providers: a greeting needs no
  // generation, no tokens and no wait, and reads the same with or without a
  // key. The route already sent zero places, so no cards render above it.
  if (canned) {
    yield* streamTemplate(canned);
    return;
  }

  if (!isGenerativeAnswerEnabled()) {
    yield* streamTemplate(templateAnswer(places));
    return;
  }

  const stream = anthropic().messages.stream({
    model: "claude-opus-5",
    max_tokens: 1024,
    // The answer is a short paraphrase of rows that were already retrieved;
    // there is nothing here to reason about, and low effort keeps a citizen's
    // question cheap enough that a municipality can leave this switched on.
    output_config: { effort: "low" },
    system: SYSTEM,
    messages: [
      ...history.map((turn) => ({
        role: turn.role,
        content: turn.content,
      })),
      {
        role: "user" as const,
        content: `Pregunta: ${question}\n\nLugares encontrados en el mapa:\n${contextBlock(places)}`,
      },
    ],
  });

  try {
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield { type: "text", text: event.delta.text };
      }
    }

    const final = await stream.finalMessage();
    // A policy decline arrives as a 200 with no usable text, so the reader is
    // handed the deterministic answer rather than an empty bubble.
    if (final.stop_reason === "refusal") {
      yield* streamTemplate(templateAnswer(places));
    }
  } catch (error) {
    console.error("assistant generation failed:", error);
    yield* streamTemplate(templateAnswer(places));
  }
}

/**
 * The pause between the words of a template answer.
 *
 * Long enough to read as writing, short enough that a forty-word answer lands
 * in about a second. The words are already known — this paces the arrival,
 * it does not wait on anything.
 */
const TEMPLATE_WORD_INTERVAL_MS = 24;

async function* streamTemplate(text: string): AsyncGenerator<AnswerChunk> {
  // Split keeping the whitespace, so rejoining the chunks reproduces the
  // answer exactly.
  const words = text.split(/(\s+)/).filter((part) => part.length > 0);
  for (const [index, word] of words.entries()) {
    yield { type: "text", text: word };
    if (index < words.length - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, TEMPLATE_WORD_INTERVAL_MS),
      );
    }
  }
}
