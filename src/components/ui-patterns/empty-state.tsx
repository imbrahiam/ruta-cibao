import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Nothing here yet: a drawing, one sentence, one thing to do about it.
 *
 * The drawings are a few strokes of the brand green over a pale lime fill —
 * inline, so they cost no request on a slow connection and scale with the
 * text. Each says what would be here (a place on a map, a case, a stamp)
 * rather than a generic empty box, so the picture alone hints at the action.
 */
export type EmptyIllustration =
  | "places"
  | "cases"
  | "contributions"
  | "stamps"
  | "routes"
  | "search"
  | "account";

function Drawing({ name }: { name: EmptyIllustration }) {
  const stroke = {
    fill: "none",
    stroke: "var(--primary)",
    strokeWidth: 2.25,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const tint = { fill: "var(--highlight)" };

  return (
    <svg
      viewBox="0 0 120 96"
      aria-hidden
      className="h-24 w-[7.5rem]"
      focusable="false"
    >
      {name === "places" && (
        <>
          <path d="M14 30 42 20l36 12 28-10v50l-28 10-36-12-28 10Z" {...tint} />
          <path
            d="M14 30 42 20l36 12 28-10v50l-28 10-36-12-28 10Z"
            {...stroke}
          />
          <path d="M42 20v50M78 32v50" {...stroke} />
          <path
            d="M60 66s-12-11-12-20a12 12 0 0 1 24 0c0 9-12 20-12 20Z"
            fill="var(--background)"
          />
          <path
            d="M60 66s-12-11-12-20a12 12 0 0 1 24 0c0 9-12 20-12 20Z"
            {...stroke}
          />
          <circle cx="60" cy="46" r="4" {...stroke} />
        </>
      )}
      {name === "search" && (
        <>
          <circle cx="52" cy="44" r="24" {...tint} />
          <circle cx="52" cy="44" r="24" {...stroke} />
          <path d="m70 62 18 18M42 44h20" {...stroke} />
        </>
      )}
      {name === "cases" && (
        <>
          <path
            d="M22 22h62a8 8 0 0 1 8 8v28a8 8 0 0 1-8 8H50l-16 14V66H22a8 8 0 0 1-8-8V30a8 8 0 0 1 8-8Z"
            {...tint}
          />
          <path
            d="M22 22h62a8 8 0 0 1 8 8v28a8 8 0 0 1-8 8H50l-16 14V66H22a8 8 0 0 1-8-8V30a8 8 0 0 1 8-8Z"
            {...stroke}
          />
          <path d="M30 38h44M30 50h28" {...stroke} />
          <circle cx="96" cy="22" r="10" fill="var(--background)" />
          <path d="m91 22 3.5 3.5L101 19" {...stroke} />
          <circle cx="96" cy="22" r="10" {...stroke} />
        </>
      )}
      {name === "contributions" && (
        <>
          <rect x="30" y="14" width="56" height="70" rx="8" {...tint} />
          <rect x="30" y="14" width="56" height="70" rx="8" {...stroke} />
          <path d="M46 14v-2a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v2" {...stroke} />
          <path d="M42 36h32M42 48h32M42 60h18" {...stroke} />
          <circle cx="88" cy="72" r="12" fill="var(--background)" />
          <circle cx="88" cy="72" r="12" {...stroke} />
          <path d="M88 66v12M82 72h12" {...stroke} />
        </>
      )}
      {name === "stamps" && (
        <>
          <rect x="20" y="16" width="54" height="64" rx="4" {...tint} />
          <rect
            x="20"
            y="16"
            width="54"
            height="64"
            rx="4"
            {...stroke}
            strokeDasharray="4 4"
          />
          <path d="m30 62 12-16 8 10 6-6 10 12Z" {...stroke} />
          <circle cx="58" cy="32" r="5" {...stroke} />
          <circle
            cx="84"
            cy="56"
            r="20"
            fill="var(--background)"
            fillOpacity="0.85"
          />
          <circle cx="84" cy="56" r="20" {...stroke} />
          <circle cx="84" cy="56" r="14" {...stroke} strokeDasharray="2 3" />
        </>
      )}
      {name === "routes" && (
        <>
          <path
            d="M10 78c18-6 18-26 38-26s16-20 34-20 18-14 28-16"
            {...tint}
            stroke="var(--highlight)"
            strokeWidth="14"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M10 78c18-6 18-26 38-26s16-20 34-20 18-14 28-16"
            {...stroke}
            strokeDasharray="5 6"
          />
          <circle cx="12" cy="77" r="5" fill="var(--background)" />
          <circle cx="12" cy="77" r="5" {...stroke} />
          <path d="M104 16V4l10 4-10 4" {...stroke} />
        </>
      )}
      {name === "account" && (
        <>
          <circle cx="60" cy="48" r="34" {...tint} />
          <circle cx="60" cy="40" r="12" {...stroke} />
          <path d="M38 72c4-12 12-18 22-18s18 6 22 18" {...stroke} />
          <circle cx="60" cy="48" r="34" {...stroke} />
        </>
      )}
    </svg>
  );
}

export function EmptyState({
  illustration,
  title,
  action,
  className,
}: {
  illustration: EmptyIllustration;
  /** One sentence. */
  title: string;
  /** One action, usually a pill button. */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col items-center gap-4 rounded-2xl bg-secondary px-6 py-10 text-center",
        className,
      )}
    >
      <Drawing name={illustration} />
      <h2 className="max-w-xs text-balance font-semibold text-lg leading-snug">
        {title}
      </h2>
      {action}
    </section>
  );
}
