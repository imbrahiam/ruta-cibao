import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { eq, inArray } from "drizzle-orm";
import sharp from "sharp";
import messages from "../messages/es.json" with { type: "json" };
import { db, pool } from "../src/db";
import {
  identityReviews,
  memberProfiles,
  municipalities,
  session,
  user,
} from "../src/db/schema";
import { encryptSensitive } from "../src/lib/crypto";
import { purgeDocuments } from "../src/modules/identity/documents";

// Supply a dedicated migrated database, private bucket, and matching server secret.
test.skip(
  process.env.E2E_IDENTITY_TESTS !== "1",
  "Requires isolated identity fixtures",
);
test.afterAll(async () => {
  await pool.end();
});
test("resident submits evidence; scoped moderator opens and approves it", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(60_000);
  if (!baseURL || new URL(baseURL).hostname !== "localhost")
    throw new Error("Identity smoke tests require localhost");
  const prefix = `identity-e2e-${crypto.randomUUID()}`;
  const applicant = `${prefix}-applicant`;
  const reviewer = `${prefix}-reviewer`;
  const ids = [applicant, reviewer];
  await db
    .insert(municipalities)
    .values({ id: prefix, name: "Test municipality" });
  try {
    await db
      .insert(user)
      .values(
        ids.map((id) => ({ id, name: id, email: `${id}@example.invalid` })),
      );
    await db.insert(memberProfiles).values([
      {
        userId: applicant,
        displayName: applicant,
        municipalityId: prefix,
        cedulaStatus: "matched",
        verifiedFullName: "TEST APPLICANT",
        cedulaCiphertext: encryptSensitive("00000000000"),
        cedulaBlindIndex: prefix,
      },
      {
        userId: reviewer,
        displayName: reviewer,
        municipalityId: prefix,
        cedulaStatus: "verified",
        tier: "citizen",
        staffRole: "moderator",
        verifiedFullName: "TEST REVIEWER",
      },
    ]);
    const cookieFor = async (userId: string) => {
      const token = crypto.randomUUID();
      await db.insert(session).values({
        id: crypto.randomUUID(),
        token,
        userId,
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 3_600_000),
      });
      // Matches the installed better-call signed-cookie encoding.
      const signature = createHmac(
        "sha256",
        process.env.BETTER_AUTH_SECRET ?? "",
      )
        .update(token)
        .digest("base64");
      return {
        name: "better-auth.session_token",
        value: encodeURIComponent(`${token}.${signature}`),
        url: baseURL,
        httpOnly: true,
        sameSite: "Lax" as const,
      };
    };
    await page.context().addCookies([await cookieFor(applicant)]);
    await page.goto("/verificar");
    await expect(
      page.getByRole("heading", { name: messages.identity.documentsTitle }),
    ).toBeVisible();
    const buffer = await sharp({
      create: { width: 64, height: 64, channels: 3, background: "#234567" },
    })
      .jpeg()
      .toBuffer();
    for (const kind of ["front", "selfie"] as const)
      await page
        .getByLabel(messages.identity[kind], { exact: true })
        .setInputFiles({
          name: "invented-test-image.jpg",
          mimeType: "image/jpeg",
          buffer,
        });
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: messages.identity.send, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: messages.identity.reviewTitle }),
    ).toBeVisible();
    const context = await browser.newContext({ baseURL });
    try {
      await context.addCookies([await cookieFor(reviewer)]);
      const desk = await context.newPage();
      const errors: string[] = [];
      desk.on("pageerror", (error) => errors.push(error.message));
      await desk.goto("/moderacion/identidad");
      const card = desk
        .locator("article")
        .filter({ hasText: "TEST APPLICANT" });
      await expect(card).toBeVisible();
      const approve = card.getByRole("button", {
        name: messages.identity.desk.approve,
        exact: true,
      });
      await expect(approve).toBeDisabled();
      await card
        .getByRole("button", { name: messages.identity.desk.showDocuments })
        .click();
      await expect(approve).toBeEnabled();
      await approve.click();
      await card
        .getByRole("button", { name: messages.identity.desk.approveConfirm })
        .click();
      await expect(card).toHaveCount(0);
      expect(errors).toEqual([]);
      const [profile] = await db
        .select()
        .from(memberProfiles)
        .where(eq(memberProfiles.userId, applicant));
      expect(profile?.tier).toBe("citizen");
      expect(profile?.cedulaStatus).toBe("verified");
      const [review] = await db
        .select()
        .from(identityReviews)
        .where(eq(identityReviews.userId, applicant));
      expect(review?.documentsPurgedAt).toBeTruthy();
    } finally {
      await context.close();
    }
  } finally {
    const reviews = await db
      .select()
      .from(identityReviews)
      .where(eq(identityReviews.userId, applicant));
    for (const review of reviews)
      await purgeDocuments([
        review.frontKey,
        review.selfieKey,
        review.residenceKey,
      ]);
    await db
      .delete(identityReviews)
      .where(eq(identityReviews.municipalityId, prefix));
    await db.delete(user).where(inArray(user.id, ids));
    await db.delete(municipalities).where(eq(municipalities.id, prefix));
  }
});
