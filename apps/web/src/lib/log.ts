/**
 * Structured logs, one JSON object per line.
 *
 * Docker collects stdout, so a log line is also the only durable record after
 * a container is replaced. That makes two things non-negotiable: a machine can
 * parse it, and a field whose name looks personal is never written in clear.
 * The redaction list is deliberately broad. A log is copied into a ticket, a
 * chat and a backup; the cost of a missing field is a truncated stack trace,
 * and the cost of a leaked one is somebody's phone number.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

type Fields = Record<string, unknown>;

const SENSITIVE =
  /(authorization|cookie|password|secret|token|otp|session|phone|email|cedula|cédula|api[-_]?key|encryption)/i;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /^\+?[\d\s().-]{7,}$/;

const MAX_STRING = 2_000;
const MAX_DEPTH = 4;

function scrubString(value: string): string {
  // A field name is not always a warning: `to`, `message` and provider text
  // can carry an address in clear. Redact the shape too, not only the key.
  const withoutEmail = value.replace(EMAIL, "[redacted]");
  const digits = withoutEmail.replace(/\D/g, "");
  if (PHONE.test(withoutEmail) && digits.length >= 10 && digits.length <= 15) {
    return "[redacted]";
  }
  return withoutEmail.length > MAX_STRING
    ? `${withoutEmail.slice(0, MAX_STRING)}…`
    : withoutEmail;
}

function scrub(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[depth]";
  if (typeof value === "string") return scrubString(value);
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => scrub(item, depth + 1));
  }
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(source)) {
      result[key] = SENSITIVE.test(key) ? "[redacted]" : scrub(item, depth + 1);
    }
    return result;
  }
  return value;
}

function write(level: LogLevel, event: string, fields: Fields): void {
  const record = {
    time: new Date().toISOString(),
    level,
    event,
    ...(scrub(fields) as Fields),
  };
  const line = `${JSON.stringify(record)}\n`;
  if (level === "error") process.stderr.write(line);
  else process.stdout.write(line);
}

export function logInfo(event: string, fields: Fields = {}): void {
  write("info", event, fields);
}

export function logWarn(event: string, fields: Fields = {}): void {
  write("warn", event, fields);
}

export function logError(event: string, fields: Fields = {}): void {
  write("error", event, fields);
}

/**
 * The smallest useful shape of an unknown thrown value.
 *
 * Stacks stay in the log because they are the reason it exists. Everything
 * else goes through the same redaction as the fields around it.
 */
export function errorDetails(error: unknown): Fields {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(typeof code === "string" ? { code } : {}),
    };
  }
  return { message: String(error) };
}
