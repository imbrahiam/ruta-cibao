import type {
  SubscribeNativePushInput,
  UnsubscribeNativePushInput,
} from "@ruta/contracts";
import { and, eq, ne, sql } from "drizzle-orm";
import { nativePushDevices } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { encryptSensitive, hashLookup } from "@/lib/crypto";
import { withIdempotency } from "@/lib/idempotency";
import type { MemberViewer } from "@/modules/access/viewer";

/** A token belongs to exactly one installation and its current signed-in owner. */
export async function subscribeNativePush(
  viewer: MemberViewer,
  input: SubscribeNativePushInput,
): Promise<{ enabled: boolean }> {
  const tokenHash = hashLookup("native-push-token", input.token);
  const outcome = await withIdempotency({
    key: `notifications:subscribe-native-push:${viewer.userId}:${input.requestId}`,
    userId: viewer.userId,
    request: {
      installationId: input.installationId,
      platform: input.platform,
      tokenHash,
    },
    run: async (tx) => {
      // Serialize both natural keys, including absent rows. A single lock also
      // avoids deadlocks when two installations exchange their previous tokens.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended('native-push-devices', 0))`,
      );
      const [existing] = await tx
        .select({
          userId: nativePushDevices.userId,
          tokenHash: nativePushDevices.tokenHash,
        })
        .from(nativePushDevices)
        .where(eq(nativePushDevices.installationId, input.installationId))
        .for("update");

      // Expo can issue the same token to a restored/reinstalled app. Remove its
      // old binding before the upsert so the unique HMAC index cannot conflict.
      // Cascading ticket deletion also retires delivery attempts for that binding.
      const transferred = await tx
        .delete(nativePushDevices)
        .where(
          and(
            eq(nativePushDevices.tokenHash, tokenHash),
            ne(nativePushDevices.installationId, input.installationId),
          ),
        )
        .returning({ installationId: nativePushDevices.installationId });
      for (const device of transferred) {
        await recordAudit(
          {
            actorUserId: viewer.userId,
            action: "native_push.transferred",
            subjectType: "native_push_device",
            subjectId: device.installationId,
          },
          tx,
        );
      }

      const tokenCiphertext = encryptSensitive(input.token);
      await tx
        .insert(nativePushDevices)
        .values({
          installationId: input.installationId,
          userId: viewer.userId,
          platform: input.platform,
          tokenCiphertext,
          tokenHash,
          enabled: true,
        })
        .onConflictDoUpdate({
          target: nativePushDevices.installationId,
          set: {
            userId: viewer.userId,
            platform: input.platform,
            tokenCiphertext,
            tokenHash,
            enabled: true,
            updatedAt: new Date(),
          },
        });
      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: "native_push.subscribed",
          subjectType: "native_push_device",
          subjectId: input.installationId,
          metadata: {
            platform: input.platform,
            reassigned:
              existing !== undefined && existing.userId !== viewer.userId,
            tokenRotated:
              existing !== undefined && existing.tokenHash !== tokenHash,
          },
        },
        tx,
      );
      // Registration remains durable when local provider delivery is disabled.
      return { enabled: true };
    },
  });
  return outcome.result;
}

export async function unsubscribeNativePush(
  viewer: MemberViewer,
  input: UnsubscribeNativePushInput,
): Promise<{ removed: number }> {
  const outcome = await withIdempotency({
    key: `notifications:unsubscribe-native-push:${viewer.userId}:${input.requestId}`,
    userId: viewer.userId,
    request: input,
    run: async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended('native-push-devices', 0))`,
      );
      const removed = await tx
        .delete(nativePushDevices)
        .where(
          and(
            eq(nativePushDevices.userId, viewer.userId),
            eq(nativePushDevices.installationId, input.installationId),
          ),
        )
        .returning({ installationId: nativePushDevices.installationId });
      for (const device of removed) {
        await recordAudit(
          {
            actorUserId: viewer.userId,
            action: "native_push.unsubscribed",
            subjectType: "native_push_device",
            subjectId: device.installationId,
          },
          tx,
        );
      }
      return { removed: removed.length };
    },
  });
  return outcome.result;
}
