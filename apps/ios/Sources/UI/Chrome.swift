import SwiftUI

/// A monochrome glyph on a neutral disc: the app's avatar for anything that
/// isn't a person (a category, a kind of contribution, the ayuntamiento).
struct GlyphDisc: View {
    let symbol: String
    var size: CGFloat = PostMetrics.avatar
    @Environment(\.palette) private var palette
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        Circle()
            .fill(palette.raised)
            .frame(width: size, height: size)
            .overlay {
                Image(systemName: symbol)
                    .font(.system(size: size * 0.42, weight: .medium))
                    .foregroundStyle(palette.text)
            }
            .accessibilityHidden(true)
    }
}

/// Threads' profile tabs: equal widths, the current one in ink over a
/// heavier underline, the rest grey. For a two- or three-way switch.
struct SegmentTabs<Value: Hashable>: View {
    let options: [Value]
    let selected: Value
    let title: (Value) -> String
    let select: (Value) -> Void
    @Environment(\.palette) private var palette
    @Namespace private var underline

    var body: some View {
        HStack(spacing: 0) {
            ForEach(options, id: \.self) { option in
                let isSelected = option == selected
                Button { select(option) } label: {
                    // X's tab: bold when chosen, and a short rounded bar as wide
                    // as the word, not the whole half.
                    Text(title(option))
                        .font(.system(size: 15, weight: isSelected ? .bold : .medium))
                        .foregroundStyle(isSelected ? palette.text : palette.textTertiary)
                        .padding(.vertical, 14)
                        .overlay(alignment: .bottom) {
                            if isSelected {
                                Capsule().fill(palette.accentInk).frame(height: 4)
                                    .matchedGeometryEffect(id: "underline", in: underline)
                            }
                        }
                        .frame(maxWidth: .infinity, minHeight: 50)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(isSelected ? .isSelected : [])
                .sensoryFeedback(.selection, trigger: isSelected) { _, now in now }
            }
        }
        .overlay(alignment: .bottom) { Rectangle().fill(palette.hairline).frame(height: 0.5) }
        .animation(.snappy(duration: 0.25), value: selected)
    }
}

/// A horizontal wheel of options: the selected one always centred, the rest
/// trailing off and fading toward the edges. Swipe to turn it, or tap an
/// option to bring it to the centre. Position, weight and opacity all mark
/// the selection, never colour alone; VoiceOver steps it as an adjustable.
struct CenterWheel<Value: Hashable>: View {
    let options: [Value]
    let selected: Value
    let title: (Value) -> String
    let select: (Value) -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var widths: [Int: CGFloat] = [:]
    @GestureState private var drag: CGFloat = 0

    private let spacing: CGFloat = 26

    private var index: Int { options.firstIndex(of: selected) ?? 0 }

    var body: some View {
        GeometryReader { geo in
            HStack(spacing: spacing) {
                ForEach(Array(options.enumerated()), id: \.offset) { i, option in
                    let current = i == index
                    Text(title(option))
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(.primary)
                        .opacity(current ? 1 : 0.32)
                        .scaleEffect(current ? 1 : 0.92)
                        .fixedSize()
                        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { widths[i] = $0 }
                        .frame(minHeight: 44)
                        .contentShape(Rectangle())
                        .onTapGesture { move(to: i) }
                        .accessibilityHidden(true)
                }
            }
            .fixedSize()
            .offset(x: offset(in: geo.size.width) + drag)
            .frame(width: geo.size.width, alignment: .leading)
            .animation(reduceMotion ? nil : .snappy(duration: 0.32), value: index)
            // The edges fade out, so the centre is where the eye lands.
            .mask {
                LinearGradient(stops: [
                    .init(color: .clear, location: 0),
                    .init(color: .black, location: 0.22),
                    .init(color: .black, location: 0.78),
                    .init(color: .clear, location: 1),
                ], startPoint: .leading, endPoint: .trailing)
            }
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 8)
                    .updating($drag) { value, state, _ in state = value.translation.width }
                    .onEnded { value in
                        let travelled = -value.predictedEndTranslation.width
                        let step = Int((travelled / 90).rounded())
                        move(to: index + step)
                    }
            )
        }
        .frame(height: 48)
        .sensoryFeedback(.selection, trigger: index)
        .accessibilityElement()
        .accessibilityLabel(title(selected))
        .accessibilityAddTraits(.isHeader)
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: move(to: index + 1)
            case .decrement: move(to: index - 1)
            @unknown default: break
            }
        }
    }

    private func move(to target: Int) {
        let clamped = Swift.min(Swift.max(target, 0), options.count - 1)
        if clamped != index { select(options[clamped]) }
    }

    /// Shift the row so the selected option's centre sits on the view's centre.
    private func offset(in width: CGFloat) -> CGFloat {
        let before = (0..<index).reduce(CGFloat(0)) { $0 + (widths[$1] ?? 0) + spacing }
        return width / 2 - before - (widths[index] ?? 0) / 2
    }
}

/// Keeps a scrolling page at a comfortable reading width on wide windows (an
/// unfolded phone, an iPad), centred; compact widths keep the system margins.
private struct ReadableWidth: ViewModifier {
    var limit: CGFloat
    @State private var width: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .contentMargins(.horizontal, width > limit + 32 ? (width - limit) / 2 : nil, for: .scrollContent)
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
    }
}

extension View {
    func readableWidth(_ limit: CGFloat = 640) -> some View { modifier(ReadableWidth(limit: limit)) }
}
