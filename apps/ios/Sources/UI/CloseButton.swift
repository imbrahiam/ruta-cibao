import SwiftUI

/// The small round "×" of Instagram and Threads sheets: a 30pt disc that reads
/// as chrome, not as an action, with the full 44pt target around it.
/// `onMedia` is white on a dark translucent disc, for photos and video.
struct CloseButton: View {
    enum Style { case standard, onMedia }

    var style: Style = .standard
    var label: String = L10n.Common.close
    let action: () -> Void
    @Environment(\.palette) private var palette

    var body: some View {
        Button(action: action) {
            Image(systemName: "xmark")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(style == .onMedia ? Color.white : palette.textSecondary)
                .frame(width: 30, height: 30)
                .background(style == .onMedia ? AnyShapeStyle(Color.black.opacity(0.45)) : AnyShapeStyle(palette.inset), in: Circle())
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

/// The close control on the map's sheets: the system close role on a
/// Liquid Glass circle, sized to find without knowing you can swipe down.
struct SheetCloseButton: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Button(role: .close) { dismiss() } label: {
            Image(systemName: "xmark")
                .font(.system(size: 15, weight: .semibold))
                .frame(width: 36, height: 36)
        }
        .buttonStyle(.glass)
        .buttonBorderShape(.circle)
        .accessibilityLabel(L10n.Common.close)
    }
}
