import { openapi } from "@orpc/openapi";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import {
  decideReviewInput,
  IdentityError,
  reviewListInput,
  reviewSummary,
  verificationStatusOutput,
} from "@/modules/identity/contracts";
import {
  countPendingReviews,
  decideReview,
  listReviews,
} from "@/modules/identity/review";
import { verificationStatus } from "@/modules/identity/status";
import { restartCedula } from "@/modules/identity/submit";
import { memberProcedure, moderatorProcedure } from "../base";

/**
 * Verification of residents: the person's status, and the municipality's queue.
 *
 * The photos themselves do not travel through here. Uploading them is a
 * multipart post to `/api/identity/documents`, and a reviewer reads them from
 * `/api/identity/documents/{reviewId}/{kind}` — binary bodies that would only
 * be base64 overhead inside an RPC envelope.
 */
export function asIdentityError(error: unknown): never {
  if (error instanceof IdentityError) {
    const code =
      error.reason === "not_found"
        ? "NOT_FOUND"
        : error.reason === "not_pending" || error.reason === "already_submitted"
          ? "CONFLICT"
          : error.reason === "own_request" || error.reason === "out_of_scope"
            ? "FORBIDDEN"
            : error.reason === "too_many"
              ? "TOO_MANY_REQUESTS"
              : "BAD_REQUEST";
    throw new ORPCError(code, {
      message: "That verification step cannot be completed.",
      data: { reason: error.reason, detail: error.detail ?? null },
    });
  }
  throw error;
}

export const identityRouter = {
  status: memberProcedure
    .meta(
      openapi({
        method: "GET",
        path: "/identity/status",
        summary: "Where the caller stands in becoming a verified resident",
      }),
    )
    .output(verificationStatusOutput)
    .handler(({ context }) => verificationStatus(context.viewer)),

  restart: memberProcedure
    .meta(
      openapi({
        method: "POST",
        path: "/identity/restart",
        summary: "Clear a cédula that matched somebody else's name",
      }),
    )
    .output(z.object({ ok: z.literal(true) }))
    .handler(async ({ context }) => {
      await restartCedula(context.viewer).catch(asIdentityError);
      return { ok: true as const };
    }),

  pendingCount: moderatorProcedure
    .meta(
      openapi({
        method: "GET",
        path: "/identity/reviews/count",
        summary: "Requests waiting for this moderator",
      }),
    )
    .output(z.object({ count: z.number().int() }))
    .handler(async ({ context }) => ({
      count: await countPendingReviews(context.viewer),
    })),

  reviews: moderatorProcedure
    .meta(
      openapi({
        method: "GET",
        path: "/identity/reviews",
        summary: "Verification requests in this moderator's scope",
      }),
    )
    .input(reviewListInput)
    .output(z.array(reviewSummary))
    .handler(({ context, input }) => listReviews(context.viewer, input)),

  decide: moderatorProcedure
    .meta(
      openapi({
        method: "POST",
        path: "/identity/reviews/{reviewId}",
        summary: "Approve or refuse a verification request",
      }),
    )
    .input(decideReviewInput)
    .output(z.object({ status: z.enum(["approved", "rejected"]) }))
    .handler(({ context, input }) =>
      decideReview(context.viewer, input).catch(asIdentityError),
    ),
};
