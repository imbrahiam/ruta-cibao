import { ORPCError } from "@orpc/server";
import type {
  NotificationPreferences,
  SetNotificationPreferencesInput,
} from "@ruta/contracts";
import { catalogues } from "@ruta/shared/messages";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  municipalities,
  notificationPreferences,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { withIdempotency } from "@/lib/idempotency";
import type { MemberViewer } from "@/modules/access/viewer";

const preferenceProjection = {
  municipalityIds: notificationPreferences.municipalityIds,
  categoryIds: notificationPreferences.categoryIds,
  trafficEnabled: notificationPreferences.trafficEnabled,
  caseUpdatesEnabled: notificationPreferences.caseUpdatesEnabled,
  emailEnabled: notificationPreferences.emailEnabled,
};

/** Reading defaults never implicitly opts a person into traffic notifications. */
export async function getNotificationPreferences(
  viewer: MemberViewer,
): Promise<NotificationPreferences> {
  const [preferences] = await db
    .select(preferenceProjection)
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, viewer.userId));
  return (
    preferences ?? {
      municipalityIds: [],
      categoryIds: [],
      trafficEnabled: false,
      caseUpdatesEnabled: true,
      emailEnabled: true,
    }
  );
}

export async function setNotificationPreferences(
  viewer: MemberViewer,
  input: SetNotificationPreferencesInput,
): Promise<NotificationPreferences> {
  const outcome = await withIdempotency({
    key: `notifications:set-preferences:${viewer.userId}:${input.requestId}`,
    userId: viewer.userId,
    request: input,
    run: async (tx) => {
      if (
        input.municipalityIds.length > 3 ||
        input.categoryIds.length > 100 ||
        new Set(input.municipalityIds).size !== input.municipalityIds.length ||
        new Set(input.categoryIds).size !== input.categoryIds.length
      ) {
        throw new ORPCError("BAD_REQUEST", {
          message: catalogues.es.notifications.errors.invalidPreferences,
          data: { reason: "invalid_preferences" },
        });
      }

      if (input.municipalityIds.length > 0) {
        const selected = await tx
          .select({ id: municipalities.id })
          .from(municipalities)
          .where(inArray(municipalities.id, input.municipalityIds))
          .for("share");
        if (selected.length !== input.municipalityIds.length) {
          throw new ORPCError("BAD_REQUEST", {
            message: catalogues.es.notifications.errors.invalidMunicipalities,
            data: { reason: "invalid_municipalities" },
          });
        }
      }

      // Empty categories deliberately mean all traffic categories in the chosen
      // municipalities. A nonempty selection must contain only active traffic.
      if (input.categoryIds.length > 0) {
        const selected = await tx
          .select({ id: categories.id })
          .from(categories)
          .where(
            and(
              inArray(categories.id, input.categoryIds),
              eq(categories.kind, "traffic"),
              eq(categories.isActive, true),
            ),
          )
          .for("share");
        if (selected.length !== input.categoryIds.length) {
          throw new ORPCError("BAD_REQUEST", {
            message: catalogues.es.notifications.errors.invalidCategories,
            data: { reason: "invalid_categories" },
          });
        }
      }

      const preferences: NotificationPreferences = {
        municipalityIds: input.municipalityIds,
        categoryIds: input.categoryIds,
        trafficEnabled: input.trafficEnabled,
        caseUpdatesEnabled: input.caseUpdatesEnabled,
        emailEnabled: input.emailEnabled,
      };
      await tx
        .insert(notificationPreferences)
        .values({ userId: viewer.userId, ...preferences })
        .onConflictDoUpdate({
          target: notificationPreferences.userId,
          set: { ...preferences, updatedAt: new Date() },
        });
      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: "notification_preferences.updated",
          subjectType: "notification_preferences",
          subjectId: viewer.userId,
          metadata: {
            municipalityCount: preferences.municipalityIds.length,
            categoryCount: preferences.categoryIds.length,
            trafficEnabled: preferences.trafficEnabled,
            caseUpdatesEnabled: preferences.caseUpdatesEnabled,
            emailEnabled: preferences.emailEnabled,
          },
        },
        tx,
      );
      return preferences;
    },
  });
  return outcome.result;
}
