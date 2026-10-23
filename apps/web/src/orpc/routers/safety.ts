import { ORPCError } from "@orpc/server";
import {
  blockAuthor,
  hiddenTargets,
  listBlocks,
  reportContent,
  SafetyError,
  unblockAuthor,
} from "@/modules/safety/service";
import { impl, member } from "../base";

/**
 * Reporting content and hiding authors, as an API.
 *
 * Verified-contact members only. Each reason below is stable: the app maps it to
 * its Spanish explanation in `safety.errors`.
 */
function asSafetyError(error: unknown): never {
  if (!(error instanceof SafetyError)) throw error;

  switch (error.reason) {
    case "not_found":
      throw new ORPCError("NOT_FOUND", {
        message: "That content is not available.",
        data: { reason: error.reason },
      });
    case "rate_limited":
      throw new ORPCError("TOO_MANY_REQUESTS", {
        message: "Too many actions in a short time.",
        data: { reason: error.reason },
      });
    default:
      throw new ORPCError("BAD_REQUEST", {
        message: "That action is not possible on this content.",
        data: { reason: error.reason },
      });
  }
}

export const safetyRouter = {
  report: impl.safety.report
    .use(member)
    .handler(({ context, input }) =>
      reportContent(context.viewer, input).catch(asSafetyError),
    ),

  blockAuthor: impl.safety.blockAuthor
    .use(member)
    .handler(({ context, input }) =>
      blockAuthor(context.viewer, input).catch(asSafetyError),
    ),

  blocks: impl.safety.blocks
    .use(member)
    .handler(({ context }) => listBlocks(context.viewer)),

  unblock: impl.safety.unblock
    .use(member)
    .handler(({ context, input }) => unblockAuthor(context.viewer, input)),

  hiddenTargets: impl.safety.hiddenTargets
    .use(member)
    .handler(({ context, input }) =>
      hiddenTargets(context.viewer, input).catch(asSafetyError),
    ),
};
