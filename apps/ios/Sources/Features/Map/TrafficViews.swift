import CoreLocation
import MapKit
import RutaKit
import SwiftUI

extension TrafficNotice {
    var coordinate: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: latitude, longitude: longitude) }

    var pathCoordinates: [CLLocationCoordinate2D] {
        path.map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) }
    }

    var style: CategoryGlyph.Style { CategoryGlyph.style(icon, hex: color) }

    /// Blocking roads draw heavier; the sheet says the same in words.
    var lineWidth: CGFloat { severity == .blocking ? 9 : 5 }

    var severityText: String? {
        switch severity {
        case .blocking: L10n.Traffic.Severity.blocking
        case .partial: L10n.Traffic.Severity.partial
        case .minor: L10n.Traffic.Severity.minor
        case nil: nil
        }
    }

    var severitySymbol: String {
        switch severity {
        case .blocking: "nosign"
        case .partial: "tortoise.fill"
        default: "exclamationmark.triangle.fill"
        }
    }
}

/// A road report on the map: a rounded square, so it never reads as a place's
/// round pin, with a white edge for contrast on any basemap.
struct TrafficMarker: View {
    let notice: TrafficNotice
    let selected: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let style = notice.style
        RoundedRectangle(cornerRadius: 10, style: .continuous)
            .fill(style.color.gradient)
            .frame(width: 38, height: 38)
            .overlay {
                Image(systemName: style.symbol)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(.white)
            }
            .overlay { RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(.white, lineWidth: 2.5) }
            .shadow(color: .black.opacity(0.3), radius: 3, y: 1)
            .scaleEffect(selected ? 1.18 : 1)
            .animation(reduceMotion ? nil : .snappy, value: selected)
            .accessibilityElement()
            .accessibilityLabel(L10n.Traffic.sheetLabel(category: notice.categoryName))
    }
}

/// A road report: what and where, then the one question that matters,
/// "is it still there?", as two equal answers with the neighbours' counts.
struct TrafficSheetView: View {
    let notice: TrafficNotice
    let failure: UiError?
    let confirm: (TrafficVerdict) -> Void
    @Environment(\.palette) private var palette

    /// Measured from the content, so the sheet is exactly as tall as what it says.
    @State private var contentHeight: CGFloat = 230

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            header
            if let description = notice.details {
                Text(description)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            HStack(spacing: 12) {
                answer(.still, title: L10n.Traffic.stillShort, count: Int(notice.stillCount))
                answer(.cleared, title: L10n.Traffic.goneShort, count: Int(notice.clearedCount))
            }
            .allowsHitTesting(!notice.isMine)
            if let failure {
                Text(failure == .offline ? L10n.Common.offlineBody : L10n.Common.errorBody)
                    .font(.footnote)
                    .foregroundStyle(palette.warningInk)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 20)
        .padding(.bottom, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { contentHeight = $0 }
        .presentationDetents([.height(contentHeight)])
        .presentationBackgroundInteraction(.enabled(upThrough: .height(contentHeight)))
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 12) {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(notice.style.color.gradient)
                .frame(width: 44, height: 44)
                .overlay {
                    Image(systemName: notice.style.symbol)
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(.white)
                }
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(notice.categoryName)
                    .font(.headline)
                    .lineLimit(2)
                    .accessibilityAddTraits(.isHeader)
                Text(verbatim: "\(notice.municipality) · \(RelativeTime.Companion.shared.since(instant: notice.createdAt).text)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                // Only when it says something the title doesn't (a flood that also blocks the road).
                if let text = notice.severityText, text != notice.categoryName {
                    Label(text, systemImage: notice.severitySymbol)
                        .font(.footnote.weight(.semibold))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Color.primary.opacity(0.1), in: Capsule())
                        .padding(.top, 4)
                }
            }
            Spacer(minLength: 8)
            SheetCloseButton()
        }
    }

    private func answer(_ verdict: TrafficVerdict, title: String, count: Int) -> some View {
        let chosen = notice.myVerdict == verdict
        let shape = RoundedRectangle(cornerRadius: 14, style: .continuous)
        return Button { confirm(verdict) } label: {
            HStack(spacing: 8) {
                if chosen { Image(systemName: "checkmark.circle.fill") }
                Text(title).font(.headline)
                Text("\(count)")
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            .foregroundStyle(.primary)
            .frame(maxWidth: .infinity, minHeight: 48)
            .background(chosen ? RutaHighlight.color.opacity(0.22) : Color.primary.opacity(0.1), in: shape)
            .overlay { shape.strokeBorder(chosen ? RutaHighlight.color : .clear, lineWidth: 2) }
            .contentShape(shape)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(title), \(count)")
        .accessibilityAddTraits(chosen ? .isSelected : [])
    }
}
