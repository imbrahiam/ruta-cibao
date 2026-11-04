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

    static let height: CGFloat = 250

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                if let text = notice.severityText {
                    Label(text, systemImage: notice.severitySymbol)
                        .font(.subheadline.weight(.semibold))
                }
                if let description = notice.details {
                    Text(description)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                if notice.isMine {
                    Text(L10n.Traffic.mine)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                } else {
                    HStack(spacing: 12) {
                        answer(.still, title: L10n.Traffic.stillShort, count: Int(notice.stillCount))
                        answer(.cleared, title: L10n.Traffic.goneShort, count: Int(notice.clearedCount))
                    }
                }
                if let failure {
                    Text(failure == .offline ? L10n.Common.offlineBody : L10n.Common.errorBody)
                        .font(.footnote)
                        .foregroundStyle(palette.warningInk)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
            .padding(.bottom, 12)
        }
        .scrollBounceBehavior(.basedOnSize)
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
            }
            Spacer(minLength: 8)
            SheetCloseButton()
        }
    }

    private func answer(_ verdict: TrafficVerdict, title: String, count: Int) -> some View {
        let chosen = notice.myVerdict == verdict
        return Button { confirm(verdict) } label: {
            VStack(spacing: 2) {
                HStack(spacing: 6) {
                    if chosen { Image(systemName: "checkmark.circle.fill") }
                    Text(title).font(.headline)
                }
                Text("\(count)")
                    .font(.subheadline.monospacedDigit())
                    .opacity(0.75)
            }
            .foregroundStyle(chosen ? palette.onAccent : palette.text)
            .frame(maxWidth: .infinity, minHeight: 64)
            .background(chosen ? palette.accent : palette.inset, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(chosen ? .clear : palette.hairline, lineWidth: 1)
            }
            .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(title), \(count)")
        .accessibilityAddTraits(chosen ? .isSelected : [])
    }
}
