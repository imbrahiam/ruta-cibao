import { z } from "zod";

/**
 * What a week looked like, as a shape.
 *
 * Validated on the way *out* of the database as well as in. The metrics column
 * is `jsonb`, so a report written by an older version of this job is whatever
 * that version wrote — and a page that renders `undefined` where a number
 * should be is worse than one that says the report could not be read.
 */
export const weeklyMetrics = z.object({
  routes: z
    .object({
      submitted: z.number().int().nonnegative(),
      published: z.number().int().nonnegative(),
    })
    .default({ submitted: 0, published: 0 }),
  places: z.object({
    submitted: z.number().int().nonnegative(),
    published: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
    /** Everything on the map at the end of the week, not just this week's. */
    total: z.number().int().nonnegative(),
  }),
  traffic: z.object({
    reported: z.number().int().nonnegative(),
    cleared: z.number().int().nonnegative(),
    expired: z.number().int().nonnegative(),
    removed: z.number().int().nonnegative(),
  }),
  consultations: z.object({
    opened: z.number().int().nonnegative(),
    answered: z.number().int().nonnegative(),
    resolved: z.number().int().nonnegative(),
    /** Still waiting at the end of the week — the figure that matters most. */
    stillOpen: z.number().int().nonnegative(),
    /** Median hours from opening to first reply, or null if nothing was answered. */
    medianResponseHours: z.number().nullable(),
  }),
  businesses: z.object({
    claimed: z.number().int().nonnegative(),
    approved: z.number().int().nonnegative(),
  }),
  people: z.object({
    /** Accounts that verified a cédula this week. */
    verified: z.number().int().nonnegative(),
    /** Distinct accounts that contributed anything at all. */
    contributors: z.number().int().nonnegative(),
  }),
  /**
   * The busiest categories, so the ayuntamiento can see what the week was
   * about without reading six numbers and doing it themselves.
   */
  topCategories: z.array(
    z.object({
      name: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
});

export type WeeklyMetrics = z.infer<typeof weeklyMetrics>;

export const weeklyReportShape = z.object({
  id: z.string(),
  municipalityId: z.string(),
  municipalityName: z.string(),
  periodStart: z.iso.datetime(),
  periodEnd: z.iso.datetime(),
  status: z.enum(["pending", "ready", "failed"]),
  metrics: weeklyMetrics.nullable(),
  generatedAt: z.iso.datetime().nullable(),
});

export const listReportsInput = z.object({
  municipalityId: z.string().min(1).max(80).optional(),
  limit: z.number().int().min(1).max(26).default(8),
});

export type ListReportsInput = z.infer<typeof listReportsInput>;
