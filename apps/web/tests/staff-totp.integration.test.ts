import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { createHmac } from "node:crypto";
import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { call } from "@orpc/server";
import { eq, inArray } from "drizzle-orm";
import {
  GET as getAuthRoute,
  POST as postAuthRoute,
} from "@/app/api/auth/[...all]/route";
import { db } from "@/db";
import {
  auditEvents,
  municipalities,
  rollingRateLimits,
  staffSessionVerifications,
  twoFactor,
  user,
  weeklyReports,
} from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { hashLookup } from "@/lib/crypto";
import { getRequestClientKey } from "@/lib/rate-limit";
import {
  assertStaffSessionVerified,
  revokeUserStaffSessions,
} from "@/modules/access/staff-session";
import type { MemberViewer } from "@/modules/access/viewer";
import { meRouter } from "@/orpc/routers/me";
import { moderationRouter } from "@/orpc/routers/moderation";
import { reportsRouter } from "@/orpc/routers/reports";
import { staffRouter } from "@/orpc/routers/staff";
import {
  assertDedicatedLocalDatabase,
  auditsFor,
  createMember,
} from "./support/test-db";

mock.module("@/lib/web-cache", () => ({
  refreshPublicCaches: async () => true,
  PUBLIC_CACHE_TAGS: [],
  internalToken: () => "test",
  isInternalToken: () => false,
}));

function extractSecretFromTotpUri(totpUri: string): string {
  const url = new URL(totpUri);
  const encoded = url.searchParams.get("secret");
  if (!encoded) throw new Error("Missing secret in totpURI");
  return new TextDecoder().decode(base32.decode(encoded));
}

