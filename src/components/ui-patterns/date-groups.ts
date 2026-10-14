/**
 * Splits a newest-first list into "this week", "this month" and "earlier".
 *
 * Three buckets rather than a header per day: a resident scanning their cases
 * wants to know what is recent, not to read a calendar. Empty buckets are
 * dropped, and order inside each is left as the server sent it.
 */
export type DateGroupKey = "thisWeek" | "thisMonth" | "earlier";

const DAY = 24 * 60 * 60 * 1000;

export function groupByRecency<Item>(
  items: readonly Item[],
  dateOf: (item: Item) => Date | string,
  now: Date,
): { key: DateGroupKey; items: Item[] }[] {
  const groups: Record<DateGroupKey, Item[]> = {
    thisWeek: [],
    thisMonth: [],
    earlier: [],
  };
  for (const item of items) {
    const age = now.getTime() - new Date(dateOf(item)).getTime();
    const key: DateGroupKey =
      age < 7 * DAY ? "thisWeek" : age < 31 * DAY ? "thisMonth" : "earlier";
    groups[key].push(item);
  }
  return (["thisWeek", "thisMonth", "earlier"] as const)
    .filter((key) => groups[key].length > 0)
    .map((key) => ({ key, items: groups[key] }));
}
