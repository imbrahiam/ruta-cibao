import { expect } from "bun:test";
import { createRouterClient } from "@orpc/server";
import { eq, inArray, sql } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { db, pool } from "@/db";
import {
  auditEvents,
  businessClaims,
  categories,
  consultations,
  ecoRoutes,
  idempotencyKeys,
  memberProfiles,
  municipalities,
  notifications,
  places,
  realtimeEvents,
  trafficReports,
  user,
  weeklyReports,
} from "@/db/schema";
import { env } from "@/lib/env";
import { createReadUrl, deleteObject } from "@/lib/storage";
import { toViewer, type Viewer } from "@/modules/access/viewer";
import { renderWeeklyReportPdf } from "@/modules/reports/render-pdf";
import {
  buildWeeklyReport,
  computeMetrics,
  previousWeekStart,
} from "@/modules/reports/weekly";
import { router } from "@/orpc/router";

if (
  !env.JCE_USE_MOCK ||
  !["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname) ||
  !["localhost", "127.0.0.1"].includes(new URL(env.S3_ENDPOINT).hostname)
)
  throw new Error(
    "Feature verification requires local storage/database and JCE_USE_MOCK=1",
  );

const runId = crypto.randomUUID();
const fixtureUsers: string[] = [];
const fixtureSubjects: string[] = [];
const fixtureCategories: string[] = [];
const storageKeys: string[] = [];
const areaId = `verification-${runId}`;
const key = () => crypto.randomUUID();
function clientFor(viewer: Viewer, expectedUser?: string) {
  return createRouterClient(router, {
    context: {
      db,
      headers: new Headers(
        expectedUser ? { "x-expected-user-id": expectedUser } : {},
      ),
      getViewer: async () => viewer,
    },
  });
}

async function account(
  role: "visitor" | "citizen" | "admin" | "moderator",
  municipalityId = "moncion",
) {
  const id = key();
  fixtureUsers.push(id);
  await db.insert(user).values({
    id,
    name: "Verification Fixture",
    email: `${id}@example.invalid`,
  });
  const [profile] = await db
    .insert(memberProfiles)
    .values({
      userId: id,
      displayName: "Verification Fixture",
      municipalityId: role === "visitor" ? null : municipalityId,
      tier: role === "visitor" ? "visitor" : "citizen",
      cedulaStatus: role === "visitor" ? "none" : "verified",
      verifiedFullName: role === "visitor" ? null : "Verification Fixture",
      staffRole: role === "admin" || role === "moderator" ? role : "none",
    })
    .returning();
  return toViewer(id, profile);
}

try {
  const visitor = await account("visitor");
  const citizen = await account("citizen");
  const otherCitizen = await account("citizen");
  const admin = await account("admin");
  const wrongMunicipality = await account("moderator", "sabaneta");
  const anonApi = clientFor({ kind: "anonymous" });
  const visitorApi = clientFor(visitor);
  const citizenApi = clientFor(citizen);
  const secondApi = clientFor(otherCitizen);
  const adminApi = clientFor(admin);
  const outsideApi = clientFor(wrongMunicipality);
  const position = { lng: -71.1707, lat: 19.4075 };
  const bounds = { west: -71.9, east: -70.9, south: 19.0, north: 19.8 };

  const category = {
    requestId: key(),
    kind: "consultation" as const,
    name: `Verification topic ${runId}`,
    icon: "droplets" as const,
    color: "#166534",
    severity: null,
    sortOrder: 999,
    isActive: true,
  };
  await expect(visitorApi.catalog.save(category)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(outsideApi.catalog.save(category)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  const topic = await adminApi.catalog.save(category);
  fixtureCategories.push(topic.id);
  expect(await adminApi.catalog.save(category)).toEqual(topic);
  expect(
    (await anonApi.consultations.categories()).some(
      (row) => row.id === topic.id,
    ),
  ).toBe(true);
  console.log(
    "PASS: admin taxonomy, public options, authorization and idempotency",
  );

  const routeCategory = (await anonApi.routes.categories())[0];
  if (!routeCategory) throw new Error("Seed the route categories first");
  const routeInput = {
    requestId: key(),
    name: `Verification route ${runId}`,
    description:
      "A local verification trail with clear access instructions and two distinct waypoints.",
    categoryId: routeCategory.id,
    path: [position, { lng: -71.171, lat: 19.409 }],
    durationMinutes: 30,
    difficulty: "easy" as const,
    services: ["water" as const],
  };
  const route = await visitorApi.routes.submit(routeInput);
  fixtureSubjects.push(route.id);
  expect(await visitorApi.routes.submit(routeInput)).toEqual(route);
  await expect(anonApi.routes.detail({ id: route.id })).rejects.toMatchObject({
    code: "UNAUTHORIZED",
  });
  await expect(
    outsideApi.routes.decide({
      requestId: key(),
      id: route.id,
      status: "published",
      note: "Verified for the local test.",
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await adminApi.routes.decide({
    requestId: key(),
    id: route.id,
    status: "published",
    note: "Verified for the local test.",
  });
  const publicRoute = await anonApi.routes.detail({ id: route.id });
  expect(publicRoute.distanceMeters).toBeGreaterThan(100);
  expect(
    (await anonApi.routes.map(bounds)).features.some(
      (feature) =>
        feature.kind === "route" &&
        feature.id === route.id &&
        feature.path?.length === 2,
    ),
  ).toBe(true);
  console.log(
    "PASS: route drawing persistence, measured distance, moderation scope and map geometry",
  );

  await expect(
    visitorApi.consultations.open({
      requestId: key(),
      categoryId: topic.id,
      title: "Verification community case",
      body: "A detailed local verification issue that should appear on the citizen map.",
      location: position,
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  const caseInput = {
    requestId: key(),
    categoryId: topic.id,
    title: `Verification case ${runId}`,
    body: "A detailed local verification issue that should appear on the citizen map.",
    location: position,
  };
  const issue = await citizenApi.consultations.open(caseInput);
  fixtureSubjects.push(issue.id);
  expect(await citizenApi.consultations.open(caseInput)).toEqual(issue);
  const supported = await secondApi.consultations.support({
    consultationId: issue.id,
    supported: true,
  });
  expect(supported.supportCount).toBe(2);
  expect(
    (
      await secondApi.consultations.support({
        consultationId: issue.id,
        supported: true,
      })
    ).supportCount,
  ).toBe(2);
  expect(
    (await anonApi.routes.map(bounds)).features.some(
      (feature) => feature.id === issue.slug,
    ),
  ).toBe(true);
  await expect(
    outsideApi.consultations.respond({
      requestId: key(),
      consultationId: issue.id,
      body: "A reply from the wrong municipality.",
      statusAfter: "in_review",
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await adminApi.consultations.respond({
    requestId: key(),
    consultationId: issue.id,
    body: "The local verification case has been resolved.",
    statusAfter: "resolved",
  });
  expect(
    (await anonApi.consultations.detail({ slug: issue.slug })).responses,
  ).toHaveLength(1);
  await adminApi.catalog.save({
    ...category,
    requestId: key(),
    id: topic.id,
    isActive: false,
  });
  expect(
    (await anonApi.consultations.categories()).some(
      (row) => row.id === topic.id,
    ),
  ).toBe(false);
  expect(
    (await anonApi.consultations.detail({ slug: issue.slug })).categoryName,
  ).toBe(category.name);
  console.log(
    "PASS: located cases, one vote per account, official response, notifications and archived topics",
  );

  const businessCategory = (await anonApi.places.categories()).find(
    (row) => row.kind === "business",
  );
  if (!businessCategory) throw new Error("Seed the business categories first");
  const listing = await visitorApi.places.submit({
    requestId: key(),
    name: `Verification storefront ${runId}`,
    description:
      "A fixture business with public contact details and opening hours.",
    categoryId: businessCategory.id,
    location: { lng: -71.17, lat: 19.403 },
    business: {
      contactPhone: "8095550100",
      whatsapp: "",
      openingHours: "Monday 09:00–17:00",
    },
  });
  fixtureSubjects.push(listing.id);
  await adminApi.moderation.decidePlace({
    requestId: key(),
    placeId: listing.id,
    decision: "publish",
  });
  expect(
    (await anonApi.businesses.claimState({ placeId: listing.id })).openingHours,
  ).toBe("Monday 09:00–17:00");
  const claim = await citizenApi.businesses.claim({
    requestId: key(),
    placeId: listing.id,
    evidence: "The sign identifies this local verification business.",
    contactPhone: "8095550100",
    whatsapp: "",
    openingHours: "Monday 09:00–17:00",
  });
  fixtureSubjects.push(claim.id);
  await adminApi.moderation.decideClaim({
    requestId: key(),
    claimId: claim.id,
    decision: "approve",
  });
  await expect(
    secondApi.businesses.update({
      requestId: key(),
      placeId: listing.id,
      openingHours: "Closed",
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await citizenApi.businesses.update({
    requestId: key(),
    placeId: listing.id,
    openingHours: "Tuesday 10:00–18:00",
  });
  expect(
    (await anonApi.businesses.claimState({ placeId: listing.id })).openingHours,
  ).toBe("Tuesday 10:00–18:00");
  console.log(
    "PASS: business registration, contact, owner verification and authorized editing",
  );

  const trafficCategory = (await anonApi.traffic.categories())[0];
  if (!trafficCategory) throw new Error("Seed traffic categories first");
  const alertInput = {
    requestId: key(),
    observedAt: new Date().toISOString(),
    categoryId: trafficCategory.id,
    location: { lng: -71.171, lat: 19.414 },
    shape: "point" as const,
    description: "Local verification road alert",
  };
  const alert = await visitorApi.traffic.report(alertInput);
  fixtureSubjects.push(alert.id);
  expect(await visitorApi.traffic.report(alertInput)).toEqual(alert);
  expect(
    (await anonApi.traffic.active(bounds)).some((row) => row.id === alert.id),
  ).toBe(true);
  await citizenApi.traffic.confirm({ reportId: alert.id, verdict: "cleared" });
  await secondApi.traffic.confirm({ reportId: alert.id, verdict: "cleared" });
  const [resolved] = await db
    .select({ status: trafficReports.status })
    .from(trafficReports)
    .where(eq(trafficReports.id, alert.id));
  expect(resolved?.status).toBe("cleared");
  await expect(
    visitorApi.traffic.report({
      ...alertInput,
      requestId: key(),
      observedAt: "2020-01-01T00:00:00.000Z",
    }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  console.log(
    "PASS: live alerts, retry safety, community clearance and stale offline rejection",
  );

  await db
    .insert(municipalities)
    .values({ id: areaId, name: "Verification Municipality" });
  const start = previousWeekStart();
  await db.insert(auditEvents).values({
    action: "route.submitted",
    subjectType: "verification",
    subjectId: runId,
    municipalityId: areaId,
    createdAt: new Date(start.getTime() + 3600000),
  });
  const metrics = await computeMetrics(
    areaId,
    start,
    new Date(start.getTime() + 604800000),
  );
  expect(metrics.routes.submitted).toBe(1);
  const report = await buildWeeklyReport(areaId, start);
  fixtureSubjects.push(report.id);
  const pdf = await renderWeeklyReportPdf(report.id);
  storageKeys.push(pdf.storageKey);
  expect(await renderWeeklyReportPdf(report.id)).toEqual(pdf);
  const response = await fetch(await createReadUrl(pdf.storageKey));
  expect(response.ok).toBe(true);
  const document = await PDFDocument.load(await response.arrayBuffer());
  expect(document.getPageCount()).toBeGreaterThan(0);
  expect(document.getTitle()).toContain("Verification Municipality");
  await expect(
    anonApi.reports.detail({ reportId: report.id }),
  ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  expect(
    (await adminApi.reports.detail({ reportId: report.id })).pdfUrl,
  ).toBeTruthy();
  console.log(
    "PASS: frozen weekly metrics, valid PDF in object storage, idempotent render and private download",
  );
  const events = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(realtimeEvents)
    .where(inArray(realtimeEvents.subjectId, fixtureSubjects));
  expect(events[0]?.count).toBeGreaterThan(4);
  const notices = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(inArray(notifications.userId, fixtureUsers));
  expect(notices[0]?.count).toBeGreaterThan(2);
  console.log(
    "PASS: persisted realtime events and recipient notifications across modules",
  );
} finally {
  for (const storageKey of storageKeys) await deleteObject(storageKey);
  if (fixtureSubjects.length) {
    await db
      .delete(trafficReports)
      .where(inArray(trafficReports.id, fixtureSubjects));
    await db
      .delete(businessClaims)
      .where(inArray(businessClaims.id, fixtureSubjects));
    await db
      .delete(consultations)
      .where(inArray(consultations.id, fixtureSubjects));
    await db.delete(ecoRoutes).where(inArray(ecoRoutes.id, fixtureSubjects));
    await db.delete(places).where(inArray(places.id, fixtureSubjects));
    await db
      .delete(weeklyReports)
      .where(inArray(weeklyReports.id, fixtureSubjects));
    await db
      .delete(realtimeEvents)
      .where(inArray(realtimeEvents.subjectId, fixtureSubjects));
  }
  await db.delete(auditEvents).where(eq(auditEvents.municipalityId, areaId));
  await db.delete(municipalities).where(eq(municipalities.id, areaId));
  if (fixtureCategories.length)
    await db
      .delete(categories)
      .where(inArray(categories.id, fixtureCategories));
  if (fixtureUsers.length) {
    await db
      .delete(idempotencyKeys)
      .where(inArray(idempotencyKeys.userId, fixtureUsers));
    await db
      .delete(auditEvents)
      .where(inArray(auditEvents.actorUserId, fixtureUsers));
    await db.delete(user).where(inArray(user.id, fixtureUsers));
  }
  await pool.end();
  console.log("Removed feature-verification fixtures");
}
