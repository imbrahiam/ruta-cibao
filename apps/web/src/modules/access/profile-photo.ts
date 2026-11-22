import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { env } from "@/lib/env";
import { withIdempotency } from "@/lib/idempotency";
import { normalizePhoto } from "@/lib/image";
import { logError } from "@/lib/log";
import { createReadUrl, deleteObject, putObject } from "@/lib/storage";
import type { MemberViewer } from "./viewer";

export function profilePhotoPrefix(userId: string): string {
  return `profile-photos/${userId}/`;
}

function profilePhotoKey(userId: string, version: string): string {
  return `${profilePhotoPrefix(userId)}${version}.webp`;
}

function profilePhotoVersion(
  image: string | null,
  userId: string,
): string | null {
  if (!image) return null;
  const url = URL.parse(image);
  if (url?.pathname !== profilePhotoPath(userId)) return null;
  const version = url.searchParams.get("v");
  return version && /^[a-f0-9-]{36}$/i.test(version) ? version : null;
}

function profilePhotoPath(userId: string): string {
  return `/api/profile-photos/${encodeURIComponent(userId)}`;
}

export async function updateProfilePhoto(
  viewer: MemberViewer,
  input: { requestId: string; jpeg: string },
): Promise<{ image: string }> {
  const path = profilePhotoPath(viewer.userId);
  const image = new URL(path, env.APP_URL);
  image.searchParams.set("v", input.requestId);
  const { result } = await withIdempotency({
    key: input.requestId,
    userId: viewer.userId,
    request: input,
    run: async (tx) => {
      const [account] = await tx
        .select({ banned: user.banned, image: user.image })
        .from(user)
        .where(eq(user.id, viewer.userId))
        .for("update");
      if (!account || account.banned) throw new ORPCError("UNAUTHORIZED");

      let photo: Uint8Array;
      try {
        photo = await normalizePhoto(Buffer.from(input.jpeg, "base64"), 512);
      } catch {
        throw new ORPCError("BAD_REQUEST", {
          message: "The profile photo could not be decoded.",
          data: { reason: "invalid_photo" },
        });
      }

      await putObject(
        profilePhotoKey(viewer.userId, input.requestId),
        photo,
        "image/webp",
      );
      await tx
        .update(user)
        .set({ image: image.href })
        .where(eq(user.id, viewer.userId));
      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: "member.profile_updated",
          subjectType: "member",
          subjectId: viewer.userId,
          municipalityId: viewer.profile.municipalityId,
          metadata: { photoChanged: true },
        },
        tx,
      );
      return {
        image: image.href,
        previous: profilePhotoVersion(account.image, viewer.userId),
      };
    },
  });
  if (result.previous && result.previous !== input.requestId) {
    await deleteObject(profilePhotoKey(viewer.userId, result.previous)).catch(
      () => {
        logError("profile.photo_cleanup_failed");
      },
    );
  }
  return { image: result.image };
}

export async function profilePhotoReadUrl(
  userId: string,
): Promise<string | null> {
  const [account] = await db
    .select({ image: user.image, banned: user.banned })
    .from(user)
    .where(eq(user.id, userId));
  if (!account || account.banned) return null;
  const version = profilePhotoVersion(account.image, userId);
  return version ? createReadUrl(profilePhotoKey(userId, version)) : null;
}
