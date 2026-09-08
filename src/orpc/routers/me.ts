import { openapi } from "@orpc/openapi";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { memberProfiles } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { memberProcedure, pub } from "../base";

/**
 * Who the caller is, as the UI needs to know it.
 *
 * Deliberately never includes the cédula — not the ciphertext, not the blind
 * index. The platform shows the verified name instead, which keeps the number
 * out of every page, log line and API response.
 */
export const meRouter = {
  get: pub
    .meta(
      openapi({ method: "GET", path: "/me", summary: "The current viewer" }),
    )
    .output(
      z.object({
        kind: z.enum(["anonymous", "visitor", "citizen"]),
        userId: z.string().nullable(),
        staffRole: z.enum(["none", "moderator", "admin"]),
        displayName: z.string().nullable(),
        image: z.string().nullable(),
        cedulaStatus: z
          .enum(["none", "pending", "verified", "unavailable", "rejected"])
          .nullable(),
        municipalityId: z.string().nullable(),
        verifiedFullName: z.string().nullable(),
        /**
         * Whether this account has ever said if it belongs to the province.
         *
         * Drives the one-time fork after sign-up. Knowing somebody is a tourist
         * is worth as much as knowing they are a resident: both stop the app
         * from asking again, and only one of them can vote.
         */
        needsResidencyChoice: z.boolean(),
      }),
    )
    .handler(async ({ context }) => {
      const viewer = await context.getViewer();

      if (viewer.kind === "anonymous") {
        return {
          kind: "anonymous" as const,
          userId: null,
          staffRole: "none" as const,
          displayName: null,
          image: null,
          cedulaStatus: null,
          municipalityId: null,
          verifiedFullName: null,
          needsResidencyChoice: false,
        };
      }

      return {
        kind: viewer.kind,
        userId: viewer.userId,
        staffRole: viewer.profile.staffRole,
        displayName: viewer.profile.displayName,
        image: viewer.image,
        cedulaStatus: viewer.profile.cedulaStatus,
        municipalityId: viewer.profile.municipalityId,
        verifiedFullName: viewer.profile.verifiedFullName,
        needsResidencyChoice:
          viewer.kind === "visitor" &&
          viewer.profile.cedulaStatus === "none" &&
          viewer.profile.residencyDeclaredAt === null,
      };
    }),

  /**
   * Records that the fork was answered, whichever way.
   *
   * Deliberately writes nothing but the timestamp. Saying "I live here" is not
   * a claim the platform believes — only the civil registry can settle that, on
   * `/verificar`. All this buys is silence: the question is asked once.
   */
  declareResidency: memberProcedure
    .meta(
      openapi({
        method: "POST",
        path: "/me/residency",
        summary: "Answer the resident-or-visitor fork",
      }),
    )
    .input(z.object({ resident: z.boolean() }))
    .output(z.object({ ok: z.literal(true) }))
    .handler(async ({ context, input }) => {
      await context.db.transaction(async (tx) => {
        await tx
          .update(memberProfiles)
          .set({ residencyDeclaredAt: new Date() })
          .where(eq(memberProfiles.userId, context.viewer.userId));
        await recordAudit(
          {
            actorUserId: context.viewer.userId,
            action: "member.residency_declared",
            subjectType: "member",
            subjectId: context.viewer.userId,
            metadata: { resident: input.resident },
          },
          tx,
        );
      });

      return { ok: true as const };
    }),
};
