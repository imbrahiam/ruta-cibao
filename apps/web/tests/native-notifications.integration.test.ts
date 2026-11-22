import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { call, ORPCError } from "@orpc/server";
import type {
  NotificationPreferences,
  SetNotificationPreferencesInput,
  SubscribeNativePushInput,
} from "@ruta/contracts";
import { appTargetHref } from "@ruta/shared/app-target";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditEvents,
  categories,
  idempotencyKeys,
  jobOutbox,
  memberProfiles,
  municipalities,
  nativePushDevices,
  notificationPreferences,
  notifications,
  places,
  realtimeEvents,
  savedPlaces,
  trafficReports,
  user,
} from "@/db/schema";
import { decryptSensitive, hashLookup } from "@/lib/crypto";
import { env } from "@/lib/env";
import { IdempotencyConflictError } from "@/lib/idempotency";
import { QUEUES } from "@/lib/jobs/queues";
import { userChannel } from "@/lib/realtime";
import { requireMember } from "@/modules/access/permissions";
import {
  type MemberViewer,
  toViewer,
  type Viewer,
} from "@/modules/access/viewer";
import {
  subscribeNativePush,
  unsubscribeNativePush,
} from "@/modules/notifications/devices";
import {
  getNotificationPreferences,
  setNotificationPreferences,
} from "@/modules/notifications/preferences";
import { notifyNearbyOfTraffic } from "@/modules/traffic/notify-nearby";
import type { AppContext } from "@/orpc/context";
import { notificationsRouter } from "@/orpc/routers/notifications";

// Opt in with RUN_DB_TESTS=1 and a migrated, disposable loopback test database.
// This suite never dispatches provider requests or drains the outbound jobs.
function assertDedicatedLocalDatabase() {
  const database = new URL(env.DATABASE_URL);
  if (
    env.NODE_ENV === "production" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) ||
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    !/(?:^|[-_])(test|tests)(?:$|[-_])/i.test(
      decodeURIComponent(database.pathname.slice(1)),
    ) ||
    database.searchParams.has("host") ||
    database.searchParams.has("hostaddr")
  ) {
    throw new Error(
      "Native notification tests require a non-production loopback PostgreSQL database with a dedicated test name.",
    );
  }
}

