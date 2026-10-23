import { openapi } from "@orpc/openapi";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import {
  BusinessClaimError,
  businessClaimState,
  claimBusiness,
} from "@/modules/businesses/claim-business";
import {
  businessClaimStateOutput,
  claimBusinessInput,
  claimBusinessOutput,
  updateBusinessInput,
} from "@/modules/businesses/contracts";
import { updateBusiness } from "@/modules/businesses/update-business";
import { citizenProcedure, pub } from "../base";

/**
 * Business ownership, as an API.
 *
 * There is no `create` here on purpose. A business is a place, submitted
 * through `places.submit` under a `business` category and moderated like
 * anything else; this router only answers the question the map cannot — whose
 * it is.
 */
function asClaimError(error: unknown): never {
  if (!(error instanceof BusinessClaimError)) throw error;

  switch (error.reason) {
    case "not_found":
      throw new ORPCError("NOT_FOUND", {
        message: "That place does not exist.",
        data: { reason: error.reason },
      });
    case "already_claimed":
    case "already_pending":
    case "already_decided":
      throw new ORPCError("CONFLICT", {
        message: "That business already has a claim on it.",
        data: { reason: error.reason },
      });
    default:
      throw new ORPCError("BAD_REQUEST", {
        message: "That claim cannot be accepted.",
        data: { reason: error.reason },
      });
  }
}

export const businessesRouter = {
  update: citizenProcedure
    .meta(openapi({ method: "PATCH", path: "/places/{placeId}/business" }))
    .input(updateBusinessInput)
    .output(z.object({ status: z.literal("ok") }))
    .handler(({ context, input }) => updateBusiness(context.viewer, input)),
  /**
   * Whether this place can be claimed, is claimed, and by whom.
   *
   * Public, because the answer is mostly public: the contact details of an
   * approved business are printed on its own sign. The only per-caller parts
   * are `mine` and `pending`, and both are derived from the session rather than
   * from anything the caller sends.
   */
  claimState: pub
    .meta(
      openapi({
        method: "GET",
        path: "/places/{placeId}/business",
        summary: "Business ownership for a place",
      }),
    )
    .input(z.object({ placeId: z.uuid() }))
    .output(businessClaimStateOutput)
    .handler(async ({ context, input }) =>
      businessClaimState(context.db, await context.getViewer(), input.placeId),
    ),

  claim: citizenProcedure
    .meta(
      openapi({
        method: "POST",
        path: "/places/{placeId}/business",
        successStatus: 201,
        summary: "Claim a business as yours",
      }),
    )
    .input(claimBusinessInput)
    .output(claimBusinessOutput)
    .handler(({ context, input }) =>
      claimBusiness(context.viewer, input).catch(asClaimError),
    ),
};
