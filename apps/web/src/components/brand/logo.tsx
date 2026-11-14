import { BRAND_COLORS, MARK } from "@ruta/shared/brand";
import Image from "next/image";
import { cx } from "@/lib/web/cx";
import styles from "./logo.module.css";

/** Encuentro, using the same geometry and colors as the native app. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cx(styles.mark, className)}>
      <svg
        viewBox={`0 0 ${MARK.viewBox} ${MARK.viewBox}`}
        fill="none"
        aria-hidden
      >
        <rect
          width={MARK.viewBox}
          height={MARK.viewBox}
          fill={BRAND_COLORS.iris}
        />
        <path
          d={MARK.curve}
          stroke={BRAND_COLORS.white}
          strokeWidth={MARK.strokeWidth}
          strokeLinecap="round"
        />
        <circle
          cx={MARK.point.cx}
          cy={MARK.point.cy}
          r={MARK.point.r}
          fill={BRAND_COLORS.white}
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
      <span className={styles.wordmark}>{label}</span>
    </span>
  );
}

/** The road mark (green disc, ink road), as the native apps carry it. Decorative: name it beside it. */
export function RoadMark({
  size = 56,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/brand/mark.svg"
      alt=""
      aria-hidden
      width={size}
      height={size}
      unoptimized
      priority
      className={className}
    />
  );
}
