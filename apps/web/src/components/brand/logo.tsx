import { MARK } from "@ruta/shared/brand";
import { cx } from "@/lib/web/cx";

/**
 * The mark: a winding road that ends at a pin, drawn from the same geometry as
 * the app icon so the web and the native app show one shape.
 */
export function LogoMark({ className }: { className?: string }) {
  const { bounds, road, roadWidth, start, pin, pinDot } = MARK;
  const pad = 40;
  return (
    <span
      aria-hidden
      className={cx(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-ink text-paper",
        className,
      )}
    >
      <svg
        viewBox={`${bounds.x - pad} ${bounds.y - pad} ${bounds.width + pad * 2} ${bounds.height + pad * 2}`}
        className="size-[66%]"
        fill="none"
        aria-hidden
      >
        <path
          d={road}
          stroke="currentColor"
          strokeWidth={roadWidth}
          strokeLinecap="round"
        />
        <circle
          cx={start.cx}
          cy={start.cy}
          r={start.r}
          fill="var(--ink)"
          stroke="currentColor"
          strokeWidth={roadWidth / 2}
        />
        <path d={pin} fill="currentColor" />
        <circle cx={pinDot.cx} cy={pinDot.cy} r={pinDot.r} fill="var(--ink)" />
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
      <span className="font-display text-[19px] leading-none font-medium tracking-[-0.015em] text-ink">
        {label}
      </span>
    </span>
  );
}
