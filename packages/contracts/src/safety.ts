import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { z } from "zod";

export const contentTarget = z.object({
  kind: z.enum(["place", "photo", "route", "traffic", "consultation"]),
  ref: z.string().min(1).max(200),
});
export type ContentTarget = z.infer<typeof contentTarget>;
export const reportContentInput = z.object({
  requestId: z.uuid(),
  target: contentTarget,
  reason: z.enum(["abuse", "personal_information", "unsafe", "other"]),
  details: z.string().trim().max(500).optional(),
});
export const blockAuthorInput = z.object({
  requestId: z.uuid(),
  target: contentTarget,
});
export const unblockAuthorInput = z.object({
  requestId: z.uuid(),
  blockId: z.uuid(),
});
export const hiddenTargetsInput = z
  .object({
    cursor: z.string().min(1).max(500).optional(),
    limit: z.number().int().min(1).max(250).default(100),
  })
  .default({ limit: 100 });
export type ReportContentInput = z.infer<typeof reportContentInput>;
export type BlockAuthorInput = z.infer<typeof blockAuthorInput>;
export type UnblockAuthorInput = z.infer<typeof unblockAuthorInput>;
export type HiddenTargetsInput = z.infer<typeof hiddenTargetsInput>;

export const safetyContract = {
  report: oc
    .meta(
      openapi({
        method: "POST",
        path: "/safety/reports",
        summary: "Report harmful content for municipal review",
      }),
    )
    .input(reportContentInput)
    .output(z.object({ id: z.uuid(), status: z.literal("open") })),
  blockAuthor: oc
    .meta(
      openapi({
        method: "POST",
        path: "/safety/blocks",
        summary: "Hide an author's raw contributions from your discovery",
      }),
    )
    .input(blockAuthorInput)
    .output(z.object({ blockId: z.uuid() })),
  blocks: oc
    .meta(
      openapi({
        method: "GET",
        path: "/safety/blocks",
        summary: "Your blocked authors",
      }),
    )
    .output(
      z.array(z.object({ id: z.uuid(), displayName: z.string().nullable() })),
    ),
  unblock: oc
    .meta(
      openapi({
        method: "DELETE",
        path: "/safety/blocks/{blockId}",
        summary: "Remove your author block",
      }),
    )
    .input(unblockAuthorInput)
    .output(z.object({ removed: z.boolean() })),
  hiddenTargets: oc
    .meta(
      openapi({
        method: "GET",
        path: "/safety/hidden-targets",
        summary: "Published content references hidden by your blocks",
      }),
    )
    .input(hiddenTargetsInput)
    .output(
      z.object({
        items: z.array(contentTarget),
        nextCursor: z.string().nullable(),
      }),
    ),
};
