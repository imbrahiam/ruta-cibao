import { ChevronRight } from "lucide-react";
import Image from "next/image";
import type { ComponentType, CSSProperties, ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * One thing in a list you look something up in: a place, a case, a route.
 *
 * The shape every directory on the web converged on, and the one older readers
 * already know from their phone's contacts and settings: a picture on the left,
 * the name in bold, where it is underneath, and what state it is in at the
 * edge. Rows are ruled with hairlines rather than boxed into cards, so six fit
 * on a phone where three cards did, and the whole row is the target — there is
 * no small link inside it to aim for.
 *
 * `badge` sits at the edge on a wide screen and drops under the meta line on a
 * phone, where a long state ("Esperando respuesta") would otherwise squeeze the
 * name into a column one word wide.
 */
export function ListRow({
  href,
  leading,
  title,
  meta,
  badge,
  detail,
  trailing,
  headingLevel = 2,
  className,
}: {
  /** Omitted for a row with nowhere to go; it then draws no chevron. */
  href?: string;
  leading: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  badge?: ReactNode;
  /** Extra lines under the row's text, such as a moderation note. */
  detail?: ReactNode;
  /** Replaces the chevron. Pass `null` for nothing at all. */
  trailing?: ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const body = (
    <>
      {leading}
      <div className="min-w-0 flex-1">
        <Heading className="line-clamp-2 text-pretty font-semibold text-[17px] leading-snug tracking-[-0.01em]">
          {title}
        </Heading>
        {meta && (
          <p className="mt-0.5 truncate text-[15px] text-muted-foreground leading-snug">
            {meta}
          </p>
        )}
        {badge && <div className="mt-2 sm:hidden">{badge}</div>}
        {detail}
      </div>
      {badge && <div className="hidden shrink-0 sm:block">{badge}</div>}
      {trailing === undefined
        ? href && (
            <ChevronRight
              className="size-5 shrink-0 text-muted-foreground/70 transition-transform motion-safe:duration-200 motion-safe:group-hover:translate-x-0.5"
              aria-hidden
            />
          )
        : trailing}
    </>
  );

  const shape = cn(
    "group -mx-2 flex min-h-[76px] items-center gap-3.5 rounded-xl px-2 py-3",
    className,
  );

  if (!href) return <div className={shape}>{body}</div>;

  return (
    <Link
      href={href}
      className={cn(
        shape,
        "transition-colors hover:bg-secondary/70 focus-visible:outline-2 focus-visible:outline-offset-2 active:bg-secondary",
        "motion-safe:transition-[background-color,transform] motion-safe:duration-150 motion-safe:ease-(--ease-out-soft) motion-safe:active:scale-[0.985]",
      )}
    >
      {body}
    </Link>
  );
}

type IconComponent = ComponentType<{
  className?: string;
  style?: CSSProperties;
}>;

/**
 * A category's icon in a circle of its own colour, faintly.
 *
 * The colour stays on the drawing, never on text: several category colours
 * are too light to carry words at AA contrast, and this keeps the tie to the
 * map's pins without asking them to.
 */
export function RowPictogram({
  icon: Icon,
  color,
  className,
}: {
  icon: IconComponent;
  /** A category colour as hex; omitted, the brand green is used. */
  color?: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-12 shrink-0 items-center justify-center rounded-full",
        !color && "bg-accent text-primary",
        className,
      )}
      style={color ? { backgroundColor: `${color}1f`, color } : undefined}
    >
      <Icon className="size-[22px]" />
    </span>
  );
}

/** A 64px photo, or the pictogram when there is none. */
export function RowThumb({
  src,
  alt,
  icon,
  color,
}: {
  src: string | null;
  alt: string;
  icon: IconComponent;
  color?: string;
}) {
  if (!src) {
    return (
      <RowPictogram
        icon={icon}
        color={color}
        className="size-16 rounded-2xl [&_svg]:size-7"
      />
    );
  }
  return (
    <span className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-muted">
      <Image
        src={src}
        alt={alt}
        fill
        sizes="64px"
        className="object-cover"
        unoptimized={!src.startsWith("/")}
      />
    </span>
  );
}

/**
 * The rows before they arrive, at their real height.
 *
 * Same min-height, same rules, same circle on the left: on a slow connection
 * the list holds its place and nothing under the thumb moves when it lands.
 */
export function ListRowSkeleton({
  label,
  rows = 4,
  thumb = false,
}: {
  label: string;
  rows?: number;
  /** A 64px square rather than the 48px circle. */
  thumb?: boolean;
}) {
  return (
    <div role="status" className="ruled">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
          key={index}
          aria-hidden
          className="flex min-h-[76px] items-center gap-3.5 py-3"
        >
          <Skeleton
            className={cn(
              "shrink-0",
              thumb ? "size-16 rounded-2xl" : "size-12 rounded-full",
            )}
          />
          <div className="flex-1 space-y-2.5">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3.5 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
