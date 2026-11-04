import MapKit
import RutaKit
import SwiftUI

typealias EcoRoute = RoutesBrowseOutput.Item

extension EcoRoute {
    var coordinates: [CLLocationCoordinate2D] {
        path.map { CLLocationCoordinate2D(latitude: $0.lat, longitude: $0.lng) }
    }

    var start: CLLocationCoordinate2D? { coordinates.first }

    /// Hiking green, cycling orange: system colours, like the category glyphs.
    var tint: Color { categoryId == "ciclismo" ? .orange : .green }
    var symbol: String { categoryId == "ciclismo" ? "bicycle" : "figure.hiking" }

    var difficultyText: String {
        switch difficulty {
        case .easy: L10n.Explore.Difficulty.easy
        case .moderate: L10n.Explore.Difficulty.moderate
        case .hard: L10n.Explore.Difficulty.hard
        }
    }

    var distanceText: String {
        Measurement(value: distanceMeters / 1000, unit: UnitLength.kilometers)
            .formatted(.measurement(width: .abbreviated, usage: .asProvided, numberFormatStyle: .number.precision(.fractionLength(1))))
    }

    var durationText: String {
        let f = DateComponentsFormatter()
        f.unitsStyle = .abbreviated
        f.allowedUnits = [.hour, .minute]
        return f.string(from: durationMinutes * 60) ?? ""
    }

    /// The region that frames the whole line, with room for the sheet below.
    var region: MKCoordinateRegion {
        let lats = path.map(\.lat), lngs = path.map(\.lng)
        guard let minLat = lats.min(), let maxLat = lats.max(), let minLng = lngs.min(), let maxLng = lngs.max() else {
            return MKCoordinateRegion(center: start ?? .init(), latitudinalMeters: 2000, longitudinalMeters: 2000)
        }
        let latSpan = max(0.006, (maxLat - minLat) * 1.6)
        let lngSpan = max(0.006, (maxLng - minLng) * 1.6)
        // Centre lower than the line, so it sits above the sheet.
        let center = CLLocationCoordinate2D(latitude: (minLat + maxLat) / 2 - latSpan * 0.22, longitude: (minLng + maxLng) / 2)
        return MKCoordinateRegion(center: center, span: MKCoordinateSpan(latitudeDelta: latSpan * 1.5, longitudeDelta: lngSpan))
    }
}

/// A route at a glance: name, where, the three numbers that decide whether
/// to go, and one action. The rest (services, the safety note) below the fold.
struct RouteSheetView: View {
    let route: EcoRoute
    let directions: () -> Void
    @Environment(\.palette) private var palette

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack(alignment: .top, spacing: 12) {
                    PinBadge(symbol: route.symbol, color: route.tint, size: 44)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(route.name)
                            .font(.headline)
                            .lineLimit(2)
                            .accessibilityAddTraits(.isHeader)
                        Text(verbatim: "\(route.categoryName) · \(route.municipalityName)")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 8)
                    SheetCloseButton()
                }

                HStack(spacing: 0) {
                    Stat(label: L10n.Routes.distance, value: route.distanceText)
                    Divider().frame(height: 32)
                    Stat(label: L10n.Routes.duration, value: route.durationText)
                    Divider().frame(height: 32)
                    Stat(label: L10n.Routes.difficulty, value: route.difficultyText)
                }

                Button(action: directions) {
                    Label(L10n.Routes.toStart, systemImage: "arrow.triangle.turn.up.right.diamond.fill")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(RutaProminentStyle(tint: route.tint))

                if !route.services.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(L10n.Routes.services).font(.subheadline.weight(.semibold))
                        Text(route.services.map(Self.serviceName).joined(separator: " · "))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }

                VStack(alignment: .leading, spacing: 6) {
                    Label(L10n.Routes.safetyTitle, systemImage: "exclamationmark.triangle")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(palette.warningInk)
                    Text(L10n.Routes.safetyBody)
                        .font(.subheadline)
                        .foregroundStyle(palette.textSecondary)
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(palette.inset, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
            .padding(.horizontal, 20)
            .padding(.top, 22)
            .padding(.bottom, 24)
        }
        .scrollBounceBehavior(.basedOnSize)
    }

    private static func serviceName(_ service: RoutesBrowseOutput.ItemService) -> String {
        switch service {
        case .water: L10n.Routes.Service.water
        case .food: L10n.Routes.Service.food
        case .lodging: L10n.Routes.Service.lodging
        case .guide: L10n.Routes.Service.guide
        case .parking: L10n.Routes.Service.parking
        case .restrooms: L10n.Routes.Service.restrooms
        }
    }
}

private struct Stat: View {
    let label: String
    let value: String
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(spacing: 2) {
            Text(value).font(.headline.monospacedDigit())
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }
}
