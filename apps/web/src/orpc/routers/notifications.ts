import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { notifications } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import {
  subscribeNativePush,
  unsubscribeNativePush,
} from "@/modules/notifications/devices";
import {
  getNotificationPreferences,
  setNotificationPreferences,
} from "@/modules/notifications/preferences";
import { impl, member } from "../base";

export const notificationsRouter = {
  list: impl.notifications.list
    .use(member)
    .handler(async ({ context, input }) => {
      const [items, [counted]] = await Promise.all([
        context.db
          .select()
          .from(notifications)
          .where(eq(notifications.userId, context.viewer.userId))
          .orderBy(desc(notifications.createdAt))
          .limit(input?.limit ?? 20),
        context.db
          .select({ unread: sql<number>`count(*)::int` })
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, context.viewer.userId),
              isNull(notifications.readAt),
            ),
          ),
      ]);

      return {
        items: items.map((item) => ({
          id: item.id,
          messageKey: item.messageKey,
          params: item.params,
          href: item.href,
          readAt: item.readAt?.toISOString() ?? null,
          createdAt: item.createdAt.toISOString(),
        })),
        unread: counted?.unread ?? 0,
      };
    }),

  /**
   * Marks one notification read, or all of them.
   *
   * Scoped to the viewer in the `where` clause rather than checked after
   * reading: an id belonging to someone else matches nothing instead of
   * revealing that it exists.
   */
  markRead: impl.notifications.markRead
    .use(member)
    .handler(async ({ context, input }) => {
      const scope = and(
        eq(notifications.userId, context.viewer.userId),
        isNull(notifications.readAt),
        input.id ? eq(notifications.id, input.id) : undefined,
      );
      return context.db.transaction(async (tx) => {
        const updated = await tx
          .update(notifications)
          .set({ readAt: new Date() })
          .where(scope)
          .returning({ id: notifications.id });
        for (const notification of updated) {
          await recordAudit(
            {
              actorUserId: context.viewer.userId,
              action: "notification.read",
              subjectType: "notification",
              subjectId: notification.id,
            },
            tx,
          );
        }
        return { updated: updated.length };
      });
    }),

  subscribeNativePush: impl.notifications.subscribeNativePush
    .use(member)
    .handler(({ context, input }) =>
      subscribeNativePush(context.viewer, input),
    ),

  unsubscribeNativePush: impl.notifications.unsubscribeNativePush
    .use(member)
    .handler(({ context, input }) =>
      unsubscribeNativePush(context.viewer, input),
    ),

  getPreferences: impl.notifications.getPreferences
    .use(member)
    .handler(({ context }) => getNotificationPreferences(context.viewer)),

  setPreferences: impl.notifications.setPreferences
    .use(member)
    .handler(({ context, input }) =>
      setNotificationPreferences(context.viewer, input),
    ),
};
