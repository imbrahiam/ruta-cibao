import { chromium, expect } from "@playwright/test";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/db";
import { categories, realtimeEvents, trafficReports } from "../src/db/schema";
import { env } from "../src/lib/env";
import { publishRealtimeEvent } from "../src/lib/realtime";

declare global {
  interface Window {
    verificationLines: google.maps.Polyline[];
  }
}

if (!["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname))
  throw new Error("Overlay verification requires a local database");
const id = crypto.randomUUID();
const categoryId = `verification-${id}`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const location = { x: -71.1707, y: 19.4075 };
const path = [location, { x: -71.171, y: 19.409 }];
try {
  await page.goto("http://localhost:3000/mapa");
  await page.waitForFunction(() => !!window.google?.maps?.Polyline);
  await page.evaluate(() => {
    const Original = google.maps.Polyline;
    window.verificationLines = [];
    google.maps.Polyline = class extends Original {
      constructor(options?: google.maps.PolylineOptions | null) {
        super(options);
        window.verificationLines.push(this);
      }
    };
  });
  await db.insert(categories).values({
    id: categoryId,
    kind: "traffic",
    name: "Verification road overlay",
    icon: "triangle-alert",
    color: "#b91c1c",
    severity: "blocking",
  });
  await db.insert(trafficReports).values({
    id,
    categoryId,
    municipalityId: "moncion",
    location,
    path,
    expiresAt: new Date(Date.now() + 600000),
  });
  await publishRealtimeEvent({
    channel: "traffic",
    subjectType: "traffic_report",
    subjectId: id,
    action: "created",
  });
  const pathLengths = () =>
    page.evaluate(() =>
      window.verificationLines
        .filter(
          (line) => line.getMap() && line.get("strokeColor") !== "#ffffff",
        )
        .map((line) => line.getPath().getLength()),
    );
  await expect.poll(pathLengths).toContain(2);
  console.log("Before selection:", await pathLengths());
  await page.evaluate(() => {
    const line = window.verificationLines.find(
      (item) =>
        item.getMap() &&
        item.get("strokeColor") !== "#ffffff" &&
        item.getPath().getLength() === 2,
    );
    if (!line) throw new Error("Fixture line not rendered");
    google.maps.event.trigger(line, "click");
  });
  await expect(page).toHaveURL(new RegExp(`reporte=${id}`));
  await expect(
    page.getByRole("heading", { name: "Verification road overlay" }),
  ).toBeVisible();
  console.log("After selection:", await pathLengths());
  await expect.poll(pathLengths, { timeout: 2000 }).toContain(2);
  await page.screenshot({ path: "/tmp/ruta-traffic-overlay-selected.png" });
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(new RegExp(`reporte=${id}`));
  await expect.poll(pathLengths).toContain(2);
  await db
    .update(trafficReports)
    .set({ status: "cleared", resolvedAt: new Date() })
    .where(eq(trafficReports.id, id));
  await publishRealtimeEvent({
    channel: "traffic",
    subjectType: "traffic_report",
    subjectId: id,
    action: "updated",
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.verificationLines.some(
          (line) =>
            line.getMap() &&
            line.get("strokeColor") === "#16a34a" &&
            line.getPath().getLength() === 2,
        ),
      ),
    )
    .toBe(true);
  await page.evaluate(() => {
    const line = window.verificationLines.find(
      (item) => item.getMap() && item.get("strokeColor") === "#16a34a",
    );
    if (!line) throw new Error("Cleared fixture line not rendered");
    google.maps.event.trigger(line, "click");
  });
  await expect(page).toHaveURL(new RegExp(`reporte=${id}`));
  await expect.poll(pathLengths).toContain(2);
  console.log(
    "PASS: opening, closing, and reopening a resolved road preserve its rendered geometry",
  );
} finally {
  await browser.close();
  await db.delete(realtimeEvents).where(eq(realtimeEvents.subjectId, id));
  await db.delete(trafficReports).where(eq(trafficReports.id, id));
  await db.delete(categories).where(eq(categories.id, categoryId));
  await pool.end();
  console.log("Removed overlay-verification fixtures");
}
