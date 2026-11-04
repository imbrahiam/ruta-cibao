import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "@/lib/web/cx";

/** Nothing here yet, said as an invitation: what this is, and what to do. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center rounded-card bg-paper-2 px-6 py-12 text-center",
        className,
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-card text-ink-2 shadow-ring">
        <Icon strokeWidth={1.5} className="size-5" />
      </span>
      <p className="mt-4 text-[17px] font-medium tracking-[-0.012em] text-ink">
        {title}
      </p>
      {body ? (
        <p className="t-small mt-1.5 max-w-[42ch] text-ink-2">{body}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
