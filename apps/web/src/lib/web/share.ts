import { createRouterClient, ORPCError } from "@orpc/server";
import { PROVINCE_BOUNDS } from "@ruta/shared/geo";
import { cache } from "react";
import { db } from "@/db";
import type { AppContext } from "@/orpc/context";
import { router } from "@/orpc/router";

/**
 * Reads for the public share pages.
 *
 * These call the same procedures the native app does, in-process and as an
 * anonymous visitor: publication, moderation, expiry and abuse checks stay in
 * one place (the domain modules behind the router) and a share page can never
 * show more than a signed-out request to the API would. Any refusal reads the
 * same as "not there", so a page never hints that something private exists.
 */
const anonymous: AppContext = {
  db,
  requestId: "share-page",
  headers: new Headers(),
  getSession: async () => ({
    session: null,
    viewer: { kind: "anonymous" },
    contact: null,
  }),
  getViewer: async () => ({ kind: "anonymous" }),
  requireStaffSession: async () => {
    throw new ORPCError("UNAUTHORIZED");
  },
};

const client = createRouterClient(router, { context: anonymous });

export const SHARE_KINDS = [
  "place",
  "route",
  "consultation",
  "traffic",
] as const;
export type ShareKind = (typeof SHARE_KINDS)[number];

export function isShareKind(value: string): value is ShareKind {
  return (SHARE_KINDS as readonly string[]).includes(value);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9][a-z0-9-]{0,159}$/;

/** Whether a reference is well formed for its kind, before anything is queried. */
export function isValidRef(kind: ShareKind, ref: string): boolean {
  switch (kind) {
    case "place":
    case "consultation":
      return SLUG.test(ref);
    case "route":
    case "traffic":
      return UUID.test(ref);
  }
}

type Place = Awaited<ReturnType<typeof client.places.detail>>;
type RouteItem = Awaited<ReturnType<typeof client.routes.detail>>;
type Consultation = Awaited<ReturnType<typeof client.consultations.detail>>;
type TrafficReport = Awaited<ReturnType<typeof client.traffic.active>>[number];

export type ShareContent =
  | { kind: "place"; ref: string; data: Place }
  | { kind: "route"; ref: string; data: RouteItem }
  | { kind: "consultation"; ref: string; data: Consultation }
  | { kind: "traffic"; ref: string; data: TrafficReport };

const UNAVAILABLE = new Set(["NOT_FOUND", "UNAUTHORIZED", "FORBIDDEN", "GONE"]);

async function unlessUnavailable<T>(read: Promise<T>): Promise<T | null> {
  try {
    return await read;
  } catch (error) {
    if (error instanceof ORPCError && UNAVAILABLE.has(error.code)) return null;
    throw error;
  }
}

/**
 * The public content behind a share link, or null when there is none:
 * missing, malformed, unpublished, removed, or (for traffic) no longer current.
 * Memoized per request so metadata and the page share one read.
 */
export const loadShare = cache(
  async (kind: string, ref: string): Promise<ShareContent | null> => {
    if (!isShareKind(kind) || !isValidRef(kind, ref)) return null;

    switch (kind) {
      case "place": {
        const data = await unlessUnavailable(
          client.places.detail({ slug: ref }),
        );
        return data && { kind, ref, data };
      }
      case "route": {
        const data = await unlessUnavailable(client.routes.detail({ id: ref }));
        return data?.status === "published" ? { kind, ref, data } : null;
      }
      case "consultation": {
        const data = await unlessUnavailable(
          client.consultations.detail({ slug: ref }),
        );
        return data && { kind, ref, data };
      }
      case "traffic": {
        const [west, south, east, north] = PROVINCE_BOUNDS;
        const reports = await client.traffic.active({
          west,
          south,
          east,
          north,
          limit: 200,
        });
        const data = reports.find((report) => report.id === ref);
        // Only what the live map would still show; an expired or removed
        // report is simply absent here and so is never described as current.
        return data ? { kind, ref, data } : null;
      }
    }
  },
);
