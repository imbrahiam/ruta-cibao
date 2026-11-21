import { ORPCError } from "@orpc/server";
import type { ApiOutputs } from "@ruta/contracts";
import { consumeRateLimit, getRequestClientKey } from "@/lib/rate-limit";
import { setResidencyVerified } from "@/modules/access/profile";
import {
  routeOnStreets,
  SnapUnavailableError,
  snapToRoad,
} from "@/modules/maps/snap-road";
import {
  decideBusinessClaim,
  decideContentReport,
  decidePhoto,
  decidePlace,
  decidePublication,
  decideReport,
  ModerationError,
  removeTrafficReport,
} from "@/modules/moderation/decide";
import {
  liveTrafficReports,
  pendingClaims,
  pendingConsultations,
  pendingContentReports,
  pendingPhotos,
  pendingPlaces,
  pendingReports,
  queueCounts,
} from "@/modules/moderation/queue";
import { impl, moderator } from "../base";

/**
 * The moderation surface.
 *
 * Every procedure here is behind the `moderator` middleware, which hands the handler
 * a viewer already carrying the municipalities it may act on — so widening the
 * scope has to be deliberate rather than accidental.
 */
function asOrpcError(error: unknown): never {
  if (error instanceof ModerationError) {
    throw new ORPCError(
      error.reason === "not_found" ? "NOT_FOUND" : "CONFLICT",
      {
        message:
          error.reason === "not_found"
            ? "That item no longer exists."
            : "Somebody else already decided this one.",
        data: { reason: error.reason },
      },
    );
  }
  throw error;
}

export const moderationRouter = {
  /** How much is waiting, for the badge and the empty state. */
  counts: impl.moderation.counts
    .use(moderator)
    .handler(({ context }) => queueCounts(context.viewer)),

  queue: impl.moderation.queue
    .use(moderator)
    // One procedure, seven queues, and only the requested one is read. The empty
    // arrays keep the response shape constant, so the client renders from one
    // type rather than six optional ones.
    .handler(async ({ context, input }) => {
      const read = {
        places: pendingPlaces,
        reports: pendingReports,
        photos: pendingPhotos,
        claims: pendingClaims,
        consultations: pendingConsultations,
        traffic: liveTrafficReports,
        contentReports: pendingContentReports,
      }[input.queue];
      const { items, total } = await read(context.viewer, input);
      return {
        places: [],
        reports: [],
        photos: [],
        claims: [],
        consultations: [],
        traffic: [],
        contentReports: [],
        // The requested queue's page; the other six stay empty.
        [input.queue]: items,
        total,
      } as ApiOutputs["moderation"]["queue"];
    }),

  decidePlace: impl.moderation.decidePlace
    .use(moderator)
    .handler(({ context, input }) =>
      decidePlace(context.viewer, input).catch(asOrpcError),
    ),

  decideReport: impl.moderation.decideReport
    .use(moderator)
    .handler(({ context, input }) =>
      decideReport(context.viewer, input).catch(asOrpcError),
    ),

  decidePhoto: impl.moderation.decidePhoto
    .use(moderator)
    .handler(({ context, input }) =>
      decidePhoto(context.viewer, input).catch(asOrpcError),
    ),

  /** Actions or dismisses a report about content; actioning hides it for everyone. */
  decideContentReport: impl.moderation.decideContentReport
    .use(moderator)
    .handler(({ context, input }) =>
      decideContentReport(context.viewer, input).catch(asOrpcError),
    ),

  /** Publishes or hides a case, or the free text of a traffic report. */
  decidePublication: impl.moderation.decidePublication
    .use(moderator)
    .handler(({ context, input }) =>
      decidePublication(context.viewer, input).catch(asOrpcError),
    ),

  decideClaim: impl.moderation.decideClaim
    .use(moderator)
    .handler(({ context, input }) =>
      decideBusinessClaim(context.viewer, input).catch(asOrpcError),
    ),

  /**
   * Taking a traffic report down.
   *
   * Not a queue decision — the report is already on the map — so the verb is
   * `remove` rather than `decide`, and the note is mandatory: this one always
   * costs the reporter something.
   */
  removeTraffic: impl.moderation.removeTraffic
    .use(moderator)
    .handler(({ context, input }) =>
      removeTrafficReport(context.viewer, input).catch(asOrpcError),
    ),

  /** Idempotent and audited; the service raises its own ORPCErrors. */
  setResidencyVerified: impl.moderation.setResidencyVerified
    .use(moderator)
    .handler(({ context, input }) =>
      setResidencyVerified(context.viewer, input),
    ),

  /** A stretch laid on the provider's road, for the desk's maps. */
  snapRoad: impl.moderation.snapRoad
    .use(moderator)
    .handler(async ({ context, input, errors }) => {
      const allowance = await consumeRateLimit(
        getRequestClientKey(context.headers),
        { scope: "moderation-snap-road", limit: 600, windowMs: 60_000 },
      );
      if (!allowance.allowed) {
        throw errors.TOO_MANY_REQUESTS({ data: { reason: "rate_limited" } });
      }
      try {
        return {
          path:
            input.mode === "trail"
              ? await routeOnStreets(input.path)
              : await snapToRoad(input.path),
        };
      } catch (error) {
        if (error instanceof SnapUnavailableError) {
          throw errors.SERVICE_UNAVAILABLE({ data: { reason: "unavailable" } });
        }
        throw error;
      }
    }),
};
