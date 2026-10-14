import { cn } from "@/lib/utils";

/**
 * Where something stands, said three ways at once: a glyph, a colour and a word.
 *
 * Five tones cover every lifecycle in the app — a case, a contribution, a
 * route — because a resident should learn one vocabulary, not one per screen.
 * The glyphs are drawn here rather than borrowed from the icon set so that they
 * read as a family: the same ring, filled a little more at each step, the way
 * a progress indicator does on paper.
 *
 * - received: an empty ring — it arrived, nobody has picked it up.
 * - review: a half-filled ring — somebody is looking.
 * - progress: a play mark — something is moving.
 * - done: a filled check.
 * - declined: a filled cross, in a muted red.
 * - neutral: a dashed ring — it lapsed or was put away, nobody decided against it.
 */
export type StatusTone =
  | "received"
  | "review"
  | "progress"
  | "done"
  | "declined"
  | "neutral";

/** Every status any list in the app can show, mapped onto the five tones. */
const TONE_BY_STATUS: Record<string, StatusTone> = {
  // Citizen cases.
  open: "received",
  in_review: "review",
  answered: "progress",
  resolved: "done",
  rejected: "declined",
  // Contributions, claims and routes.
  draft: "received",
  pending: "review",
  active: "progress",
  published: "done",
  approved: "done",
  cleared: "done",
  dismissed: "declined",
  removed: "declined",
  archived: "neutral",
  expired: "neutral",
};

export function statusTone(status: string): StatusTone {
  return TONE_BY_STATUS[status] ?? "neutral";
}

const TONE_CLASS: Record<StatusTone, string> = {
  received: "border-stone-300/70 bg-stone-100 text-stone-700",
  review: "border-amber-300/70 bg-amber-50 text-amber-900",
  progress: "border-blue-300/70 bg-blue-50 text-blue-900",
  done: "border-emerald-300/70 bg-emerald-50 text-emerald-900",
  declined: "border-red-300/60 bg-red-50 text-red-900",
  neutral: "border-stone-300/70 bg-stone-50 text-stone-600",
};

/** The glyph's own colour, saturated enough to read at 16px (3:1 or better). */
const GLYPH_COLOR: Record<StatusTone, string> = {
  received: "#78716c",
  review: "#c26a06",
  progress: "#2563eb",
  done: "#059669",
  declined: "#b4483f",
  neutral: "#a8a29e",
};

/** The glyph alone, for timelines and places where the word sits beside it. */
export function StatusGlyph({
  tone,
  className,
}: {
  tone: StatusTone;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className={cn("size-4 shrink-0", className)}
      style={{ color: GLYPH_COLOR[tone] }}
    >
      {tone === "received" && (
        <circle
          cx="8"
          cy="8"
          r="5.75"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      )}
      {tone === "neutral" && (
        <circle
          cx="8"
          cy="8"
          r="5.75"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="2.6 2.4"
        />
      )}
      {tone === "review" && (
        <>
          <circle
            cx="8"
            cy="8"
            r="5.75"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M8 2.25a5.75 5.75 0 0 0 0 11.5Z" fill="currentColor" />
        </>
      )}
      {tone === "progress" && (
        <>
          <circle cx="8" cy="8" r="6.75" fill="currentColor" />
          <path d="M6.6 5.2v5.6L11 8Z" fill="#fff" />
        </>
      )}
      {tone === "done" && (
        <>
          <circle cx="8" cy="8" r="6.75" fill="currentColor" />
          <path
            d="m5.2 8.2 1.9 1.9 3.8-4"
            fill="none"
            stroke="#fff"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {tone === "declined" && (
        <>
          <circle cx="8" cy="8" r="6.75" fill="currentColor" />
          <path
            d="m5.8 5.8 4.4 4.4m0-4.4-4.4 4.4"
            fill="none"
            stroke="#fff"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

export function StatusBadge({
  tone,
  label,
  className,
}: {
  tone: StatusTone;
  /** The word, already translated — the badge never decides what to call a state. */
  label: string;
  className?: string;
}) {
  return (
    <span
      data-tone={tone}
      className={cn(
        "inline-flex h-7 w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border pr-2.5 pl-1.5 font-medium text-sm leading-none",
        TONE_CLASS[tone],
        className,
      )}
    >
      <StatusGlyph tone={tone} />
      {label}
    </span>
  );
}
