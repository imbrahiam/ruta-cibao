import { expect, test } from "bun:test";
import { inflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { renderReportDocument } from "@/modules/reports/render-pdf";

/**
 * The weekly report is the artifact an official forwards to somebody else.
 * It has to be a real PDF, carry its figures as a machine-readable attachment,
 * and survive a business name with a character the standard font cannot draw.
 */
test("the weekly report is a PDF that carries its figures and survives odd names", async () => {
  const bytes = await renderReportDocument({
    municipalityName: "Sabaneta 😀",
    periodStart: new Date("2026-10-19T00:00:00.000Z"),
    periodEnd: new Date("2026-10-26T00:00:00.000Z"),
    metrics: {
      routes: { submitted: 2, published: 1 },
      places: { submitted: 5, published: 3, rejected: 1, total: 12 },
      traffic: { reported: 4, cleared: 2, expired: 1, removed: 0 },
      consultations: {
        opened: 3,
        answered: 2,
        resolved: 1,
        stillOpen: 1,
        medianResponseHours: 6.5,
      },
      businesses: { claimed: 1, approved: 1 },
      people: { verified: 8, contributors: 4 },
      topCategories: [{ name: "Salud", count: 4 }],
    },
  });

  expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
  expect(pdf.getTitle()).toContain("Sabaneta");

  const raw = Buffer.from(bytes);
  expect(raw.includes("/Type /EmbeddedFile")).toBe(true);
  const start = raw.indexOf("/Type /EmbeddedFile");
  const streamAt = raw.indexOf("stream\n", start) + "stream\n".length;
  const streamEnd = raw.indexOf("\nendstream", streamAt);
  const embedded = inflateSync(raw.subarray(streamAt, streamEnd));
  const metrics = JSON.parse(new TextDecoder().decode(embedded)) as {
    places: { total: number };
  };
  expect(metrics.places.total).toBe(12);
});
