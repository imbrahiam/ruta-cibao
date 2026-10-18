import { cx } from "@/lib/cx";

/**
 * Waiting, said quietly: three dots that breathe. Not a spinner, and with
 * reduced motion they simply sit there, which still reads as "working".
 */
export function Dots({
  className,
  label,
}: {
  className?: string;
  label: string;
}) {
  return (
    <span
      role="status"
      className={cx("inline-flex items-center gap-1", className)}
    >
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          aria-hidden
          className="size-1.5 rounded-full bg-current opacity-40 motion-safe:animate-[dot_1.1s_ease-in-out_infinite]"
          style={{ animationDelay: `${index * 140}ms` }}
        />
      ))}
    </span>
  );
}

/** Placeholder rows shaped like what is coming, so nothing jumps. */
export function Placeholder({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cx(
        "rounded-card bg-paper-2 motion-safe:animate-[breathe_1.6s_ease-in-out_infinite]",
        className,
      )}
    />
  );
}
