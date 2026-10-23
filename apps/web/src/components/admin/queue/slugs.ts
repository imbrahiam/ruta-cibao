import type { ModerationQueueName } from "@ruta/contracts";

/**
 * The queue desks, as URL slugs, and the key each one reads from the API.
 *
 * `routes` is not a moderation queue: pending routes come from `routes.browse`
 * and are decided through `routes.decide`, but a reviewer works them the same
 * way, so they share the desk.
 */
export const QUEUES = {
  places: { api: "places" },
  claims: { api: "claims" },
  photos: { api: "photos" },
  reports: { api: "reports" },
  routes: { api: null },
  traffic: { api: "traffic" },
  "content-reports": { api: "contentReports" },
  consultations: { api: "consultations" },
} as const satisfies Record<string, { api: ModerationQueueName | null }>;

export type QueueSlug = keyof typeof QUEUES;

export const QUEUE_SLUGS = Object.keys(QUEUES) as QueueSlug[];

export function isQueueSlug(value: string): value is QueueSlug {
  return Object.hasOwn(QUEUES, value);
}

/** How many items a desk asks for at once; the contract's ceiling. */
export const QUEUE_LIMIT = 50;