describe.skipIf(process.env.RUN_DB_TESTS !== "1")(
  "staff TOTP step-up, raw auth-admin rejection, and scoped report generation",
  () => {
    const prefix = `staff-totp-${crypto.randomUUID().slice(0, 8)}`;
    const townA = `${prefix}-town-a`;
    const townB = `${prefix}-town-b`;
    const accounts: string[] = [];
    let guarded = false;

    beforeAll(async () => {
      assertDedicatedLocalDatabase();
      guarded = true;
      // Step-up windows persist across runs. Without this, a second run starts
      // with the bucket already spent and fails for a reason that has nothing
      // to do with the code under test.
      const client = getRequestClientKey(new Headers());
      await db
        .delete(rollingRateLimits)
        .where(
          eq(
            rollingRateLimits.key,
            hashLookup("rolling-rate-limit", `staff-step-up-client\0${client}`),
          ),
        );
      await db.insert(municipalities).values([
        { id: townA, name: `Municipio A ${prefix}` },
        { id: townB, name: `Municipio B ${prefix}` },
      ]);
    });

    afterAll(async () => {
      if (!guarded) return;
      await db
        .delete(weeklyReports)
        .where(inArray(weeklyReports.municipalityId, [townA, townB]));
      await db
        .delete(auditEvents)
        .where(inArray(auditEvents.actorUserId, accounts));
      await db
        .delete(auditEvents)
        .where(inArray(auditEvents.municipalityId, [townA, townB]));
      await db.delete(user).where(inArray(user.id, accounts));
      await db
        .delete(municipalities)
        .where(inArray(municipalities.id, [townA, townB]));
    });

    async function createRealSession(userId: string) {
      const auth = getAuth();
      const authCtx = await auth.$context;
      const created = await authCtx.internalAdapter.createSession(
        userId,
        false,
      );
      const cookie = authCtx.authCookies.sessionToken;
      const signature = createHmac("sha256", authCtx.secret)
        .update(created.token)
        .digest("base64");
      const signed = `${created.token}.${signature}`;
      const headers = new Headers({
        cookie: `${cookie.name}=${encodeURIComponent(signed)}`,
      });
      return { sessionRow: created, headers };
    }

    function realStaffContext(
      viewer: MemberViewer,
      sessionInfo: { id: string; createdAt: Date },
      headers: Headers,
    ) {
      const resolved = {
        viewer,
        session: sessionInfo,
        contact: {
          phoneNumber: null,
          phoneVerified: false,
          email: `${viewer.userId}@example.invalid`,
          emailVerified: true,
          twoFactorEnabled: true,
        },
      };
      return {
        db,
        requestId: "test-request",
        headers,
        getViewer: async () => viewer,
        getSession: async () => resolved,
        requireStaffSession: async () => {
          await assertStaffSessionVerified(resolved);
        },
      };
    }

    test("denies staff procedures without a verified staff session and grants session-bound access after TOTP or recovery code step-up", async () => {
      const mod = await createMember(prefix, {
        municipalityId: townA,
        staff: { role: "moderator", municipalityId: townA },
      });
      accounts.push(mod.id);

      const { sessionRow: session1, headers: headers1 } =
        await createRealSession(mod.id);
      const { sessionRow: session2, headers: headers2 } =
        await createRealSession(mod.id);

      const ctx1 = realStaffContext(
        mod.viewer,
        { id: session1.id, createdAt: session1.createdAt },
        headers1,
      );
      const ctx2 = realStaffContext(
        mod.viewer,
        { id: session2.id, createdAt: session2.createdAt },
        headers2,
      );

      // Before enrolling TOTP, step-up is rejected and moderator endpoints are blocked.
      await expect(
        call(staffRouter.verifyTotp, { code: "123456" }, { context: ctx1 }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        data: { reason: "totp_enrollment_required" },
      });

      await expect(
        call(moderationRouter.queue, { queue: "places" }, { context: ctx1 }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        data: { reason: "staff_step_up_required" },
      });

      // Enroll TOTP via Better Auth passwordless 2FA.
      const auth = getAuth();
      const enrolled = await auth.api.enableTwoFactor({
        headers: headers1,
        body: {},
      });
      if (!("totpURI" in enrolled)) {
        throw new Error("Expected TOTP enrollment response");
      }
      const secret = extractSecretFromTotpUri(enrolled.totpURI);
      const totpCode = await createOTP(secret, {
        digits: 6,
        period: 30,
      }).totp();

      // Complete enrollment verification so twoFactor.verified & user.twoFactorEnabled become true.
      await auth.api.verifyTOTP({
        headers: headers1,
        body: { code: totpCode },
      });

      // Even with twoFactorEnabled=true on the account, a session without staff.verifyTotp is still denied.
      const { sessionRow: sessionAfterEnroll, headers: headersAfterEnroll } =
        await createRealSession(mod.id);
      // Once enrolled, the session alone can no longer read or replace the secret.
      for (const attempt of [
        () => auth.api.getTOTPURI({ headers: headersAfterEnroll, body: {} }),
        () =>
          auth.api.enableTwoFactor({ headers: headersAfterEnroll, body: {} }),
        () =>
          auth.api.generateBackupCodes({
            headers: headersAfterEnroll,
            body: {},
          }),
        () =>
          auth.api.disableTwoFactor({ headers: headersAfterEnroll, body: {} }),
      ]) {
        await expect(attempt()).rejects.toMatchObject({
          body: { code: "TWO_FACTOR_ALREADY_ENROLLED" },
        });
      }
      const ctxAfterEnroll = realStaffContext(
        mod.viewer,
        {
          id: sessionAfterEnroll.id,
          createdAt: sessionAfterEnroll.createdAt,
        },
        headersAfterEnroll,
      );

      await expect(
        call(
          moderationRouter.queue,
          { queue: "places" },
          { context: ctxAfterEnroll },
        ),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        data: { reason: "staff_step_up_required" },
      });

      // Invalid TOTP code is rejected and does not grant a staff session.
      await expect(
        call(
          staffRouter.verifyTotp,
          { code: "000000" },
          { context: ctxAfterEnroll },
        ),
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        data: { reason: "invalid_code" },
      });

      // Valid TOTP code grants an 8-hour session-bound verification and audits it.
      const stepUpResult = await call(
        staffRouter.verifyTotp,
        { code: totpCode },
        { context: ctxAfterEnroll },
      );
      expect(new Date(stepUpResult.verifiedUntil).getTime()).toBeGreaterThan(
        Date.now() + 7 * 60 * 60 * 1_000,
      );

      const totpAudits = await auditsFor(mod.id, "staff.session_verified_totp");
      expect(totpAudits.length).toBe(1);

      // Now ctxAfterEnroll can call moderator endpoints, while ctx2 (another session for same user) cannot.
      const queue = await call(
        moderationRouter.queue,
        { queue: "places" },
        { context: ctxAfterEnroll },
      );
      expect(queue).toBeDefined();

      await expect(
        call(moderationRouter.queue, { queue: "places" }, { context: ctx2 }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        data: { reason: "staff_step_up_required" },
      });

      // Recovery code step-up on session 2 consumes the backup code once and grants access.
      const recoveryCode = enrolled.backupCodes[0];
      if (!recoveryCode) throw new Error("Missing backup code");

      const recoveryResult = await call(
        staffRouter.verifyRecoveryCode,
        { code: recoveryCode },
        { context: ctx2 },
      );
      expect(new Date(recoveryResult.verifiedUntil).getTime()).toBeGreaterThan(
        Date.now() + 7 * 60 * 60 * 1_000,
      );

      const recoveryAudits = await auditsFor(
        mod.id,
        "staff.session_verified_recovery_code",
      );
      expect(recoveryAudits.length).toBe(1);

      // Reusing the same recovery code is rejected.
      await expect(
        call(
          staffRouter.verifyRecoveryCode,
          { code: recoveryCode },
          { context: ctx2 },
        ),
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        data: { reason: "invalid_code" },
      });

      // Role change invalidates all existing staff_session_verifications for the user.
      await revokeUserStaffSessions(db, mod.id);
      const remainingGrants = await db
        .select()
        .from(staffSessionVerifications)
        .where(
          inArray(staffSessionVerifications.sessionId, [
            sessionAfterEnroll.id,
            session2.id,
          ]),
        );
      expect(remainingGrants.length).toBe(0);

      await expect(
        call(
          moderationRouter.queue,
          { queue: "places" },
          { context: ctxAfterEnroll },
        ),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        data: { reason: "staff_step_up_required" },
      });
    });

    test("enforces staff municipality scope on reports.generate even after personal municipality update and rejects raw /api/auth/admin/*", async () => {
      const modA = await createMember(prefix, {
        municipalityId: townA,
        staff: { role: "moderator", municipalityId: townA },
      });
      const adminUser = await createMember(prefix, {
        municipalityId: townA,
        staff: { role: "admin" },
      });
      accounts.push(modA.id, adminUser.id);

      const { sessionRow: modSession, headers: modHeaders } =
        await createRealSession(modA.id);
      const { sessionRow: adminSession, headers: adminHeaders } =
        await createRealSession(adminUser.id);

      // Grant verified staff sessions for both.
      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1_000);
      await db.insert(staffSessionVerifications).values([
        { sessionId: modSession.id, expiresAt },
        { sessionId: adminSession.id, expiresAt },
      ]);
      await db.insert(twoFactor).values([
        {
          id: crypto.randomUUID(),
          userId: modA.id,
          secret: "secret",
          backupCodes: "[]",
          verified: true,
        },
        {
          id: crypto.randomUUID(),
          userId: adminUser.id,
          secret: "secret",
          backupCodes: "[]",
          verified: true,
        },
      ]);

      // Moderator changes personal municipality to townB; staff jurisdiction must stay townA.
      await call(
        meRouter.updateProfile,
        {
          requestId: crypto.randomUUID(),
          displayName: "Moderador Town A",
          municipalityId: townB,
        },
        {
          context: realStaffContext(
            modA.viewer,
            { id: modSession.id, createdAt: modSession.createdAt },
            modHeaders,
          ),
        },
      );

      const modCtx = realStaffContext(
        modA.viewer,
        { id: modSession.id, createdAt: modSession.createdAt },
        modHeaders,
      );
      const adminCtx = realStaffContext(
        adminUser.viewer,
        { id: adminSession.id, createdAt: adminSession.createdAt },
        adminHeaders,
      );

      // Moderator cannot generate a weekly report for townB.
      await expect(
        call(
          reportsRouter.generate,
          { requestId: crypto.randomUUID(), municipalityId: townB },
          { context: modCtx },
        ),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        data: { reason: "municipality_scope" },
      });

      // Moderator can generate for townA; repeating for the same period returns the same reportId.
      const gen1 = await call(
        reportsRouter.generate,
        { requestId: crypto.randomUUID(), municipalityId: townA },
        { context: modCtx },
      );
      const gen2 = await call(
        reportsRouter.generate,
        { requestId: crypto.randomUUID(), municipalityId: townA },
        { context: modCtx },
      );
      expect(gen1.reportId).toBe(gen2.reportId);

      // Admin can generate for townB.
      const genAdmin = await call(
        reportsRouter.generate,
        { requestId: crypto.randomUUID(), municipalityId: townB },
        { context: adminCtx },
      );
      expect(genAdmin.reportId).not.toBe(gen1.reportId);

      // Raw Better Auth admin endpoints are rejected (404) regardless of session or path encoding.
      for (const path of [
        "http://localhost:3000/api/auth/admin/list-users",
        "http://localhost:3000/api/auth/admin/set-role",
        "http://localhost:3000/api/auth//admin/ban-user",
        "http://localhost:3000/api/auth/%2Fadmin/remove-user",
        // Password and profile endpoints the app never uses.
        "http://localhost:3000/api/auth/email-otp/request-password-reset",
        "http://localhost:3000/api/auth/phone-number/request-password-reset",
        "http://localhost:3000/api/auth/update-user",
        "http://localhost:3000/api/auth/Update-User/",
      ]) {
        const getRes = await getAuthRoute(
          new Request(path, { headers: adminHeaders }),
        );
        expect(getRes.status).toBe(404);
        const postRes = await postAuthRoute(
          new Request(path, { method: "POST", headers: adminHeaders }),
        );
        expect(postRes.status).toBe(404);
      }
    });
  },
);
