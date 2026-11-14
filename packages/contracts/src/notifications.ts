import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { z } from "zod";

export const notificationShape = z.object({
  id: z.string(),
  messageKey: z.string(),
  params: z.record(z.string(), z.union([z.string(), z.number()])),
  href: z.string().nullable(),
  /**
   * The category of what the notice is about (resolved from `href`), so the
   * row shows the same pin the map does. Null when it points at no category.
   */
  categoryIcon: z.string().nullable(),
  categoryColor: z.string().nullable(),
  readAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export const listNotificationsInput = z
  .object({ limit: z.number().int().min(1).max(50).default(20) })
  .optional();

export const listNotificationsOutput = z.object({
  items: z.array(notificationShape),
  unread: z.number().int(),
});

/** One notification by id, or every unread one when `id` is omitted. */
export const markNotificationsReadInput = z.object({ id: z.uuid().optional() });

export const markNotificationsReadOutput = z.object({
  updated: z.number().int(),
});

export const subscribeNativePushInput = z.object({
  requestId: z.uuid(),
  installationId: z.uuid(),
  platform: z.enum(["ios", "android"]),
  /** APNs device token (hex) on iOS; FCM registration token on Android. */
  token: z
    .string()
    .min(32)
    .max(4096)
    .regex(/^[A-Za-z0-9_:-]+$/),
});

export const unsubscribeNativePushInput = z.object({
  requestId: z.uuid(),
  installationId: z.uuid(),
});

export const notificationPreferencesOutput = z.object({
  municipalityIds: z.array(z.string().min(1).max(80)).max(3),
  categoryIds: z.array(z.string().min(1).max(80)).max(100),
  trafficEnabled: z.boolean(),
  caseUpdatesEnabled: z.boolean(),
  emailEnabled: z.boolean(),
});

export const setNotificationPreferencesInput =
  notificationPreferencesOutput.extend({
    requestId: z.uuid(),
  });

export type SubscribeNativePushInput = z.infer<typeof subscribeNativePushInput>;
export type UnsubscribeNativePushInput = z.infer<
  typeof unsubscribeNativePushInput
>;
export type SetNotificationPreferencesInput = z.infer<
  typeof setNotificationPreferencesInput
>;
export type NotificationPreferences = z.infer<
  typeof notificationPreferencesOutput
>;

export const notificationsContract = {
  list: oc
    .meta(
      openapi({
        method: "GET",
        path: "/notifications",
        summary: "The viewer's notifications",
      }),
    )
    .input(listNotificationsInput)
    .output(listNotificationsOutput),

  markRead: oc
    .meta(
      openapi({
        method: "POST",
        path: "/notifications/read",
        summary: "Mark notifications as read",
      }),
    )
    .input(markNotificationsReadInput)
    .output(markNotificationsReadOutput),

  subscribeNativePush: oc
    .meta(
      openapi({
        method: "POST",
        path: "/notifications/native-push",
        summary: "Register a native installation",
      }),
    )
    .input(subscribeNativePushInput)
    .output(z.object({ enabled: z.boolean() })),

  unsubscribeNativePush: oc
    .meta(
      openapi({
        method: "DELETE",
        path: "/notifications/native-push",
        summary: "Unbind your native installation",
      }),
    )
    .input(unsubscribeNativePushInput)
    .output(z.object({ removed: z.number().int() })),

  getPreferences: oc
    .meta(
      openapi({
        method: "GET",
        path: "/notifications/preferences",
        summary: "Your notification preferences",
      }),
    )
    .output(notificationPreferencesOutput),

  setPreferences: oc
    .meta(
      openapi({
        method: "PUT",
        path: "/notifications/preferences",
        summary: "Update your notification preferences",
      }),
    )
    .input(setNotificationPreferencesInput)
    .output(notificationPreferencesOutput),
};
