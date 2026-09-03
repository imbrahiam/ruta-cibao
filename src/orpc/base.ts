import { os } from "@orpc/server";
import { requireCitizen, requireMember } from "@/modules/access/permissions";
import type { AppContext } from "./context";

/** Root builder. Open to anyone, including signed-out visitors. */
export const pub = os.$context<AppContext>();

/**
 * Requires an account of any tier. A tourist passes: the contest asks the
 * platform to let them discover, review and report traffic without a cédula.
 */
export const memberProcedure = pub.use(async ({ context, next }) => {
  const viewer = requireMember(await context.getViewer());
  return next({ context: { ...context, viewer } });
});

/**
 * Requires a verified cédula: voting, opening a consultation, registering a
 * business. The middleware guarantees the handler cannot receive anything but
 * a citizen, so the check cannot be forgotten in a procedure.
 */
export const citizenProcedure = pub.use(async ({ context, next }) => {
  const viewer = requireCitizen(await context.getViewer());
  return next({ context: { ...context, viewer } });
});
