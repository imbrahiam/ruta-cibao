import { cx } from "@/lib/cx";

/**
 * The mark: a road that bends through the valley, from where you are to where
 * you are going. White on an ink tile, the only way Genesis places a logo.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[#121211] dark:shadow-ring",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-[62%]" fill="none" aria-hidden>
        <path
          d="M6.5 18.5c0-3.6 3.4-4.3 5.5-5.9 2.1-1.6 5.5-2.3 5.5-6.1"
          stroke="#fff"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        <circle
          cx="6.5"
          cy="18.5"
          r="2"
          fill="#121211"
          stroke="#fff"
          strokeWidth="1.6"
        />
        <circle cx="17.5" cy="5.5" r="2.4" fill="#fff" />
      </svg>
    </span>
  );
}

export function Logo({
  className,
  label,
}: {
  className?: string;
  label: string;
}) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-[15px] font-medium tracking-[-0.02em] text-ink">
        {label}
      </span>
    </span>
  );
}
