import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { AdminSection, AdminTableCard } from "./page-frame";

/*
 * Placeholders for what the desk is about to show. Each one repeats the real
 * content's grid, row heights and column visibility, so the screen does not
 * move when data arrives. They are decorative: `QueryState` wraps them in the
 * one status region that tells assistive technology the page is loading.
 */

const REPEAT = (count: number) => Array.from({ length: count }, (_, i) => i);

/** One labelled value of a card: a small label over a line of text. */
function FactSkeleton({ wide, lines = 1 }: { wide?: boolean; lines?: number }) {
  return (
    <div className={cn("flex flex-col gap-1.5", wide && "sm:col-span-2")}>
      <Skeleton className="h-3.5 w-16" />
      {REPEAT(lines).map((line) => (
        <Skeleton
          key={line}
          className={cn(
            "h-4",
            line === lines - 1 && lines > 1 ? "w-2/3" : "w-full",
          )}
        />
      ))}
    </div>
  );
}

/** One card of a queue: identity, facts (or a picture), and the decision. */
function ItemSkeleton({ detail }: { detail: "facts" | "image" }) {
  return (
    <li
      aria-hidden
      className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_14rem] lg:gap-x-8"
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <Skeleton className="h-5 w-3/5" />
        <Skeleton className="h-5 w-2/5" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        {detail === "image" ? (
          <Skeleton className="h-40 w-64 max-w-full rounded-(--radius-field)" />
        ) : (
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <FactSkeleton />
            <FactSkeleton />
            <FactSkeleton wide lines={2} />
          </div>
        )}
      </div>
      <div className="flex gap-2 lg:flex-col">
        <Skeleton className="h-9 flex-1 pointer-coarse:h-11 lg:flex-none" />
        <Skeleton className="h-9 flex-1 pointer-coarse:h-11 lg:flex-none" />
      </div>
    </li>
  );
}

/** A moderation desk's list: the shared card with a few waiting items. */
export function QueueSkeleton({
  detail = "facts",
  rows = 3,
}: {
  detail?: "facts" | "image";
  rows?: number;
}) {
  return (
    <AdminTableCard>
      <ul className="flex flex-col gap-1">
        {REPEAT(rows).map((row) => (
          <ItemSkeleton key={row} detail={detail} />
        ))}
      </ul>
    </AdminTableCard>
  );
}

type Cell = {
  /** Classes of the cell, for the breakpoints at which the column shows. */
  cell?: string;
  /** Lines in the cell: each is a bar with its own classes. */
  bars: string[];
};

/** Rows for a table whose header is real: the cells' widths and visibility are the table's own. */
export function TableRowsSkeleton({
  rows,
  cells,
  rowClassName,
}: {
  rows: number;
  cells: Cell[];
  rowClassName?: string;
}) {
  return REPEAT(rows).map((row) => (
    <TableRow
      key={row}
      aria-hidden
      className={cn("hover:bg-transparent", rowClassName)}
    >
      {cells.map((cell, index) => (
        <TableCell
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed shape, never reordered
          key={index}
          className={cn("py-1.5", cell.cell)}
        >
          <div className="flex flex-col gap-1">
            {cell.bars.map((bar, line) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed shape, never reordered
              <Skeleton key={line} className={bar} />
            ))}
          </div>
        </TableCell>
      ))}
    </TableRow>
  ));
}

/** A block of a detail page: its heading, then a few lines of text. */
function TextSectionSkeleton({ lines }: { lines: number }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex min-h-8 items-center">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex flex-col gap-2">
        {REPEAT(lines).map((line) => (
          <Skeleton
            key={line}
            className={cn("h-4", line === lines - 1 ? "w-3/5" : "w-full")}
          />
        ))}
      </div>
    </section>
  );
}

/** The title line of a detail page, whose words come with the data. */
function DetailTitleSkeleton({ meta }: { meta?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="flex min-h-9 items-center">
        <Skeleton className="h-8 w-2/3 max-w-md sm:h-9" />
      </div>
      {meta ? <Skeleton className="h-6 w-80 max-w-full" /> : null}
    </div>
  );
}

/** One consultation: body, timeline, reply form, and the aside with its actions. */
export function CaseDetailSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-8">
      <DetailTitleSkeleton meta />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-8">
          <TextSectionSkeleton lines={4} />
          <TextSectionSkeleton lines={3} />
          <section className="flex flex-col gap-3">
            <div className="flex min-h-8 items-center">
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-32 w-full rounded-(--radius-field)" />
            <Skeleton className="h-9 w-24" />
          </section>
        </div>
        <div className="order-first flex flex-col gap-3 lg:order-none lg:border-l lg:pl-8">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    </div>
  );
}

/** One weekly report: the headline row of figures and the blocks under it. */
export function ReportDetailSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-8">
      <DetailTitleSkeleton meta />
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-5 sm:gap-x-0">
        {REPEAT(5).map((cell) => (
          <div
            key={cell}
            className="flex min-w-0 flex-col-reverse justify-end gap-1 sm:border-l sm:px-6 sm:first:border-l-0 sm:first:pl-0"
          >
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-8 w-12" />
          </div>
        ))}
      </div>
      <div className="grid gap-x-12 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
        {REPEAT(6).map((block) => (
          <AdminSection key={block} className="gap-0">
            <div className="flex min-h-8 items-center">
              <Skeleton className="h-4 w-28" />
            </div>
            {REPEAT(block % 3 === 2 ? 5 : 4).map((row) => (
              <div key={row} className="flex h-11 items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-8" />
              </div>
            ))}
          </AdminSection>
        ))}
      </div>
    </div>
  );
}
