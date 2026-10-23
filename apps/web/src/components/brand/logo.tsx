import { BRAND_COLORS, MARK } from "@ruta/shared/brand";
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
        "inline-flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-pine",
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
          stroke={BRAND_COLORS.paper}
          strokeWidth={roadWidth}
          strokeLinecap="round"
        />
        <circle
          cx={start.cx}
          cy={start.cy}
          r={start.r}
          fill={BRAND_COLORS.pine}
          stroke={BRAND_COLORS.paper}
          strokeWidth={roadWidth / 2}
        />
        <path d={pin} fill={BRAND_COLORS.paper} />
        <circle
          cx={pinDot.cx}
          cy={pinDot.cy}
          r={pinDot.r}
          fill={BRAND_COLORS.pine}
        />
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
