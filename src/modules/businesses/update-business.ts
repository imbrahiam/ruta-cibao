import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import { businessClaims, places } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { withIdempotency } from "@/lib/idempotency";
import { normalizePhone } from "@/lib/phone";
import { publishRealtimeEvent } from "@/lib/realtime";
import type { CitizenViewer } from "@/modules/access/viewer";
import type { updateBusinessInput } from "./contracts";

export async function updateBusiness(
  viewer: CitizenViewer,
  input: z.infer<typeof updateBusinessInput>,
) {
  const outcome = await withIdempotency({
    key: input.requestId,
    userId: viewer.userId,
    request: input,
    run: async (tx) => {
      const [claim] = await tx
        .select({
          id: businessClaims.id,
          municipalityId: places.municipalityId,
        })
        .from(businessClaims)
        .innerJoin(places, eq(places.id, businessClaims.placeId))
        .where(
          and(
            eq(businessClaims.placeId, input.placeId),
            eq(businessClaims.claimantUserId, viewer.userId),
            eq(businessClaims.status, "approved"),
            eq(places.status, "published"),
          ),
        )
        .for("update");
      if (!claim) throw new ORPCError("FORBIDDEN");
      await tx
        .update(businessClaims)
        .set({
          contactPhone: normalizePhone(input.contactPhone),
          whatsapp: normalizePhone(input.whatsapp),
          openingHours: input.openingHours || null,
        })
        .where(eq(businessClaims.id, claim.id));
      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: "business.updated",
          subjectType: "place",
          subjectId: input.placeId,
          municipalityId: claim.municipalityId,
        },
        tx,
      );
      return { municipalityId: claim.municipalityId };
    },
  });
  if (!outcome.replayed)
    await publishRealtimeEvent({
      channel: "places",
      municipalityId: outcome.result.municipalityId,
      subjectType: "place",
      subjectId: input.placeId,
      action: "updated",
    });
  return { status: "ok" as const };
}
