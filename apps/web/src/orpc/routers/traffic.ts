import { ORPCError } from "@orpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { categories } from "@/db/schema";
import { roadsInView, streetAt } from "@/lib/map/roads";
import { confirmTraffic } from "@/modules/traffic/confirm";
import { activeTrafficReports } from "@/modules/traffic/read";
import { reportTraffic, TrafficError } from "@/modules/traffic/report-traffic";
import { impl, member } from "../base";

/**
 * Traffic, as an API.
 *
 * Reading is open to anyone, including a driver with no account: a blocked road
 * is public safety information and putting a sign-in wall in front of it would
 * be indefensible. Writing needs a member with a verified phone or email —
 * a tourist stuck behind the landslide knows what the far side needs to hear.
 */
function asTrafficError(error: unknown): never {
  if (!(error instanceof TrafficError)) throw error;

  switch (error.reason) {
    case "not_found":
      throw new ORPCError("NOT_FOUND", {
        message: "That report is no longer on the map.",
        data: { reason: error.reason },
      });
    case "rate_limited":
      throw new ORPCError("TOO_MANY_REQUESTS", {
        message: "That is a lot of reports in one hour.",
        data: { reason: error.reason },
      });
    case "duplicate":
    case "own_report":
    case "already_resolved":
      throw new ORPCError("CONFLICT", {
        message: "That report cannot be changed this way.",
        data: { reason: error.reason },
      });
    default:
      throw new ORPCError("BAD_REQUEST", {
        message: "The traffic report is not valid.",
        data: { reason: error.reason },
      });
  }
}

export const trafficRouter = {
  /** The traffic taxonomy, for the report form and the legend. */
  categories: impl.traffic.categories.handler(({ context }) =>
    context.db
      .select({
        id: categories.id,
        name: categories.name,
        icon: categories.icon,
        color: categories.color,
      })
      .from(categories)
      .where(
        and(
          inArray(categories.kind, ["traffic"]),
          eq(categories.isActive, true),
        ),
      )
      .orderBy(categories.sortOrder),
  ),

  active: impl.traffic.active.handler(async ({ context, input }) =>
    activeTrafficReports(context.db, await context.getViewer(), input),
  ),

  detail: impl.traffic.detail.handler(async ({ context, input }) => {
    const [report] = await activeTrafficReports(
      context.db,
      await context.getViewer(),
      input,
    );
    if (!report) throw new ORPCError("NOT_FOUND");
    return report;
  }),

  report: impl.traffic.report
    .use(member)
    .handler(({ context, input, errors }) =>
      reportTraffic(context.viewer, input).catch((error: unknown) => {
        if (
          error instanceof TrafficError &&
          error.reason === "duplicate" &&
          error.existingReportId
        ) {
          throw errors.DUPLICATE_REPORT({
            message: "That report already exists nearby.",
            data: {
              reason: "duplicate",
              existingReportId: error.existingReportId,
            },
          });
        }
        return asTrafficError(error);
      }),
    ),

  /**
   * Which street is under this point.
   *
   * Public, and no longer rate limited. Both of those were true when the
   * geometry came from a public OpenStreetMap service per request; it now comes
   * from this project's own PostGIS, where the question is one indexed
   * nearest-neighbour lookup over a few thousand rows — the same kind of query
   * the public tile endpoint already answers for anybody.
   *
   * Deliberately advisory: `traffic.report` looks the street up again from the
   * coordinate it is given, so nothing that comes back here is trusted on the
   * way into the database.
   */
  streetAt: impl.traffic.streetAt.handler(({ input }) => streetAt(input)),

  /**
   * The roads in view, so the picker can resolve a tap to a road on the phone.
   *
   * A finger lands near a road, not on its centre line, and the map already
   * draws every road there is. Handing the geometry to the client lets it pick
   * the nearest one within a thumb's width instantly, and answer a mouse
   * hovering over a road without a round trip per pixel.
   */
  streetsInView: impl.traffic.streetsInView.handler(async ({ input }) => ({
    streets: await roadsInView(input, input.limit),
  })),

  confirm: impl.traffic.confirm
    .use(member)
    .handler(({ context, input }) =>
      confirmTraffic(context.db, context.viewer, input).catch(asTrafficError),
    ),
};
