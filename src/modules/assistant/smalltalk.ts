/**
 * Charla breve: saludos, gracias, despedidas y "qué sabes hacer".
 *
 * Retrieval runs on every question, and it always finds *something* — a
 * greeting fuzzy-matches a place name through trigrams or lands near one in
 * vector space, and then the template narrates that coincidence as if it were
 * an answer. "Hola" coming back with a hospital card is that failure exactly.
 *
 * So this gate runs before retrieval: when the whole question is small talk,
 * the route sends no places (the frontend renders no cards) and the answer is
 * a short conversational reply instead of a place narration. Deterministic in
 * both providers — a greeting needs no generation, no tokens and no wait, and
 * it reads the same with or without an API key.
 *
 * Matching is deliberately strict: the normalized question must *be* small
 * talk, not merely contain it, and stay short. "Hola, busco un hospital"
 * contains a greeting and is a real search; only a retrieval over it answers
 * anything.
 */
const MAX_SMALL_TALK_LENGTH = 48;

const GREETINGS = new Set([
  "hola",
  "holas",
  "buenas",
  "buenos dias",
  "buenas tardes",
  "buenas noches",
  "saludos",
  "que tal",
  "klk",
  "epa",
  "hey",
  "hi",
  "hello",
]);

const FAREWELLS = new Set(["adios", "hasta luego", "nos vemos", "chao", "bye"]);

const HELP = new Set([
  "ayuda",
  "que puedes hacer",
  "que sabes hacer",
  "como funcionas",
  "quien eres",
  "help",
]);

const REPLIES = {
  greeting:
    "¡Hola! Soy el asistente de Ruta Cibao. Dime lo que necesites con tus palabras: un río para el domingo, atención médica cerca, dónde comer… y te muestro lo que hay en el mapa.",
  thanks: "¡De nada! Si necesitas algo más de la provincia, pregúntame.",
  farewell:
    "¡Nos vemos! Aquí estaré cuando necesites encontrar algo en el mapa.",
  help: "Te ayudo a encontrar lugares de la provincia: dime lo que buscas y te muestro lo que hay en el mapa, con cómo llegar. Y si falta algo, puedes agregarlo desde el botón de más.",
} as const;

/** Lowercase, unaccented, no punctuation, single spaces. */
function normalize(question: string): string {
  return question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The conversational reply when the question is pure small talk, or null
 * when retrieval should handle it.
 */
export function smallTalkReply(question: string): string | null {
  const text = normalize(question);
  if (text.length === 0 || text.length > MAX_SMALL_TALK_LENGTH) return null;

  // Repeated letters ("holaaa") are still a greeting.
  const squashed = text.replace(/(.)\1{2,}/g, "$1");
  if (GREETINGS.has(text) || GREETINGS.has(squashed)) {
    return REPLIES.greeting;
  }
  // A head phrase with a short tail ("muchas gracias por todo") is still the
  // head's intent; a long tail ("gracias, y ¿dónde queda ese hospital?") is a
  // real question that happens to start politely.
  if (
    withShortTail(text, [
      "gracias",
      "muchas gracias",
      "mil gracias",
      "thanks",
      "thank you",
    ])
  ) {
    return REPLIES.thanks;
  }
  if (FAREWELLS.has(text)) {
    return REPLIES.farewell;
  }
  if (HELP.has(text) || withShortTail(text, ["ayuda"])) {
    return REPLIES.help;
  }
  return null;
}

/**
 * Whether the text is a head phrase plus at most a few trailing words.
 *
 * "Muchas gracias por todo" is thanks; "gracias y dónde queda ese hospital"
 * is a follow-up question wearing a greeting.
 */
function withShortTail(text: string, heads: string[]): boolean {
  for (const head of heads) {
    if (text === head) return true;
    if (!text.startsWith(`${head} `)) continue;
    const tailWords = text.slice(head.length + 1).split(" ");
    if (tailWords.length <= 3) return true;
  }
  return false;
}
