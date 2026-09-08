import { eq, sql } from "drizzle-orm";
import { createTranslator } from "next-intl";
import { PageSizes, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { db } from "@/db";
import { municipalities, weeklyReports } from "@/db/schema";
import { routing } from "@/i18n/routing";
import { recordAudit } from "@/lib/audit";
import { putObject } from "@/lib/storage";
import { type WeeklyMetrics, weeklyMetrics } from "./contracts";

export type ReportDocument = {
  municipalityName: string;
  periodStart: Date;
  periodEnd: Date;
  metrics: WeeklyMetrics;
};

/** No browser or web session is required by the scheduled worker. */
export async function renderReportDocument(
  report: ReportDocument,
): Promise<Uint8Array> {
  const messages = (
    await import(`../../../messages/${routing.defaultLocale}.json`)
  ).default;
  const t = createTranslator({
    locale: routing.defaultLocale,
    messages,
    namespace: "reports",
  });
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${t("title")} · ${report.municipalityName}`);
  pdf.setLanguage(routing.defaultLocale);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage(PageSizes.A4);
  let y = page.getHeight() - 50;
  // Standard PDF fonts cover Spanish. Unsupported content characters get a
  // visible replacement rather than aborting every municipality's weekly job.
  function printable(value: string) {
    return [...value]
      .map((character) => {
        try {
          font.encodeText(character);
          return character;
        } catch {
          return "?";
        }
      })
      .join("");
  }
  function line(text: string, heading = false) {
    const size = heading ? 15 : 11;
    const selectedFont = heading ? bold : font;
    const words = printable(text).split(/\s+/);
    let current = "";
    const lines: string[] = [];
    for (const word of words) {
      if (
        current &&
        selectedFont.widthOfTextAtSize(`${current} ${word}`, size) > 490
      ) {
        lines.push(current);
        current = word;
      } else current = current ? `${current} ${word}` : word;
    }
    if (current) lines.push(current);
    for (const row of lines) {
      if (y < 55) {
        page = pdf.addPage(PageSizes.A4);
        y = page.getHeight() - 50;
      }
      page.drawText(row, {
        x: 50,
        y,
        size,
        font: selectedFont,
        color: rgb(0.13, 0.24, 0.2),
      });
      y -= heading ? 25 : 18;
    }
    y -= heading ? 5 : 0;
  }
  line(t("title"), true);
  line(report.municipalityName, true);
  const format = new Intl.DateTimeFormat(routing.defaultLocale, {
    timeZone: "America/Santo_Domingo",
    dateStyle: "long",
  });
  line(
    t("week", {
      start: format.format(report.periodStart),
      end: format.format(new Date(report.periodEnd.getTime() - 86400000)),
    }),
  );
  y -= 15;
  const m = report.metrics;
  const sections = [
    {
      title: t("sections.places"),
      rows: [
        [t("metrics.placesSubmitted"), m.places.submitted],
        [t("metrics.placesPublished"), m.places.published],
        [t("metrics.placesRejected"), m.places.rejected],
        [t("metrics.placesTotal"), m.places.total],
      ],
    },
    {
      title: t("sections.traffic"),
      rows: [
        [t("metrics.trafficReported"), m.traffic.reported],
        [t("metrics.trafficCleared"), m.traffic.cleared],
        [t("metrics.trafficExpired"), m.traffic.expired],
        [t("metrics.trafficRemoved"), m.traffic.removed],
      ],
    },
    {
      title: t("sections.consultations"),
      rows: [
        [t("metrics.consultationsOpened"), m.consultations.opened],
        [t("metrics.consultationsAnswered"), m.consultations.answered],
        [t("metrics.consultationsResolved"), m.consultations.resolved],
        [t("metrics.consultationsStillOpen"), m.consultations.stillOpen],
        [
          t("metrics.medianResponse"),
          m.consultations.medianResponseHours === null
            ? t("metrics.medianResponseNone")
            : t("metrics.medianResponseHours", {
                hours: m.consultations.medianResponseHours.toFixed(1),
              }),
        ],
      ],
    },
    {
      title: t("sections.businesses"),
      rows: [
        [t("metrics.businessesClaimed"), m.businesses.claimed],
        [t("metrics.businessesApproved"), m.businesses.approved],
      ],
    },
    {
      title: t("sections.routes"),
      rows: [
        [t("metrics.routesSubmitted"), m.routes.submitted],
        [t("metrics.routesPublished"), m.routes.published],
      ],
    },
    {
      title: t("sections.people"),
      rows: [
        [t("metrics.peopleVerified"), m.people.verified],
        [t("metrics.peopleContributors"), m.people.contributors],
      ],
    },
  ];
  for (const section of sections) {
    y -= 12;
    line(section.title, true);
    for (const [label, value] of section.rows) line(`${label}: ${value}`);
  }
  if (m.topCategories.length) {
    y -= 12;
    line(t("sections.topCategories"), true);
    for (const category of m.topCategories)
      line(`${category.name}: ${category.count}`);
  }
  for (const [index, sheet] of pdf.getPages().entries())
    sheet.drawText(`${index + 1} / ${pdf.getPageCount()}`, {
      x: 500,
      y: 25,
      size: 9,
      font,
    });
  // The frozen source travels with the PDF for machine-readable verification.
  await pdf.attach(
    new TextEncoder().encode(JSON.stringify(report.metrics)),
    "metrics.json",
    { mimeType: "application/json" },
  );
  return pdf.save();
}

export async function renderWeeklyReportPdf(
  reportId: string,
): Promise<{ rendered: true; storageKey: string }> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`report-pdf:${reportId}`}))`,
    );
    const [report] = await tx
      .select({ report: weeklyReports, municipalityName: municipalities.name })
      .from(weeklyReports)
      .innerJoin(
        municipalities,
        eq(municipalities.id, weeklyReports.municipalityId),
      )
      .where(eq(weeklyReports.id, reportId))
      .limit(1);
    if (report?.report.status !== "ready")
      throw new Error("Report metrics are not ready");
    if (report.report.pdfStorageKey)
      return { rendered: true, storageKey: report.report.pdfStorageKey };
    const pdf = await renderReportDocument({
      municipalityName: report.municipalityName,
      periodStart: report.report.periodStart,
      periodEnd: report.report.periodEnd,
      metrics: weeklyMetrics.parse(report.report.metrics),
    });
    const storageKey = `reports/${report.report.municipalityId}/${report.report.periodStart.toISOString().slice(0, 10)}.pdf`;
    await putObject(storageKey, pdf, "application/pdf");
    await tx
      .update(weeklyReports)
      .set({ pdfStorageKey: storageKey, failureReason: null })
      .where(eq(weeklyReports.id, reportId));
    await recordAudit(
      {
        action: "report.pdf_generated",
        subjectType: "weekly_report",
        subjectId: reportId,
        municipalityId: report.report.municipalityId,
      },
      tx,
    );
    return { rendered: true, storageKey };
  });
}
