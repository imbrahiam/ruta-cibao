import { Skeleton } from "@/components/ui/skeleton";

/**
 * What a list looks like before it arrives.
 *
 * The shape of the rows rather than a spinner in an empty page: the layout
 * holds its place, so nothing jumps when the content lands, and the screen
 * reads as "loading this" instead of "is anything happening". The label is
 * for screen readers; sighted readers get the shape.
 */
export function ListSkeleton({
  label,
  rows = 3,
}: {
  label: string;
  rows?: number;
}) {
  return (
    <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
          key={index}
          aria-hidden
          className="surface-card flex gap-3 p-5"
        >
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2.5 pt-1">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="mt-4 h-5 w-24 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
