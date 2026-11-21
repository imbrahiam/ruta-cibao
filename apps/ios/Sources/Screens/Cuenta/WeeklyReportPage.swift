import RutaKit
import SwiftUI

/// The week's report as a page of its own: the four numbers that matter first, then each area
/// with its figures, and the PDF one tap away for sending or printing.
struct WeeklyReportPage: View {
    let report: ReportsListItem
    let preparing: Bool
    let unavailable: Bool
    let export: () -> Void

    private var week: String {
        let format = Date.FormatStyle.dateTime.day().month(.wide).locale(Locale(identifier: "es_DO"))
        return L10n.Reports.week(start: report.periodStart.date.formatted(format), end: report.periodEnd.date.formatted(format))
    }

    var body: some View {
        Page(title: L10n.Gestion.weekly, trailing: {
            Button(L10n.Common.share, systemImage: "square.and.arrow.up", action: export).disabled(preparing)
        }) {
            VStack(alignment: .leading, spacing: 4) {
                Text(report.municipalityName).type(.display)
                Text(week).type(.callout, .ink3)
            }
            .padding(.bottom, 4)

            if let metrics = report.metrics {
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible())], spacing: 10) {
                    headline(metrics.places.published, L10n.Reports.Metrics.placesPublished, L10n.Reports.Sections.places, Glyph.location)
                    headline(metrics.consultations.opened, L10n.Reports.Metrics.consultationsOpened, L10n.Reports.Sections.consultations, "bubble.left")
                    headline(metrics.consultations.stillOpen, L10n.Reports.Metrics.consultationsStillOpen, L10n.Reports.Sections.consultations, "hourglass")
                    headline(metrics.traffic.reported, L10n.Reports.Metrics.trafficReported, L10n.Reports.Sections.traffic, "exclamationmark.triangle")
                }

                section(L10n.Reports.Sections.places, [
                    (L10n.Reports.Metrics.placesSubmitted, count(metrics.places.submitted)),
                    (L10n.Reports.Metrics.placesPublished, count(metrics.places.published)),
                    (L10n.Reports.Metrics.placesRejected, count(metrics.places.rejected)),
                    (L10n.Reports.Metrics.placesTotal, count(metrics.places.total)),
                ])
                section(L10n.Reports.Sections.consultations, [
                    (L10n.Reports.Metrics.consultationsOpened, count(metrics.consultations.opened)),
                    (L10n.Reports.Metrics.consultationsAnswered, count(metrics.consultations.answered)),
                    (L10n.Reports.Metrics.consultationsResolved, count(metrics.consultations.resolved)),
                    (L10n.Reports.Metrics.consultationsStillOpen, count(metrics.consultations.stillOpen)),
                    (L10n.Reports.Metrics.medianResponse, metrics.consultations.medianResponseHours.map {
                        L10n.Reports.Metrics.medianResponseHours(hours: $0.doubleValue.formatted(.number.precision(.fractionLength(0...1))))
                    } ?? L10n.Reports.Metrics.medianResponseNone),
                ])
                section(L10n.Reports.Sections.traffic, [
                    (L10n.Reports.Metrics.trafficReported, count(metrics.traffic.reported)),
                    (L10n.Reports.Metrics.trafficCleared, count(metrics.traffic.cleared)),
                    (L10n.Reports.Metrics.trafficExpired, count(metrics.traffic.expired)),
                    (L10n.Reports.Metrics.trafficRemoved, count(metrics.traffic.removed)),
                ])
                section(L10n.Reports.Sections.businesses, [
                    (L10n.Reports.Metrics.businessesClaimed, count(metrics.businesses.claimed)),
                    (L10n.Reports.Metrics.businessesApproved, count(metrics.businesses.approved)),
                ])
                section(L10n.Reports.Sections.routes, [
                    (L10n.Reports.Metrics.routesSubmitted, count(metrics.routes.submitted)),
                    (L10n.Reports.Metrics.routesPublished, count(metrics.routes.published)),
                ])
                section(L10n.Reports.Sections.people, [
                    (L10n.Reports.Metrics.peopleVerified, count(metrics.people.verified)),
                    (L10n.Reports.Metrics.peopleContributors, count(metrics.people.contributors)),
                ])
                if !metrics.topCategories.isEmpty { categories(metrics.topCategories) }
            } else {
                StateView(symbol: "doc.text", title: L10n.Reports.unreadable).frame(height: 260)
            }

            VStack(spacing: 8) {
                Button(action: export) {
                    HStack(spacing: 8) {
                        if preparing { ProgressView().tint(.onInk) } else { Image(systemName: "arrow.down.doc") }
                        Text(preparing ? L10n.Reports.preparingPdf : L10n.Reports.downloadPdf)
                    }
                }
                .buttonStyle(.ink)
                .disabled(preparing)
                if unavailable { Text(L10n.Gestion.weeklyUnavailable).type(.caption, .danger).multilineTextAlignment(.center) }
            }
            .padding(.top, 6)
        }
    }

    private func count(_ value: Int64) -> String { value.formatted() }

    /// One of the week's four leading figures: the number large, what it counts under it.
    private func headline(_ value: Int64, _ label: String, _ area: String, _ symbol: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline) {
                Text(value.formatted()).font(.system(size: 34, weight: .bold).monospacedDigit()).tracking(-0.8).foregroundStyle(Color.ink)
                Spacer(minLength: 8)
                Image(systemName: symbol).font(.system(size: 16)).foregroundStyle(Color.ink3)
            }
            Text(label).type(.label)
            Text(area).type(.caption, .ink3)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.paper2, in: RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    private func section(_ title: String, _ rows: [(String, String)]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).type(.heading).accessibilityAddTraits(.isHeader).padding(.top, 10)
            RowGroup {
                ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                    VStack(spacing: 0) {
                        HStack {
                            Text(row.0).type(.body)
                            Spacer(minLength: 12)
                            Text(row.1).font(.system(size: 16, weight: .semibold).monospacedDigit()).foregroundStyle(Color.ink)
                        }
                        .padding(.horizontal, 16)
                        .frame(minHeight: 48)
                        if index < rows.count - 1 { Hairline(inset: 16) }
                    }
                    .accessibilityElement(children: .combine)
                }
            }
        }
    }

    /// Where the new places went: each category as a bar against the largest.
    private func categories(_ items: [ReportsListItem.MetricsTopCategory]) -> some View {
        let most = max(items.map(\.count).max() ?? 1, 1)
        return VStack(alignment: .leading, spacing: 8) {
            Text(L10n.Reports.Sections.topCategories).type(.heading).accessibilityAddTraits(.isHeader).padding(.top, 10)
            VStack(alignment: .leading, spacing: 12) {
                ForEach(items, id: \.name) { item in
                    VStack(alignment: .leading, spacing: 5) {
                        HStack {
                            Text(item.name).type(.callout)
                            Spacer()
                            Text(item.count.formatted()).font(.system(size: 14, weight: .semibold).monospacedDigit()).foregroundStyle(Color.ink)
                        }
                        GeometryReader { box in
                            Capsule().fill(Color.paper3).overlay(alignment: .leading) {
                                Capsule().fill(Color.brand).frame(width: max(box.size.width * CGFloat(item.count) / CGFloat(most), 6))
                            }
                        }
                        .frame(height: 6)
                    }
                    .accessibilityElement(children: .combine)
                }
            }
            .padding(16)
            .background(Color.paper2, in: RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
        }
    }
}
