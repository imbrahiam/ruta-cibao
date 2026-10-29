import { cx } from "@/lib/web/cx";
import styles from "./logo.module.css";

/** A folded field guide: an original web mark, independent of native app assets. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cx(styles.mark, className)}>
      <svg viewBox="0 0 40 40" fill="none" aria-hidden>
        <path d="m7 12 9-4 9 4 8-4v21l-8 4-9-4-9 4V12Z" fill="currentColor" />
        <path d="M16 8v21l9 4V12l-9-4Z" fill="#eac7a6" />
        <path
          d="m10 25 8-7 5 3 7-8"
          stroke="#bc6142"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="29.5" cy="13" r="2.4" fill="#bc6142" />
        <path d="M16 10v17M25 14v16" stroke="#b58f72" strokeOpacity=".35" />
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
