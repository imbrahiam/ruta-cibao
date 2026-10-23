import { ORPCError } from "@orpc/server";
import { weeklyMetrics } from "@ruta/contracts";
import { and, desc, eq, inArray } from "drizzle-orm";
import { municipalities, weeklyReports } from "@/db/schema";
import { dispatch } from "@/lib/jobs/dispatch";
import { QUEUES } from "@/lib/jobs/queues";
import { createReadUrl } from "@/lib/storage";
import {
  assertModerates,
  requireModerator,
} from "@/modules/access/permissions";
import { impl, moderator } from "../base";

/**
 * The weekly report, as an API.
 *
 * A weekly report is a working document for the ayuntamiento — it counts what
 * was rejected as well as what was published, and how long the office took to
 * answer — and publishing that to everyone would either make officials stop
 * recording things honestly or turn the figures into a stick. The public
 * version of this is the map itself.
 *
 * So every procedure requires moderation authority, scoped to the municipality
 * the report belongs to. `detail` is the one that carries its check in the
 * handler rather than in middleware, for the reason written above it.
 */
function readableMetrics(value: unknown) {
  const parsed = weeklyMetrics.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export const reportsRouter = {
  list: impl.reports.list.use(moderator).handler(async ({ context, input }) => {
    const scope = context.viewer.scope;

    if (input.municipalityId) {
      assertModerates(context.viewer, input.municipalityId);
    }

    const rows = await context.db
      .select({
        id: weeklyReports.id,
        municipalityId: weeklyReports.municipalityId,
        municipalityName: municipalities.name,
        periodStart: weeklyReports.periodStart,
        periodEnd: weeklyReports.periodEnd,
        status: weeklyReports.status,
        metrics: weeklyReports.metrics,
        generatedAt: weeklyReports.generatedAt,
      })
      .from(weeklyReports)
      .innerJoin(
        municipalities,
        eq(municipalities.id, weeklyReports.municipalityId),
      )
      .where(
        and(
          input.municipalityId
            ? eq(weeklyReports.municipalityId, input.municipalityId)
            : undefined,
          scope === "all"
            ? undefined
            : inArray(weeklyReports.municipalityId, [...scope]),
        ),
      )
      .orderBy(desc(weeklyReports.periodStart))
      .limit(input.limit);

    return rows.map((row) => ({
      ...row,
      metrics: readableMetrics(row.metrics),
      periodStart: row.periodStart.toISOString(),
      periodEnd: row.periodEnd.toISOString(),
      generatedAt: row.generatedAt?.toISOString() ?? null,
    }));
  }),

  /**
   * One report.
   *
   * Public rather than behind `moderator`, with the check inside — which looks
   * like a weakening and is the opposite. The PDF is this same page printed by
   * a headless browser, and that browser has no session; behind the middleware
   * it would render a sign-in screen into the file. So the procedure accepts
   * two ways of being allowed: a moderator scoped to the municipality, or a
   * render token derived from this one report id with the application's key.
   * Anonymous callers with neither get the same 403 they got before.
   */
  detail: impl.reports.detail.handler(async ({ context, input }) => {
    const [row] = await context.db
      .select({
        id: weeklyReports.id,
        municipalityId: weeklyReports.municipalityId,
        municipalityName: municipalities.name,
        periodStart: weeklyReports.periodStart,
        periodEnd: weeklyReports.periodEnd,
        status: weeklyReports.status,
        metrics: weeklyReports.metrics,
        pdfStorageKey: weeklyReports.pdfStorageKey,
        generatedAt: weeklyReports.generatedAt,
      })
      .from(weeklyReports)
      .innerJoin(
        municipalities,
        eq(municipalities.id, weeklyReports.municipalityId),
      )
      .where(eq(weeklyReports.id, input.reportId))
      .limit(1);

    if (!row) {
      throw new ORPCError("NOT_FOUND", {
        message: "That report does not exist.",
      });
    }

    assertModerates(
      requireModerator(await context.getViewer()),
      row.municipalityId,
    );

    return {
      id: row.id,
      municipalityId: row.municipalityId,
      municipalityName: row.municipalityName,
      periodStart: row.periodStart.toISOString(),
      periodEnd: row.periodEnd.toISOString(),
      status: row.status,
      metrics: readableMetrics(row.metrics),
      generatedAt: row.generatedAt?.toISOString() ?? null,
      // Signed per request and short-lived, so a forwarded link stops working
      // rather than becoming a permanent public URL for a working document.
      pdfUrl: row.pdfStorageKey ? await createReadUrl(row.pdfStorageKey) : null,
    };
  }),

  /**
   * Asks for the PDF to be rendered.
   *
   * Queued rather than awaited: rendering holds a headless browser for tens of
   * seconds, and an official who taps "descargar" should get "estamos
   * preparándolo" immediately rather than a request that times out behind
   * Caddy. The answer arrives as the link appearing on the next load.
   */
  render: impl.reports.render
    .use(moderator)
    .handler(async ({ context, input }) => {
      const [row] = await context.db
        .select({ municipalityId: weeklyReports.municipalityId })
        .from(weeklyReports)
        .where(eq(weeklyReports.id, input.reportId))
        .limit(1);

      if (!row) {
        throw new ORPCError("NOT_FOUND", {
          message: "That report does not exist.",
        });
      }

      assertModerates(context.viewer, row.municipalityId);

      const queued = await dispatch(
        QUEUES.reportsRender,
        { reportId: input.reportId },
        // Two officials tapping within a minute is one render.
        { singletonKey: `render:${input.reportId}`, singletonSeconds: 120 },
      );

      return { queued };
    }),
};
