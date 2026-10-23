import { ORPCError } from "@orpc/server";
import { setResidencyVerified } from "@/modules/access/profile";
import {
  decideBusinessClaim,
  decidePhoto,
  decidePlace,
  decideReport,
  ModerationError,
  removeTrafficReport,
} from "@/modules/moderation/decide";
import {
  liveTrafficReports,
  pendingClaims,
  pendingConsultations,
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
    // One procedure, six queues, and only the requested one is read. The empty
    // arrays keep the response shape constant, so the client renders from one
    // type rather than six optional ones.
    .handler(async ({ context, input }) => ({
      places:
        input.queue === "places"
          ? await pendingPlaces(context.viewer, input)
          : [],
      reports:
        input.queue === "reports"
          ? await pendingReports(context.viewer, input)
          : [],
      photos:
        input.queue === "photos"
          ? await pendingPhotos(context.viewer, input)
          : [],
      claims:
        input.queue === "claims"
          ? await pendingClaims(context.viewer, input)
          : [],
      consultations:
        input.queue === "consultations"
          ? await pendingConsultations(context.viewer, input)
          : [],
      traffic:
        input.queue === "traffic"
          ? await liveTrafficReports(context.viewer, input)
          : [],
    })),

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
};
