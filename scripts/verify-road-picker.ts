import { chromium, expect } from "@playwright/test";
import { desc, eq, inArray } from "drizzle-orm";
import { db, pool } from "../src/db";
import {
  auditEvents,
  categories,
  idempotencyKeys,
  memberProfiles,
  realtimeEvents,
  roads,
  trafficReports,
  user,
  verification,
} from "../src/db/schema";
import { env } from "../src/lib/env";
import { pathLength } from "../src/lib/map/road-geometry";
import { isSmsConfigured } from "../src/lib/sms";

declare global {
  interface Window {
    pickerLines: google.maps.Polyline[];
    pickerMap?: google.maps.Map;
  }
}

if (
  !["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname) ||
  isSmsConfigured() ||
  env.VAPID_PRIVATE_KEY
)
  throw new Error(
    "Picker verification requires a local database and disabled SMS/push delivery",
  );

const runId = crypto.randomUUID();
const ids = [`picker-west-${runId}`, `picker-east-${runId}`];
const anchor = { lng: -71.171, lat: 19.4075 };
const browser = await chromium.launch();
const userIds: string[] = [];
const reportIds: string[] = [];
const categoryIds: string[] = [];
const phones: string[] = [];
try {
  await db.insert(roads).values(
    ids.map((id, index) => ({
      id,
      name: `Verification ${index === 0 ? "west" : "east"} road`,
      kind: "residential",
      path: [
        { x: anchor.lng + index * 0.0001, y: anchor.lat - 0.003 },
        { x: anchor.lng + index * 0.0001, y: anchor.lat + 0.003 },
      ],
    })),
  );

  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 },
      isMobile: mobile,
      hasTouch: mobile,
      geolocation: { longitude: anchor.lng, latitude: anchor.lat },
      permissions: ["geolocation"],
    });
    const page = await context.newPage();
    await page.goto("http://localhost:3000/entrar");
    const phone = `+180955501${String(Math.floor(Math.random() * 100)).padStart(2, "0")}`;
    if (
      (
        await db
          .select({ id: user.id })
          .from(user)
          .where(eq(user.phoneNumber, phone))
      ).length
    )
      throw new Error("Fixture phone is already in use; run again");
    phones.push(phone);
    expect(
      await page.evaluate(
        async (phoneNumber) =>
          (
            await fetch("/api/auth/phone-number/send-otp", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ phoneNumber }),
            })
          ).ok,
        phone,
      ),
    ).toBe(true);
    const [otp] = await db
      .select({ value: verification.value })
      .from(verification)
      .where(eq(verification.identifier, phone))
      .orderBy(desc(verification.createdAt))
      .limit(1);
    if (!otp) throw new Error("Fixture OTP missing");
    expect(
      await page.evaluate(
        async (input) =>
          (
            await fetch("/api/auth/phone-number/verify", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(input),
            })
          ).ok,
        { phoneNumber: phone, code: otp.value.split(":")[0] },
      ),
    ).toBe(true);
    const [account] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.phoneNumber, phone));
    if (!account) throw new Error("Fixture account missing");
    userIds.push(account.id);
    await db
      .update(memberProfiles)
      .set({ residencyDeclaredAt: new Date() })
      .where(eq(memberProfiles.userId, account.id));
    const categoryId = `picker-${mobile ? "mobile" : "desktop"}-${runId}`;
    categoryIds.push(categoryId);
    await db.insert(categories).values({
      id: categoryId,
      name: `Verification picker ${mobile ? "mobile" : "desktop"} ${runId}`,
      kind: "traffic",
      severity: "blocking",
      icon: "triangle-alert",
      color: "#dc2626",
    });
    const errors: string[] = [];
    const lookups: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (request.url().includes("streetAt"))
        lookups.push(request.postData() ?? "");
    });
    await page.goto("http://localhost:3000/mapa");
    await page.waitForFunction(() => !!window.google?.maps?.Polyline);
    await page.evaluate(() => {
      const Original = google.maps.Polyline;
      const setZoom = google.maps.Map.prototype.setZoom;
      google.maps.Map.prototype.setZoom = function (
        this: google.maps.Map,
        ...args: Parameters<google.maps.Map["setZoom"]>
      ) {
        window.pickerMap = this;
        setZoom.apply(this, args);
      };
      window.pickerLines = [];
      google.maps.Polyline = class extends Original {
        constructor(options?: google.maps.PolylineOptions | null) {
          super(options);
          window.pickerLines.push(this);
          if (options?.map instanceof google.maps.Map)
            window.pickerMap = options.map;
        }
      };
    });
    await page
      .getByRole("button", { name: "Más opciones", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "Reportar tránsito", exact: true })
      .click();
    await page.waitForFunction(() => !!window.pickerMap);

    await page.evaluate(async (point) => {
      const map = window.pickerMap;
      if (!(map instanceof google.maps.Map)) throw new Error("No picker map");
      await new Promise<void>((resolve) => {
        google.maps.event.addListenerOnce(map, "idle", () => resolve());
        map.setZoom(18);
        map.setCenter(point);
      });
    }, anchor);
    await expect
      .poll(() => page.evaluate(() => window.pickerMap?.getZoom()))
      .toBe(18);
    await page.waitForFunction(
      (lng) =>
        window.pickerLines.some(
          (line) =>
            line.getMap() &&
            line.get("strokeWeight") === 12 &&
            Math.abs((line.getPath().getAt(0)?.lng() ?? 0) - lng) < 0.000001,
        ),
      anchor.lng,
    );
    await expect(
      page.getByRole("button", { name: "Centrar donde estoy", exact: true }),
    ).toBeEnabled();

    const target = await page.evaluate(
      (point) => {
        const map = window.pickerMap;
        if (!(map instanceof google.maps.Map)) throw new Error("No picker map");
        const projection = map.getProjection();
        const center = map.getCenter();
        if (!projection || !center) throw new Error("Map projection not ready");
        const from = projection.fromLatLngToPoint(center);
        const to = projection.fromLatLngToPoint(new google.maps.LatLng(point));
        if (!from || !to) throw new Error("Projection failed");
        const bounds = map.getDiv().getBoundingClientRect();
        const scale = 2 ** (map.getZoom() ?? 18);
        return {
          x: bounds.left + bounds.width / 2 + (to.x - from.x) * scale,
          y: bounds.top + bounds.height / 2 + (to.y - from.y) * scale,
        };
      },
      { lng: anchor.lng + 0.0001, lat: anchor.lat + 0.0004 },
    );
    await page.mouse.click(target.x, target.y);
    await expect(
      page.getByText("Verification east road", { exact: true }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "150 m", exact: true }).click();
    await expect(
      page.getByText("Se marcarán 150 m de esta vía", { exact: true }),
    ).toBeVisible();
    expect(
      lookups.some((input) => input.includes(ids[1] ?? "missing")),
      `Selected road identity must reach preview: ${lookups.join("; ")}`,
    ).toBe(true);

    if (!mobile) {
      const before = lookups.length;
      await page.mouse.move(target.x - 10, target.y - 30, { steps: 30 });
      await page.mouse.move(target.x + 10, target.y + 30, { steps: 30 });
      expect(lookups.length).toBe(before);
    }
    await page.getByText("¿Es otra vía cercana?", { exact: true }).click();
    await page.getByRole("button", { name: /Verification west road/ }).click();
    await expect(
      page.getByText("Verification west road", { exact: true }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Usar este tramo", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "¿Qué está pasando en la vía?" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "¿Qué está pasando en la vía?" }),
    ).toBeInViewport();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.pickerLines
            .filter(
              (line) =>
                line.getMap() &&
                line.get("strokeOpacity") === 1 &&
                line.get("strokeColor") !== "#ffffff",
            )
            .some((line) => line.getPath().getLength() >= 2),
        ),
      )
      .toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      "The picker must fit the viewport",
    ).toBe(true);
    expect(errors).toEqual([]);
    await page.screenshot({
      path: `/tmp/ruta-road-picker-${mobile ? "mobile" : "desktop"}.png`,
      animations: "disabled",
    });
    await page
      .getByRole("combobox", { name: "¿Qué pasó?", exact: true })
      .selectOption(categoryId);
    await page
      .getByRole("button", { name: "Publicar el reporte", exact: true })
      .click();
    await expect(
      page.getByText("Listo. Ya lo ven los demás.", { exact: true }),
    ).toBeVisible();
    const [saved] = await db
      .select()
      .from(trafficReports)
      .where(eq(trafficReports.categoryId, categoryId));
    if (!saved) throw new Error("Traffic submission was not persisted");
    reportIds.push(saved.id);
    expect(saved.location.x).toBeCloseTo(anchor.lng, 6);
    expect(
      saved.path?.every((point) => Math.abs(point.x - anchor.lng) < 0.000001),
    ).toBe(true);
    expect(
      Math.round(
        pathLength(
          (saved.path ?? []).map((point) => ({ lng: point.x, lat: point.y })),
        ),
      ),
    ).toBe(150);
    const [audit] = await db
      .select({ metadata: auditEvents.metadata })
      .from(auditEvents)
      .where(eq(auditEvents.subjectId, saved.id));
    expect(audit?.metadata).toMatchObject({
      roadId: ids[0],
      extentMeters: 150,
    });
    console.log(
      `PASS: ${mobile ? "mobile" : "desktop"} road click, 150 m extent, alternative road, persistent form preview, saved geometry and audit${mobile ? "" : ", no hover HTTP lookups"}`,
    );
    await context.close();
  }
} finally {
  await browser.close();
  if (phones.length) {
    const created = await db
      .select({ id: user.id })
      .from(user)
      .where(inArray(user.phoneNumber, phones));
    userIds.push(...created.map((row) => row.id));
  }
  if (categoryIds.length) {
    const saved = await db
      .select({ id: trafficReports.id })
      .from(trafficReports)
      .where(inArray(trafficReports.categoryId, categoryIds));
    const subjects = [...reportIds, ...saved.map((row) => row.id)];
    if (subjects.length)
      await db
        .delete(realtimeEvents)
        .where(inArray(realtimeEvents.subjectId, subjects));
    await db
      .delete(trafficReports)
      .where(inArray(trafficReports.categoryId, categoryIds));
    await db.delete(categories).where(inArray(categories.id, categoryIds));
  }
  if (userIds.length) {
    await db
      .delete(idempotencyKeys)
      .where(inArray(idempotencyKeys.userId, userIds));
    await db
      .delete(auditEvents)
      .where(inArray(auditEvents.actorUserId, userIds));
    await db.delete(user).where(inArray(user.id, userIds));
  }
  if (phones.length)
    await db
      .delete(verification)
      .where(inArray(verification.identifier, phones));
  await db.delete(roads).where(inArray(roads.id, ids));
  await pool.end();
  console.log("Removed picker-verification fixtures");
}
