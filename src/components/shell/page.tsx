import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/**
 * The Genesis section rhythm, used by every page: a mono eyebrow, a short
 * headline, one sentence of lede, then the content. Actions sit to the right
 * on a wide screen and under the lede on a phone.
 */
export function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cx(
        "flex flex-col gap-5 pt-6 pb-8 md:flex-row md:items-end md:justify-between md:pt-12 md:pb-10",
        className,
      )}
    >
      <div className="max-w-[640px] animate-rise">
        {eyebrow ? <p className="t-label text-ink-3">{eyebrow}</p> : null}
        <h1 className={cx("t-h2 text-ink", eyebrow ? "mt-3" : null)}>
          {title}
        </h1>
        {lede ? (
          <p className="t-body-lg mt-3 max-w-[60ch] text-ink-2">{lede}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap gap-2 animate-rise">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export function PageBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "container-page pb-[calc(var(--tabbar-h)+40px)] md:pb-24",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 className="t-h3 text-ink">{children}</h2>
      {action}
    </div>
  );
}
