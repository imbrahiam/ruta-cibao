import { ListRowSkeleton } from "@/components/ui-patterns/list-row";

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
  rows = 4,
  thumb = false,
}: {
  label: string;
  rows?: number;
  thumb?: boolean;
}) {
  return <ListRowSkeleton label={label} rows={rows} thumb={thumb} />;
}
