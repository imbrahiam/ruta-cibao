import { ORPCError } from "@orpc/client";

const REASONS = [
  "not_found",
  "own_content",
  "no_author",
  "institutional_author",
  "rate_limited",
] as const;

export type SafetyErrorKey = (typeof REASONS)[number] | "generic";

/**
 * Which `safety.errors.*` sentence explains a failed safety request. The server
 * names its refusals with a stable `data.reason`; anything else (network, a
 * reply this app does not know) gets the generic line.
 */
export function safetyErrorKey(error: unknown): SafetyErrorKey {
  if (!(error instanceof ORPCError)) return "generic";
  const reason = (error.data as { reason?: unknown } | undefined)?.reason;
  return REASONS.find((known) => known === reason) ?? "generic";
}
