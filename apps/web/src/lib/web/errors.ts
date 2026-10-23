import { ORPCError } from "@orpc/client";

export type FailureKind =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "invalid"
  | "network"
  | "unknown";

/** What went wrong with an API call, in terms a screen can act on. */
export function failureKind(error: unknown): FailureKind {
  if (error instanceof ORPCError) {
    switch (error.code) {
      case "UNAUTHORIZED":
        return "unauthorized";
      case "FORBIDDEN":
        return "forbidden";
      case "NOT_FOUND":
        return "not_found";
      case "CONFLICT":
        return "conflict";
      case "TOO_MANY_REQUESTS":
        return "rate_limited";
      case "BAD_REQUEST":
      case "UNPROCESSABLE_CONTENT":
        return "invalid";
      default:
        return "unknown";
    }
  }
  if (error instanceof TypeError) return "network";
  return "unknown";
}

/** The machine-readable reason attached to a typed failure, if any. */
export function failureReason(error: unknown): string | null {
  if (!(error instanceof ORPCError)) return null;
  const data: unknown = error.data;
  if (data && typeof data === "object" && "reason" in data) {
    const reason = (data as { reason: unknown }).reason;
    return typeof reason === "string" ? reason : null;
  }
  return null;
}
