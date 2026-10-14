import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq, inArray, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import {
  auditEvents,
  memberProfiles,
  municipalities,
  rateLimitBuckets,
  user,
} from "@/db/schema";
import { hashLookup } from "@/lib/crypto";
import { requireMember } from "@/modules/access/permissions";
import { type MemberViewer, toViewer } from "@/modules/access/viewer";
import { verifyCedulaInput } from "@/modules/citizen/contracts";
import { CEDULA_HOLD_MS, verifyCedula } from "@/modules/citizen/verify-cedula";

// Never exercise the quota-limited registry from a test.
describe.skipIf(
  process.env.RUN_DB_TESTS !== "1" || process.env.JCE_USE_MOCK !== "1",
)("cedula reservation race", () => {
  const prefix = `hold-test-${crypto.randomUUID()}`;
  const holderId = `${prefix}-holder`;
  const claimantId = `${prefix}-claimant`;
  const input = verifyCedulaInput.parse({
    cedula: `999${Date.now().toString().slice(-7)}5`,
    name: "Juan Antonio Perez Martinez",
    municipalityId: prefix,
    confirmNumber: true,
  });
  const blindIndex = hashLookup("member-cedula", input.cedula);
  let viewer: MemberViewer;
  beforeAll(async () => {
    await db.insert(municipalities).values({ id: prefix, name: prefix });
    await db.insert(user).values(
      [holderId, claimantId].map((id) => ({
        id,
        name: id,
        email: `${id}@example.invalid`,
      })),
    );
    await db.insert(memberProfiles).values([
      {
        userId: holderId,
        displayName: "Test holder",
        municipalityId: prefix,
        cedulaBlindIndex: blindIndex,
        cedulaStatus: "matched",
        cedulaClaimedAt: new Date(Date.now() - CEDULA_HOLD_MS - 1000),
      },
      {
        userId: claimantId,
        displayName: "Test claimant",
        municipalityId: prefix,
      },
    ]);
    const [profile] = await db
      .select()
      .from(memberProfiles)
      .where(eq(memberProfiles.userId, claimantId));
    viewer = requireMember(toViewer(claimantId, profile));
  });
  afterAll(async () => {
    await db
      .delete(auditEvents)
      .where(inArray(auditEvents.actorUserId, [holderId, claimantId]));
    const windowMs = 24 * 60 * 60 * 1000;
    await db
      .delete(rateLimitBuckets)
      .where(
        eq(
          rateLimitBuckets.key,
          hashLookup(
            "rate-limit",
            `jce-lookup-account\0${claimantId}\0${Math.floor(Date.now() / windowMs) * windowMs}`,
          ),
        ),
      );
    await db.delete(user).where(inArray(user.id, [holderId, claimantId]));
    await db.delete(municipalities).where(eq(municipalities.id, prefix));
    await pool.end();
  });
  test("photos submitted during a lookup prevent release of an expired hold", async () => {
    let unlock = () => {};
    let locked = () => {};
    const acquired = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    const blocker = db.transaction(async (tx) => {
      await tx
        .select()
        .from(memberProfiles)
        .where(eq(memberProfiles.userId, claimantId))
        .for("update");
      locked();
      await gate;
    });
    await acquired;
    const verification = verifyCedula(viewer, input);
    try {
      let waiting = false;
      for (let attempt = 0; attempt < 100 && !waiting; attempt++) {
        const result = await db.execute<{ waiting: boolean }>(
          sql`select exists(select 1 from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock' and query like '%member_profiles%' and query like '%for update%') as waiting`,
        );
        waiting = result.rows[0]?.waiting === true;
        if (!waiting) await Bun.sleep(10);
      }
      expect(waiting).toBe(true);
      // The old implementation captured "expired" before waiting on the lock.
      await db
        .update(memberProfiles)
        .set({ cedulaStatus: "in_review" })
        .where(eq(memberProfiles.userId, holderId));
    } finally {
      unlock();
    }
    await blocker;
    expect((await verification).status).toBe("taken");
    const [holder] = await db
      .select()
      .from(memberProfiles)
      .where(eq(memberProfiles.userId, holderId));
    expect(holder?.cedulaStatus).toBe("in_review");
    expect(holder?.cedulaBlindIndex).toBe(blindIndex);
    const [claimant] = await db
      .select()
      .from(memberProfiles)
      .where(eq(memberProfiles.userId, claimantId));
    expect(claimant?.cedulaBlindIndex).toBeNull();
  });
});
