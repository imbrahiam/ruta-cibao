import { implement, ORPCError, os } from "@orpc/server";
import { contract } from "@ruta/contracts";
import { requireMember, requireModerator } from "@/modules/access/permissions";
import type { AppContext } from "./context";

/**
 * The contract, ready to implement. Every procedure in `routers/` starts from
 * `impl.<namespace>.<procedure>`, so its input, output, errors and route come
 * from `@ruta/contracts` and cannot drift from what clients were promised.
 */
export const impl = implement(contract).$context<AppContext>();

const middleware = os.$context<AppContext>();

/**
 * Requires a signed-in account with a verified phone or email: contributing,
 * opening and supporting cases, claiming a business.
 *
 * `x-expected-user-id` lets a queued offline mutation refuse to run under a
 * different account than the one that created it.
 */
export const member = middleware.middleware(async ({ context, next }) => {
  const viewer = requireMember(await context.getViewer());
  const expectedUserId = context.headers.get("x-expected-user-id");
  if (expectedUserId && expectedUserId !== viewer.userId) {
    throw new ORPCError("UNAUTHORIZED");
  }
  return next({ context: { viewer } });
});

/**
 * Requires moderation authority: publishing a submission, resolving a report.
 *
 * The middleware hands the handler a viewer that already carries the scope, so
 * a procedure can only widen it deliberately rather than by omission.
 */
export const moderator = middleware.middleware(async ({ context, next }) => {
  const viewer = requireModerator(await context.getViewer());
  await context.requireStaffSession();
  return next({ context: { viewer } });
});

/** Requires the province administrator. */
export const admin = middleware.middleware(async ({ context, next }) => {
  const viewer = requireModerator(await context.getViewer());
  if (viewer.profile.staffRole !== "admin") {
    throw new ORPCError("FORBIDDEN", {
      message: "This action is for administrators.",
      data: { reason: "admin_required" },
    });
  }
  await context.requireStaffSession();
  return next({ context: { viewer } });
});
