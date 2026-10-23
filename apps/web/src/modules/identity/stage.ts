import type { VerificationStage } from "./contracts";

/**
 * Where somebody is, from what is stored.
 *
 * Pure, so every screen that asks — the verification page, the account card,
 * the prompts on the map — gets the same answer, and the rule is testable
 * without a database.
 */
export function stageOf(
  cedulaStatus: string,
  tier: "visitor" | "citizen",
  latestReviewStatus: "pending" | "approved" | "rejected" | null,
): VerificationStage {
  if (tier === "citizen" && cedulaStatus === "verified") return "verified";
  if (cedulaStatus === "in_review" && latestReviewStatus === "pending") {
    return "review";
  }
  // A cédula on file — found, or still waiting for the registry — and no
  // open request: the photos are what is missing.
  if (
    cedulaStatus === "matched" ||
    cedulaStatus === "pending" ||
    cedulaStatus === "in_review"
  ) {
    return "documents";
  }
  return "cedula";
}

/**
 * "MARÍA ALTAGRACIA PÉREZ DE LOS SANTOS" → "María Altagracia Pérez de los
 * Santos". The registry stores names in capitals; a person is not called that.
 */
export function displayNameFromRegistry(fullName: string): string {
  const lowerWords = new Set(["de", "del", "la", "las", "los", "y"]);
  return fullName
    .trim()
    .toLocaleLowerCase("es")
    .split(/\s+/)
    .map((word, index) =>
      index > 0 && lowerWords.has(word)
        ? word
        : word.charAt(0).toLocaleUpperCase("es") + word.slice(1),
    )
    .join(" ");
}
