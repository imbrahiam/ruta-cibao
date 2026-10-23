import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { z } from "zod";

export const notificationShape = z.object({
  id: z.string(),
  messageKey: z.string(),
  params: z.record(z.string(), z.union([z.string(), z.number()])),
  href: z.string().nullable(),
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

export const subscribePushInput = z.object({
  endpoint: z.url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().max(500).optional(),
});

export const subscribePushOutput = z.object({ enabled: z.boolean() });

export const unsubscribePushInput = z.object({ endpoint: z.url() });

export const unsubscribePushOutput = z.object({ removed: z.number().int() });

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

  subscribePush: oc
    .meta(
      openapi({
        method: "POST",
        path: "/notifications/push",
        summary: "Register a device for push",
      }),
    )
    .input(subscribePushInput)
    .output(subscribePushOutput),

  unsubscribePush: oc
    .meta(
      openapi({
        method: "DELETE",
        path: "/notifications/push",
        summary: "Remove a device",
      }),
    )
    .input(unsubscribePushInput)
    .output(unsubscribePushOutput),
};
