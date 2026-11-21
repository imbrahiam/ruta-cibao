import { ORPCError } from "@orpc/server";
import { consumeRateLimit, getRequestClientKey } from "@/lib/rate-limit";
import {
  lookupInvite,
  readReputation,
  redeemInvite,
} from "@/modules/reputation/service";
import { impl, member } from "../base";

/** Codes are short on purpose; bound the guessing instead. */
const REDEEM_ATTEMPTS = {
  scope: "invite-redeem",
  limit: 10,
  windowMs: 15 * 60_000,
};
const LOOKUPS = { scope: "invite-lookup", limit: 60, windowMs: 60_000 };

function tooMany(): never {
  throw new ORPCError("TOO_MANY_REQUESTS", {
    message: "Too many attempts. Try again shortly.",
    data: { reason: "rate_limited" },
  });
}

export const reputationRouter = {
  get: impl.reputation.get
    .use(member)
    .handler(({ context }) => readReputation(context.viewer)),

  redeemInvite: impl.reputation.redeemInvite
    .use(member)
    .handler(async ({ context, input }) => {
      const allowance = await consumeRateLimit(
        `user:${context.viewer.userId}`,
        REDEEM_ATTEMPTS,
      );
      if (!allowance.allowed) tooMany();
      return redeemInvite(context.viewer, input);
    }),

  /** Public, for the invite page. */
  invite: impl.reputation.invite.handler(async ({ context, input }) => {
    const allowance = await consumeRateLimit(
      getRequestClientKey(context.headers),
      LOOKUPS,
    );
    if (!allowance.allowed) tooMany();
    return lookupInvite(input.code);
  }),
};