describe.skipIf(process.env.RUN_DB_TESTS !== "1")(
  "native notification consent and installation ownership",
  () => {
    const prefix = `native-test-${crypto.randomUUID()}`;
    const municipalityIds: [string, string, string, string] = [
      `${prefix}-town-0`,
      `${prefix}-town-1`,
      `${prefix}-town-2`,
      `${prefix}-town-3`,
    ];
    const trafficCategoryId = `${prefix}-traffic`;
    const otherCategoryId = `${prefix}-other-traffic`;
    const inactiveCategoryId = `${prefix}-inactive`;
    const placeCategoryId = `${prefix}-place`;
    const categoryIds = [
      trafficCategoryId,
      otherCategoryId,
      inactiveCategoryId,
      placeCategoryId,
    ];
    const categoryName = `${prefix} synthetic road hazard`;
    const accountIds: string[] = [];
    const placeIds: string[] = [];
    const reportIds: string[] = [];
    let guarded = false;

    async function member(): Promise<MemberViewer> {
      const id = `${prefix}-${crypto.randomUUID()}`;
      accountIds.push(id);
      await db.insert(user).values({
        id,
        name: "Synthetic notification tester",
        email: `${id}@example.invalid`,
        emailVerified: true,
      });
      const [profile] = await db
        .insert(memberProfiles)
        .values({
          userId: id,
          displayName: "Synthetic notification tester",
          municipalityId: municipalityIds[0],
        })
        .returning();
      return requireMember(
        toViewer(id, profile, { image: null, contactVerified: true }),
      );
    }

    function context(viewer: Viewer): AppContext {
      return {
        db,
        requestId: "test-request",
        headers: new Headers(),
        getViewer: async () => viewer,
        getSession: async () => {
          if (viewer.kind === "anonymous") {
            return { viewer, contact: null, session: null };
          }
          return {
            viewer,
            session: { id: "test-session", createdAt: new Date() },
            contact: {
              phoneNumber: null,
              phoneVerified: false,
              email: `${viewer.userId}@example.invalid`,
              emailVerified: true,
            },
          };
        },
        requireStaffSession: async () => {},
      };
    }

    function preferences(
      overrides: Partial<NotificationPreferences> = {},
    ): SetNotificationPreferencesInput {
      return {
        requestId: crypto.randomUUID(),
        municipalityIds: [municipalityIds[0]],
        categoryIds: [],
        trafficEnabled: true,
        caseUpdatesEnabled: true,
        emailEnabled: true,
        ...overrides,
      };
    }

    function subscription(
      overrides: Partial<SubscribeNativePushInput> = {},
    ): SubscribeNativePushInput {
      return {
        requestId: crypto.randomUUID(),
        installationId: crypto.randomUUID(),
        platform: "ios",
        token: `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`,
        ...overrides,
      };
    }

    async function audits(viewer: MemberViewer, action: string) {
      return db
        .select()
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.actorUserId, viewer.userId),
            eq(auditEvents.action, action),
          ),
        );
    }

    async function report(
      reporter: MemberViewer,
      overrides: Partial<typeof trafficReports.$inferInsert> = {},
    ) {
      const id = crypto.randomUUID();
      reportIds.push(id);
      await db.insert(trafficReports).values({
        id,
        categoryId: trafficCategoryId,
        municipalityId: municipalityIds[3],
        location: { x: -71.3, y: 19.45 },
        reportedByUserId: reporter.userId,
        expiresAt: new Date(Date.now() + 3_600_000),
        ...overrides,
      });
      return id;
    }

    async function reportNotifications(reportId: string) {
      return db
        .select()
        .from(notifications)
        .where(
          eq(
            notifications.href,
            appTargetHref({ kind: "traffic", ref: reportId }),
          ),
        );
    }

    beforeAll(async () => {
      assertDedicatedLocalDatabase();
      guarded = true;
      await db
        .insert(municipalities)
        .values(municipalityIds.map((id) => ({ id, name: id })));
      await db.insert(categories).values([
        { id: trafficCategoryId, kind: "traffic", name: categoryName },
        {
          id: otherCategoryId,
          kind: "traffic",
          name: `${prefix} other hazard`,
        },
        {
          id: inactiveCategoryId,
          kind: "traffic",
          name: `${prefix} inactive hazard`,
          isActive: false,
        },
        { id: placeCategoryId, kind: "place", name: `${prefix} destination` },
      ]);
    });

    afterAll(async () => {
      if (!guarded) return;
      await db.transaction(async (tx) => {
        if (accountIds.length > 0) {
          const created = await tx
            .select({ id: notifications.id })
            .from(notifications)
            .where(inArray(notifications.userId, accountIds));
          const notificationIds = created.map((row) => row.id);
          if (notificationIds.length > 0) {
            await tx
              .delete(jobOutbox)
              .where(
                inArray(
                  sql<string>`${jobOutbox.data}->>'notificationId'`,
                  notificationIds,
                ),
              );
          }
          await tx
            .delete(realtimeEvents)
            .where(
              inArray(realtimeEvents.channel, accountIds.map(userChannel)),
            );
          await tx
            .delete(auditEvents)
            .where(
              or(
                inArray(auditEvents.actorUserId, accountIds),
                notificationIds.length > 0
                  ? and(
                      eq(auditEvents.subjectType, "notification"),
                      inArray(auditEvents.subjectId, notificationIds),
                    )
                  : undefined,
              ),
            );
        }
        if (reportIds.length > 0) {
          await tx
            .delete(trafficReports)
            .where(inArray(trafficReports.id, reportIds));
        }
        if (placeIds.length > 0) {
          await tx.delete(places).where(inArray(places.id, placeIds));
        }
        if (accountIds.length > 0) {
          await tx.delete(user).where(inArray(user.id, accountIds));
        }
        await tx.delete(categories).where(inArray(categories.id, categoryIds));
        await tx
          .delete(municipalities)
          .where(inArray(municipalities.id, municipalityIds));
      });
    });

    test("anonymous requests cannot manage devices, preferences, or the inbox", async () => {
      const anonymous = { context: context({ kind: "anonymous" }) };
      await expect(
        call(notificationsRouter.list, {}, anonymous),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(
        call(notificationsRouter.markRead, {}, anonymous),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(
        call(notificationsRouter.getPreferences, undefined, anonymous),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(
        call(notificationsRouter.setPreferences, preferences(), anonymous),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(
        call(
          notificationsRouter.subscribeNativePush,
          subscription(),
          anonymous,
        ),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(
        call(
          notificationsRouter.unsubscribeNativePush,
          {
            requestId: crypto.randomUUID(),
            installationId: crypto.randomUUID(),
          },
          anonymous,
        ),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    test("defaults are read-only and one account cannot change another's preferences", async () => {
      const owner = await member();
      const other = await member();
      const defaults = {
        municipalityIds: [],
        categoryIds: [],
        trafficEnabled: false,
        caseUpdatesEnabled: true,
        emailEnabled: true,
      };
      expect(
        await call(notificationsRouter.getPreferences, undefined, {
          context: context(owner),
        }),
      ).toEqual(defaults);
      expect(
        await db
          .select()
          .from(notificationPreferences)
          .where(eq(notificationPreferences.userId, owner.userId)),
      ).toHaveLength(0);
      expect(
        await audits(owner, "notification_preferences.updated"),
      ).toHaveLength(0);
      const command = preferences({
        categoryIds: [trafficCategoryId],
        caseUpdatesEnabled: false,
        emailEnabled: false,
      });
      const { requestId: _requestId, ...expected } = command;
      expect(
        await call(notificationsRouter.setPreferences, command, {
          context: context(owner),
        }),
      ).toEqual(expected);
      expect(await getNotificationPreferences(owner)).toEqual(expected);
      expect(await getNotificationPreferences(other)).toEqual(defaults);
      const recorded = await audits(owner, "notification_preferences.updated");
      expect(recorded).toHaveLength(1);
      expect(recorded[0]?.metadata).toEqual({
        municipalityCount: 1,
        categoryCount: 1,
        trafficEnabled: true,
        caseUpdatesEnabled: false,
        emailEnabled: false,
      });
    });

    test("invalid or duplicate taxonomy selections roll back preferences and replay claims", async () => {
      const owner = await member();
      const invalid: Array<[Partial<NotificationPreferences>, string]> = [
        [{ municipalityIds }, "invalid_preferences"],
        [
          { municipalityIds: [municipalityIds[0], municipalityIds[0]] },
          "invalid_preferences",
        ],
        [
          { categoryIds: [trafficCategoryId, trafficCategoryId] },
          "invalid_preferences",
        ],
        [
          { municipalityIds: [`${prefix}-missing-town`] },
          "invalid_municipalities",
        ],
        [{ categoryIds: [`${prefix}-missing-category`] }, "invalid_categories"],
        [{ categoryIds: [inactiveCategoryId] }, "invalid_categories"],
        [{ categoryIds: [placeCategoryId] }, "invalid_categories"],
      ];
      for (const [overrides, reason] of invalid) {
        await expect(
          setNotificationPreferences(owner, preferences(overrides)),
        ).rejects.toMatchObject({
          code: "BAD_REQUEST",
          data: { reason },
        });
      }
      await expect(
        call(
          notificationsRouter.setPreferences,
          preferences({ municipalityIds }),
          { context: context(owner) },
        ),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(
        await db
          .select()
          .from(notificationPreferences)
          .where(eq(notificationPreferences.userId, owner.userId)),
      ).toHaveLength(0);
      expect(
        await db
          .select()
          .from(idempotencyKeys)
          .where(eq(idempotencyKeys.userId, owner.userId)),
      ).toHaveLength(0);
      expect(
        await audits(owner, "notification_preferences.updated"),
      ).toHaveLength(0);
    });

    test("concurrent preference retries commit once and request IDs are owner-scoped", async () => {
      const owner = await member();
      const other = await member();
      const command = preferences({
        municipalityIds: municipalityIds.slice(0, 3),
        categoryIds: [trafficCategoryId, otherCategoryId],
      });
      const [first, retry] = await Promise.all([
        setNotificationPreferences(owner, command),
        setNotificationPreferences(owner, command),
      ]);
      expect(first).toEqual(retry);
      expect(
        await audits(owner, "notification_preferences.updated"),
      ).toHaveLength(1);
      await expect(
        setNotificationPreferences(owner, {
          ...command,
          trafficEnabled: false,
        }),
      ).rejects.toBeInstanceOf(IdempotencyConflictError);
      // CONFLICT (409), not a 500, so a client does not retry it as a server error.
      const refused = await setNotificationPreferences(owner, {
        ...command,
        trafficEnabled: false,
      }).catch((error: unknown) => error);
      expect(refused).toBeInstanceOf(ORPCError);
      expect(refused instanceof ORPCError && refused.code).toBe("CONFLICT");
      expect(await getNotificationPreferences(owner)).toEqual(first);
      await setNotificationPreferences(other, {
        ...command,
        trafficEnabled: false,
      });
      expect((await getNotificationPreferences(other)).trafficEnabled).toBe(
        false,
      );
      expect((await getNotificationPreferences(owner)).trafficEnabled).toBe(
        true,
      );
    });

    test("native registration encrypts tokens, uniquely HMAC-indexes them, and replays without writes", async () => {
      const owner = await member();
      const other = await member();
      const command = subscription();
      const result = await Promise.all([
        call(notificationsRouter.subscribeNativePush, command, {
          context: context(owner),
        }),
        call(notificationsRouter.subscribeNativePush, command, {
          context: context(owner),
        }),
      ]);
      expect(result).toEqual([{ enabled: true }, { enabled: true }]);
      const stored = await db
        .select()
        .from(nativePushDevices)
        .where(eq(nativePushDevices.installationId, command.installationId));
      expect(stored).toHaveLength(1);
      const device = stored[0];
      if (!device)
        throw new Error("Expected registered synthetic installation");
      expect(device.userId).toBe(owner.userId);
      expect(device.enabled).toBe(true);
      expect(device.tokenHash).toBe(
        hashLookup("native-push-token", command.token),
      );
      expect(device.tokenCiphertext.startsWith("v1:")).toBe(true);
      expect(decryptSensitive(device.tokenCiphertext)).toBe(command.token);
      expect(JSON.stringify(stored)).not.toContain(command.token);
      const recorded = await audits(owner, "native_push.subscribed");
      expect(recorded).toHaveLength(1);
      expect(recorded[0]?.metadata).toEqual({
        platform: "ios",
        reassigned: false,
        tokenRotated: false,
      });
      expect(JSON.stringify(recorded)).not.toContain(device.tokenHash);
      expect(JSON.stringify(recorded)).not.toContain(device.tokenCiphertext);
      expect(JSON.stringify(recorded)).not.toContain(command.token);
      expect(JSON.stringify(recorded)).not.toContain("@example.invalid");
      await expect(
        subscribeNativePush(owner, { ...command, token: subscription().token }),
      ).rejects.toBeInstanceOf(IdempotencyConflictError);
      expect(
        (
          await db
            .select()
            .from(nativePushDevices)
            .where(eq(nativePushDevices.installationId, command.installationId))
        )[0]?.tokenHash,
      ).toBe(device.tokenHash);
      // Request UUIDs are namespaced by both operation and authenticated owner.
      await setNotificationPreferences(owner, {
        ...preferences(),
        requestId: command.requestId,
      });
      await subscribeNativePush(
        other,
        subscription({ requestId: command.requestId }),
      );
      expect(await audits(other, "native_push.subscribed")).toHaveLength(1);
    });

    test("account switching reassigns an installation and a stale owner cannot unbind it", async () => {
      const previous = await member();
      const current = await member();
      const command = subscription();
      await subscribeNativePush(previous, command);
      const replacement = subscription({
        installationId: command.installationId,
        platform: "android",
      });
      await subscribeNativePush(current, replacement);
      const [device] = await db
        .select()
        .from(nativePushDevices)
        .where(eq(nativePushDevices.installationId, command.installationId));
      expect(device?.userId).toBe(current.userId);
      expect(device?.platform).toBe("android");
      expect(device?.tokenHash).toBe(
        hashLookup("native-push-token", replacement.token),
      );
      expect(
        (await audits(current, "native_push.subscribed"))[0]?.metadata,
      ).toEqual({ platform: "android", reassigned: true, tokenRotated: true });
      expect(
        await call(
          notificationsRouter.unsubscribeNativePush,
          {
            requestId: crypto.randomUUID(),
            installationId: command.installationId,
          },
          { context: context(previous) },
        ),
      ).toEqual({ removed: 0 });
      expect(await audits(previous, "native_push.unsubscribed")).toHaveLength(
        0,
      );
      expect(
        (
          await db
            .select()
            .from(nativePushDevices)
            .where(eq(nativePushDevices.installationId, command.installationId))
        )[0]?.userId,
      ).toBe(current.userId);
      const removal = {
        requestId: replacement.requestId,
        installationId: command.installationId,
      };
      expect(await unsubscribeNativePush(current, removal)).toEqual({
        removed: 1,
      });
      expect(await unsubscribeNativePush(current, removal)).toEqual({
        removed: 1,
      });
      expect(
        await unsubscribeNativePush(current, {
          ...removal,
          requestId: crypto.randomUUID(),
        }),
      ).toEqual({ removed: 0 });
      expect(await audits(current, "native_push.unsubscribed")).toHaveLength(1);
      expect(
        await db
          .select()
          .from(nativePushDevices)
          .where(eq(nativePushDevices.installationId, command.installationId)),
      ).toHaveLength(0);
      // A delayed subscribe retry must not restore a binding after sign-out.
      expect(await subscribeNativePush(current, replacement)).toEqual({
        enabled: true,
      });
      expect(
        await db
          .select()
          .from(nativePushDevices)
          .where(eq(nativePushDevices.installationId, command.installationId)),
      ).toHaveLength(0);
    });

    test("token collisions transfer ownership atomically even when installations exchange tokens", async () => {
      const firstOwner = await member();
      const secondOwner = await member();
      const newOwner = await member();
      const first = subscription();
      const second = subscription();
      await subscribeNativePush(firstOwner, first);
      await subscribeNativePush(secondOwner, second);
      await subscribeNativePush(
        newOwner,
        subscription({
          installationId: second.installationId,
          token: first.token,
        }),
      );
      expect(
        await db
          .select()
          .from(nativePushDevices)
          .where(eq(nativePushDevices.installationId, first.installationId)),
      ).toHaveLength(0);
      const transferred = await db
        .select()
        .from(nativePushDevices)
        .where(
          eq(
            nativePushDevices.tokenHash,
            hashLookup("native-push-token", first.token),
          ),
        );
      expect(transferred).toHaveLength(1);
      expect(transferred[0]?.installationId).toBe(second.installationId);
      expect(transferred[0]?.userId).toBe(newOwner.userId);
      const evidence = await audits(newOwner, "native_push.transferred");
      expect(evidence).toHaveLength(1);
      expect(evidence[0]?.subjectId).toBe(first.installationId);
      expect(evidence[0]?.metadata).toEqual({});
      expect(
        await unsubscribeNativePush(firstOwner, {
          requestId: crypto.randomUUID(),
          installationId: first.installationId,
        }),
      ).toEqual({ removed: 0 });

      const left = subscription();
      const right = subscription();
      await subscribeNativePush(firstOwner, left);
      await subscribeNativePush(secondOwner, right);
      await Promise.all([
        subscribeNativePush(
          firstOwner,
          subscription({
            installationId: left.installationId,
            token: right.token,
          }),
        ),
        subscribeNativePush(
          secondOwner,
          subscription({
            installationId: right.installationId,
            token: left.token,
          }),
        ),
      ]);
      const exchanged = await db
        .select()
        .from(nativePushDevices)
        .where(
          inArray(nativePushDevices.installationId, [
            left.installationId,
            right.installationId,
          ]),
        );
      expect(exchanged).toHaveLength(2);
      expect(
        exchanged.find((row) => row.installationId === left.installationId)
          ?.tokenHash,
      ).toBe(hashLookup("native-push-token", right.token));
      expect(
        exchanged.find((row) => row.installationId === right.installationId)
          ?.tokenHash,
      ).toBe(hashLookup("native-push-token", left.token));

      const sharedToken = subscription().token;
      const competing = [
        subscription({ token: sharedToken }),
        subscription({ token: sharedToken }),
      ] as const;
      await Promise.all([
        subscribeNativePush(firstOwner, competing[0]),
        subscribeNativePush(secondOwner, competing[1]),
      ]);
      const winner = await db
        .select()
        .from(nativePushDevices)
        .where(
          eq(
            nativePushDevices.tokenHash,
            hashLookup("native-push-token", sharedToken),
          ),
        );
      expect(winner).toHaveLength(1);
      if (!winner[0])
        throw new Error("Expected transferred token installation");
      expect(competing.map((input) => input.installationId)).toContain(
        winner[0].installationId,
      );
    });

    test("mark-read is owner-scoped, preserves read timestamps, and audits only changed rows", async () => {
      const owner = await member();
      const other = await member();
      const readAt = new Date("2026-01-01T00:00:00.000Z");
      const stored = await db
        .insert(notifications)
        .values([
          { userId: owner.userId, messageKey: "notifications.routeReviewed" },
          { userId: owner.userId, messageKey: "notifications.routeReviewed" },
          {
            userId: owner.userId,
            messageKey: "notifications.routeReviewed",
            readAt,
          },
          { userId: other.userId, messageKey: "notifications.routeReviewed" },
        ])
        .returning();
      const [first, second, alreadyRead, foreign] = stored;
      if (!first || !second || !alreadyRead || !foreign)
        throw new Error("Expected synthetic inbox fixtures");
      const ownerContext = { context: context(owner) };
      expect(
        await call(
          notificationsRouter.markRead,
          { id: foreign.id },
          ownerContext,
        ),
      ).toEqual({ updated: 0 });
      expect(
        await call(
          notificationsRouter.markRead,
          { id: alreadyRead.id },
          ownerContext,
        ),
      ).toEqual({ updated: 0 });
      expect(await audits(owner, "notification.read")).toHaveLength(0);
      expect(
        await call(
          notificationsRouter.markRead,
          { id: first.id },
          ownerContext,
        ),
      ).toEqual({ updated: 1 });
      const [marked] = await db
        .select()
        .from(notifications)
        .where(eq(notifications.id, first.id));
      expect(
        await call(
          notificationsRouter.markRead,
          { id: first.id },
          ownerContext,
        ),
      ).toEqual({ updated: 0 });
      expect(
        (
          await db
            .select()
            .from(notifications)
            .where(eq(notifications.id, first.id))
        )[0]?.readAt,
      ).toEqual(marked?.readAt);
      expect(
        await call(notificationsRouter.markRead, {}, ownerContext),
      ).toEqual({ updated: 1 });
      expect(
        await call(notificationsRouter.markRead, {}, ownerContext),
      ).toEqual({ updated: 0 });
      const recorded = await audits(owner, "notification.read");
      expect(recorded).toHaveLength(2);
      expect(new Set(recorded.map((row) => row.subjectId))).toEqual(
        new Set([first.id, second.id]),
      );
      expect(
        recorded.every((row) => Object.keys(row.metadata).length === 0),
      ).toBe(true);
      expect(
        (
          await db
            .select()
            .from(notifications)
            .where(eq(notifications.id, foreign.id))
        )[0]?.readAt,
      ).toBeNull();
      expect(
        (
          await db
            .select()
            .from(notifications)
            .where(eq(notifications.id, alreadyRead.id))
        )[0]?.readAt,
      ).toEqual(readAt);
      const inbox = await call(notificationsRouter.list, {}, ownerContext);
      expect(inbox.unread).toBe(0);
      expect(inbox.items).toHaveLength(3);
      expect(
        inbox.items.every(
          (item) => !["userId", "dedupeKey"].some((key) => key in item),
        ),
      ).toBe(true);
    });

    test("traffic fan-out requires explicit municipal/category consent and never copies unreviewed text", async () => {
      const reporter = await member();
      const allCategories = await member();
      const matchingCategory = await member();
      const otherCategory = await member();
      const otherMunicipality = await member();
      const muted = await member();
      const noMunicipality = await member();
      const savedOnly = await member();
      const contributedOnly = await member();
      const subscribe = (
        viewer: MemberViewer,
        overrides: Partial<NotificationPreferences> = {},
      ) =>
        setNotificationPreferences(
          viewer,
          preferences({ municipalityIds: [municipalityIds[3]], ...overrides }),
        );
      await subscribe(reporter);
      await subscribe(allCategories);
      await subscribe(matchingCategory, { categoryIds: [trafficCategoryId] });
      await subscribe(otherCategory, { categoryIds: [otherCategoryId] });
      await subscribe(otherMunicipality, {
        municipalityIds: [municipalityIds[0]],
      });
      await subscribe(muted, { trafficEnabled: false });
      await subscribe(noMunicipality, { municipalityIds: [] });
      const placeId = crypto.randomUUID();
      placeIds.push(placeId);
      await db.insert(places).values({
        id: placeId,
        slug: `${prefix}-${placeId}`,
        name: "Synthetic GPS contribution",
        categoryId: placeCategoryId,
        municipalityId: municipalityIds[3],
        location: { x: -71.3, y: 19.45 },
        locationSource: "gps",
        status: "published",
        createdByUserId: contributedOnly.userId,
      });
      await db
        .insert(savedPlaces)
        .values({ userId: savedOnly.userId, placeId });
      const privateText =
        "Synthetic unmoderated report text that must not enter the notification";
      const reportId = await report(reporter, { description: privateText });
      expect(await notifyNearbyOfTraffic(reportId)).toBe(2);
      await Promise.all([
        notifyNearbyOfTraffic(reportId),
        notifyNearbyOfTraffic(reportId),
      ]);
      const delivered = await reportNotifications(reportId);
      expect(delivered).toHaveLength(2);
      expect(new Set(delivered.map((row) => row.userId))).toEqual(
        new Set([allCategories.userId, matchingCategory.userId]),
      );
      expect(
        delivered.every(
          (row) =>
            row.params.description === categoryName &&
            row.messageKey === "notifications.trafficNearby" &&
            row.readAt === null,
        ),
      ).toBe(true);
      expect(JSON.stringify(delivered)).not.toContain(privateText);
      const notificationIds = delivered.map((row) => row.id);
      const jobs = await db
        .select()
        .from(jobOutbox)
        .where(
          inArray(
            sql<string>`${jobOutbox.data}->>'notificationId'`,
            notificationIds,
          ),
        );
      expect(jobs).toHaveLength(2);
      expect(
        jobs.every(
          (row) =>
            row.queue === QUEUES.notificationDeliver &&
            row.data.push === true &&
            row.data.email === false,
        ),
      ).toBe(true);
      expect(JSON.stringify(jobs)).not.toContain(privateText);
      const events = await db
        .select()
        .from(realtimeEvents)
        .where(inArray(realtimeEvents.subjectId, notificationIds));
      expect(events).toHaveLength(2);
      expect(new Set(events.map((row) => row.channel))).toEqual(
        new Set([
          userChannel(allCategories.userId),
          userChannel(matchingCategory.userId),
        ]),
      );
      const evidence = await db
        .select()
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.action, "notification.created"),
            inArray(auditEvents.subjectId, notificationIds),
          ),
        );
      expect(evidence).toHaveLength(2);
      expect(
        evidence.every((row) => Object.keys(row.metadata).length === 0),
      ).toBe(true);

      // Explicitly mute one recipient and narrow the other to another category.
      // A later report must not resurrect either previous subscription choice.
      await subscribe(allCategories, { trafficEnabled: false });
      await subscribe(matchingCategory, { categoryIds: [otherCategoryId] });
      const laterReport = await report(reporter, { description: privateText });
      expect(await notifyNearbyOfTraffic(laterReport)).toBe(0);
      expect(await reportNotifications(laterReport)).toHaveLength(0);
      expect(await reportNotifications(reportId)).toHaveLength(2);
    });

    test("missing, expired, cleared, removed, and inactive-category reports cannot fan out", async () => {
      const reporter = await member();
      const subscriber = await member();
      await setNotificationPreferences(
        subscriber,
        preferences({ municipalityIds: [municipalityIds[3]] }),
      );
      const reportInputs: Array<Partial<typeof trafficReports.$inferInsert>> = [
        { expiresAt: new Date(Date.now() - 60_000) },
        { status: "cleared" },
        { status: "expired" },
        { status: "removed" },
        { categoryId: inactiveCategoryId },
      ];
      for (const input of reportInputs) {
        const reportId = await report(reporter, input);
        expect(await notifyNearbyOfTraffic(reportId)).toBe(0);
        expect(await reportNotifications(reportId)).toHaveLength(0);
      }
      expect(await notifyNearbyOfTraffic(crypto.randomUUID())).toBe(0);
    });
  },
);
