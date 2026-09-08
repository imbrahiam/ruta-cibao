import { eq } from "drizzle-orm";
import { consultationResponses, consultations } from "@/db/schema";
import { keyParam } from "@/i18n/open-keys";
import { recordAudit } from "@/lib/audit";
import { withIdempotency } from "@/lib/idempotency";
import { publishRealtimeEvent } from "@/lib/realtime";
import {
  assertModerates,
  type ModeratorViewer,
} from "@/modules/access/permissions";
import { notify } from "@/modules/notifications/notify";
import type { RespondConsultationInput } from "./contracts";
import { CONSULTATIONS_CHANNEL, ConsultationError } from "./open-consultation";

/**
 * The ayuntamiento answering.
 *
 * This is the one place in the platform where the institution speaks to a named
 * resident, so four things happen together and none is optional: the reply is
 * recorded, the case moves, the trail says who moved it, and the person who
 * opened it is told — by push, by email, and in the notification centre, because
 * somebody who filed a case about their water three weeks ago is not sitting on
 * the page waiting.
 *
 * Two notifications rather than one, and the difference matters to the reader.
 * `consultationAnswered` is "there is something to read"; it fires for the first
 * substantive reply. `consultationStatusChanged` is "your case moved"; it fires
 * for everything after. Sending the first one twice would train people to
 * ignore it.
 */
export async function respondToConsultation(
  viewer: ModeratorViewer,
  input: RespondConsultationInput,
) {
  const outcome = await withIdempotency({
    key: input.requestId,
    userId: viewer.userId,
    request: input,
    run: async (tx) => {
      const [consultation] = await tx
        .select({
          id: consultations.id,
          slug: consultations.slug,
          title: consultations.title,
          status: consultations.status,
          municipalityId: consultations.municipalityId,
          openedByUserId: consultations.openedByUserId,
          answeredAt: consultations.answeredAt,
        })
        .from(consultations)
        .where(eq(consultations.id, input.consultationId))
        .limit(1);

      if (!consultation) throw new ConsultationError("not_found");
      // Read the row first: the row is what says which ayuntamiento this is.
      assertModerates(viewer, consultation.municipalityId);

      const now = new Date();
      // "There is an answer to read" is a claim about the reply, not about the
      // state it left the case in: an official who writes a full explanation
      // and marks the case rejected has still answered it.
      const isFirstAnswer =
        consultation.answeredAt === null && input.statusAfter !== "in_review";
      const closing =
        input.statusAfter === "resolved" || input.statusAfter === "rejected";

      await tx.insert(consultationResponses).values({
        consultationId: consultation.id,
        body: input.body,
        authorUserId: viewer.userId,
        statusAfter: input.statusAfter,
      });

      await tx
        .update(consultations)
        .set({
          status: input.statusAfter,
          answeredAt: isFirstAnswer ? now : consultation.answeredAt,
          closedAt: closing ? now : null,
        })
        .where(eq(consultations.id, consultation.id));

      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: "consultation.answered",
          subjectType: "consultation",
          subjectId: consultation.id,
          municipalityId: consultation.municipalityId,
          metadata: {
            from: consultation.status,
            to: input.statusAfter,
          },
        },
        tx,
      );

      return { consultation, isFirstAnswer };
    },
  });

  // Replays skip the side effects: the first attempt already sent them.
  if (outcome.replayed) return { status: "ok" as const };

  const { consultation, isFirstAnswer } = outcome.result;

  await publishRealtimeEvent({
    channel: CONSULTATIONS_CHANNEL,
    municipalityId: consultation.municipalityId,
    subjectType: "consultation",
    subjectId: consultation.id,
    action: "updated",
    payload: { status: input.statusAfter },
  });

  if (consultation.openedByUserId) {
    await notify({
      userId: consultation.openedByUserId,
      messageKey: isFirstAnswer
        ? "notifications.consultationAnswered"
        : "notifications.consultationStatusChanged",
      params: {
        title: consultation.title,
        // The state's name is vocabulary, not data, so the row stores the key
        // for it rather than the Spanish word — see `keyParam`.
        status: keyParam(`consultations.status.${input.statusAfter}`),
      },
      href: `/consultas/${consultation.slug}`,
    });
  }

  return { status: "ok" as const };
}
