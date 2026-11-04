import { Children, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Inline facts about a record. Never type a `·`, `|` or `—` between values:
 * the separator is drawn here, and empty values are skipped.
 */
export function MetaList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const items = Children.toArray(children).filter((child) => child !== "");
  if (items.length === 0) return null;
  return (
    // The list is pulled left by one gutter and the wrapper clips it, so the
    // separator drawn in front of a line's first item is never visible, even
    // when the facts wrap.
    <div data-slot="meta-list" className="overflow-hidden">
      <ul
        className={cn(
          "-ml-3 flex flex-wrap gap-y-1 text-sm text-muted-foreground",
          className,
        )}
      >
        {items.map((item, index) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: static facts, never reordered
            key={index}
            className="relative flex items-center pl-3 before:absolute before:top-1/2 before:left-1 before:size-1 before:-translate-y-1/2 before:rounded-full before:bg-current before:opacity-40"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A group of label/value rows for a record's aside or a block of detail. */
export function PropertyList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <dl
      data-slot="property-list"
      className={cn("flex flex-col gap-3", className)}
    >
      {children}
    </dl>
  );
}

/** One fact. Renders nothing when there is no value: quiet empties. */
export function PropertyRow({
  label,
  children,
  className,
}: {
  label: string;
  children?: ReactNode;
  className?: string;
}) {
  if (children === null || children === undefined || children === false)
    return null;
  if (children === "") return null;
  return (
    <div
      data-slot="property-row"
      className={cn("flex flex-col gap-0.5", className)}
    >
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm break-words">{children}</dd>
    </div>
  );
}
