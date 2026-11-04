import type { ApiOutputs } from "@ruta/contracts";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { orpc } from "@/lib/web/api";
import { QUEUES, type QueueSlug } from "./slugs";

type Entry = { id: string };

/**
 * What a decision does to the list it was made from: take the item out, or
 * change some of its fields while it stays (a consultation that is published
 * is still waiting for an answer; a traffic report whose text was reviewed is
 * still on the map).
 */
export type Effect = {
  queue: QueueSlug;
  id: string;
  /** Fields to overwrite. Omitted means the item leaves the list. */
  patch?: Record<string, unknown>;
};

type Access = {
  key: QueryKey;
  read: (data: unknown) => Entry[] | undefined;
  write: (data: unknown, items: Entry[]) => unknown;
};

/**
 * The order the server lists a queue in, for the two queues where a decision
 * that keeps the item also moves it (reviewed text sinks below the text still
 * waiting). Without it the card would jump when the refetch lands.
 */
type TrafficEntry = Entry & {
  descriptionModerationStatus: string;
  description: string | null;
  createdAt: string;
};
type CaseEntry = Entry & { publicationStatus: string; createdAt: string };

const textWaiting = (item: TrafficEntry) =>
  item.descriptionModerationStatus === "pending" && item.description !== null
    ? 0
    : 1;
const caseWaiting = (item: CaseEntry) =>
  item.publicationStatus === "pending" ? 0 : 1;

const ORDER: Partial<Record<QueueSlug, (a: Entry, b: Entry) => number>> = {
  traffic: (a, b) => {
    const [x, y] = [a as TrafficEntry, b as TrafficEntry];
    return (
      textWaiting(x) - textWaiting(y) || y.createdAt.localeCompare(x.createdAt)
    );
  },
  consultations: (a, b) => {
    const [x, y] = [a as CaseEntry, b as CaseEntry];
    return (
      caseWaiting(x) - caseWaiting(y) || x.createdAt.localeCompare(y.createdAt)
    );
  },
};

/** Where each queue's items live in the cache. */
function access(queue: QueueSlug): Access {
  if (queue === "routes") {
    return {
      key: orpc.routes.browse.key(),
      read: (data) => (data as { items?: Entry[] } | undefined)?.items,
      write: (data, items) => ({ ...(data as object), items }),
    };
  }
  const name = QUEUES[queue].api;
  return {
    key: orpc.moderation.queue.key(),
    read: (data) => (data as Record<string, Entry[]> | undefined)?.[name],
    write: (data, items) => ({ ...(data as object), [name]: items }),
  };
}

/** Move a sidebar count by `delta`, never below zero. Returns how to undo it. */
export function adjustCount(
  client: QueryClient,
  name: keyof ApiOutputs["moderation"]["counts"],
  delta: number,
): () => void {
  if (delta === 0) return () => {};
  const key = orpc.moderation.counts.queryKey();
  const before = client.getQueryData(key);
  if (!before) return () => {};
  const applied = Math.max(0, before[name] + delta) - before[name];
  client.setQueryData(key, { ...before, [name]: before[name] + applied });
  return () =>
    client.setQueryData(key, (now) =>
      now ? { ...now, [name]: Math.max(0, now[name] - applied) } : now,
    );
}

/**
 * Apply a decision to every cached copy of its list, and to the sidebar count.
 * Returns the undo for exactly this change: it puts back only this item (at its
 * old place), so a second decision made meanwhile is not rolled back with it.
 */
export function applyEffect(
  client: QueryClient,
  { queue, id, patch }: Effect,
): () => void {
  const { key, read, write } = access(queue);
  const order = ORDER[queue];
  const arranged = (items: Entry[]) => (order ? items.toSorted(order) : items);
  const undos: Array<() => void> = [];
  let removed = 0;

  for (const [queryKey, data] of client.getQueriesData({ queryKey: key })) {
    const items = read(data);
    const index = items?.findIndex((item) => item.id === id) ?? -1;
    if (!items || index < 0) continue;
    const item = items[index] as Entry & Record<string, unknown>;

    if (patch) {
      const previous = Object.fromEntries(
        Object.keys(patch).map((field) => [field, item[field]]),
      );
      client.setQueryData(
        queryKey,
        write(
          data,
          arranged(
            items.map((entry, at) =>
              at === index ? { ...item, ...patch } : entry,
            ),
          ),
        ),
      );
      undos.push(() => {
        const now = client.getQueryData(queryKey);
        const list = read(now);
        if (!list) return;
        client.setQueryData(
          queryKey,
          write(
            now,
            arranged(
              list.map((entry) =>
                entry.id === id ? { ...entry, ...previous } : entry,
              ),
            ),
          ),
        );
      });
      continue;
    }

    client.setQueryData(
      queryKey,
      write(
        data,
        items.filter((_, at) => at !== index),
      ),
    );
    removed += 1;
    undos.push(() => {
      const now = client.getQueryData(queryKey);
      const list = read(now);
      if (!list || list.some((entry) => entry.id === id)) return;
      const restored = [...list];
      restored.splice(Math.min(index, restored.length), 0, item);
      client.setQueryData(queryKey, write(now, restored));
    });
  }

  const counted = QUEUES[queue].api;
  if (removed > 0 && counted) undos.push(adjustCount(client, counted, -1));

  return () => {
    for (const undo of undos) undo();
  };
}
