import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { notifications, pushSubscriptions } from "@/db/schema";
import { encryptSensitive } from "@/lib/crypto";
import { isPushEnabled } from "@/lib/push";
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
      const scope = input.id
        ? and(
            eq(notifications.userId, context.viewer.userId),
            eq(notifications.id, input.id),
          )
        : and(
            eq(notifications.userId, context.viewer.userId),
            isNull(notifications.readAt),
          );

      const updated = await context.db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(scope)
        .returning({ id: notifications.id });

      return { updated: updated.length };
    }),

  /**
   * Registers a browser for push.
   *
   * The keys are per-device secrets — anyone holding them can push to that
   * device — so they are encrypted at rest like any other credential. The
   * endpoint is the natural key: re-subscribing the same browser updates its
   * row instead of accumulating duplicates.
   */
  subscribePush: impl.notifications.subscribePush
    .use(member)
    .handler(async ({ context, input }) => {
      if (!isPushEnabled()) return { enabled: false };

      await context.db
        .insert(pushSubscriptions)
        .values({
          userId: context.viewer.userId,
          endpoint: input.endpoint,
          p256dhCiphertext: encryptSensitive(input.p256dh),
          authCiphertext: encryptSensitive(input.auth),
          userAgent: input.userAgent ?? null,
        })
        .onConflictDoUpdate({
          target: pushSubscriptions.endpoint,
          set: {
            userId: context.viewer.userId,
            p256dhCiphertext: encryptSensitive(input.p256dh),
            authCiphertext: encryptSensitive(input.auth),
          },
        });

      return { enabled: true };
    }),

  unsubscribePush: impl.notifications.unsubscribePush
    .use(member)
    .handler(async ({ context, input }) => {
      const removed = await context.db
        .delete(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.userId, context.viewer.userId),
            eq(pushSubscriptions.endpoint, input.endpoint),
          ),
        )
        .returning({ id: pushSubscriptions.id });

      return { removed: removed.length };
    }),
};
