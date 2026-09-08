import { openapi } from "@orpc/openapi";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { categories } from "@/db/schema";
import { roadsInView, streetAt } from "@/lib/map/roads";
import { confirmTraffic } from "@/modules/traffic/confirm";
import {
  activeTrafficInput,
  confirmTrafficInput,
  confirmTrafficOutput,
  reportTrafficInput,
  reportTrafficOutput,
  streetAtInput,
  streetAtOutput,
  streetsInViewInput,
  streetsInViewOutput,
  trafficReportShape,
} from "@/modules/traffic/contracts";
import { activeTrafficReports } from "@/modules/traffic/read";
import { reportTraffic, TrafficError } from "@/modules/traffic/report-traffic";
import { memberProcedure, pub } from "../base";

/**
 * Traffic, as an API.
 *
 * Reading is open to anyone, including a driver with no account: a blocked road
 * is public safety information and putting a sign-in wall in front of it would
 * be indefensible. Writing needs an account of any tier — a visitor stuck
 * behind the landslide knows what the residents on the far side need to hear.
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
  categories: pub
    .meta(
      openapi({
        method: "GET",
        path: "/traffic/categories",
        summary: "Traffic report categories",
      }),
    )
    .output(
      z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          icon: z.string(),
          color: z.string(),
        }),
      ),
    )
    .handler(({ context }) =>
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

  active: pub
    .meta(
      openapi({
        method: "GET",
        path: "/traffic",
        summary: "Traffic reports inside a bounding box",
      }),
    )
    .input(activeTrafficInput)
    .output(z.array(trafficReportShape))
    .handler(async ({ context, input }) =>
      activeTrafficReports(context.db, await context.getViewer(), input),
    ),

  report: memberProcedure
    .meta(
      openapi({
        method: "POST",
        path: "/traffic",
        successStatus: 201,
        summary: "Report something on the road",
      }),
    )
    .input(reportTrafficInput)
    .output(reportTrafficOutput)
    .handler(({ context, input }) =>
      reportTraffic(context.viewer, input).catch(asTrafficError),
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
  streetAt: pub
    .meta(
      openapi({
        method: "POST",
        path: "/traffic/street",
        summary: "The street under a point",
      }),
    )
    .input(streetAtInput)
    .output(streetAtOutput)
    .handler(({ input }) => streetAt(input)),

  /**
   * The roads in view, so the picker can resolve a tap to a road on the phone.
   *
   * A finger lands near a road, not on its centre line, and the map already
   * draws every road there is. Handing the geometry to the client lets it pick
   * the nearest one within a thumb's width instantly, and answer a mouse
   * hovering over a road without a round trip per pixel.
   */
  streetsInView: pub
    .meta(
      openapi({
        method: "GET",
        path: "/traffic/streets",
        summary: "Roads inside a bounding box",
      }),
    )
    .input(streetsInViewInput)
    .output(streetsInViewOutput)
    .handler(async ({ input }) => ({
      streets: await roadsInView(input, input.limit),
    })),

  confirm: memberProcedure
    .meta(
      openapi({
        method: "POST",
        path: "/traffic/{reportId}/confirm",
        summary: "Say a report is still true, or is over",
      }),
    )
    .input(confirmTrafficInput)
    .output(confirmTrafficOutput)
    .handler(({ context, input }) =>
      confirmTraffic(context.db, context.viewer, input).catch(asTrafficError),
    ),
};
