import { z } from "zod";

/**
 * What a moderator can decide, as a shape.
 *
 * Six queues, two verdicts each, and a note that is optional in general but
 * required for the verdict that costs somebody something. Turning a submission
 * down without saying why is how a civic platform loses the people it needs
 * most, so the schema refuses to let it happen.
 *
 * One enum rather than one per feature, because the moderation desk is one
 * screen with one shape: a list, a card, two buttons, a note. Adding a queue
 * should be adding a tab, not a second desk.
 */
export const moderationQueue = z.enum([
  "places",
  "reports",
  "photos",
  "claims",
  "consultations",
  "traffic",
]);

export type ModerationQueueName = z.infer<typeof moderationQueue>;

export const queueInput = z.object({
  queue: moderationQueue,
  /** Omitted means every municipality the moderator is scoped to. */
  municipalityId: z.string().min(1).max(80).optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export const decidePlaceInput = z
  .object({
    requestId: z.uuid(),
    placeId: z.uuid(),
    decision: z.enum(["publish", "reject"]),
    note: z.string().trim().max(500).optional(),
  })
  .superRefine((value, context) => {
    if (value.decision === "reject" && (value.note?.length ?? 0) < 10) {
      context.addIssue({
        code: "custom",
        path: ["note"],
        message: "moderation.noteRequired",
      });
    }
  });

export const decideReportInput = z.object({
  requestId: z.uuid(),
  reportId: z.uuid(),
  decision: z.enum(["resolved", "dismissed"]),
  note: z.string().trim().max(500).optional(),
});

export type QueueInput = z.infer<typeof queueInput>;
export type DecidePlaceInput = z.infer<typeof decidePlaceInput>;
export type DecideReportInput = z.infer<typeof decideReportInput>;

export const decidePhotoInput = z.object({
  requestId: z.uuid(),
  photoId: z.uuid(),
  decision: z.enum(["publish", "reject"]),
});

export type DecidePhotoInput = z.infer<typeof decidePhotoInput>;
