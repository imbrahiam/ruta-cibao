import { describe, expect, test } from "bun:test";
import { smallTalkReply } from "@/modules/assistant/smalltalk";

describe("small talk gate", () => {
  test("greetings answer conversationally, in Spanish and English", () => {
    for (const greeting of [
      "Hola",
      "holaaa",
      "¡Hola!",
      "buenas",
      "Buenos días",
      "klk",
      "hi",
      "hello",
    ]) {
      const reply = smallTalkReply(greeting);
      expect(reply).not.toBeNull();
      expect(reply).toMatch(/Hola/);
    }
  });

  test("thanks, farewells and help get their own replies", () => {
    expect(smallTalkReply("gracias")).toMatch(/De nada/);
    expect(smallTalkReply("Muchas gracias por todo")).toMatch(/De nada/);
    expect(smallTalkReply("nos vemos")).toMatch(/Nos vemos/);
    expect(smallTalkReply("¿Quién eres?")).toMatch(/Te ayudo/);
    expect(smallTalkReply("ayuda por favor")).toMatch(/Te ayudo/);
  });

  test("real questions pass through to retrieval", () => {
    expect(smallTalkReply("¿Dónde hay un río?")).toBeNull();
    expect(smallTalkReply("necesito atención médica cerca")).toBeNull();
    expect(smallTalkReply("hospital")).toBeNull();
    // A greeting followed by a search is a search, not small talk.
    expect(smallTalkReply("Hola, busco un hospital en Sabaneta")).toBeNull();
    expect(smallTalkReply("gracias, y ¿dónde queda ese hospital?")).toBeNull();
  });
});
