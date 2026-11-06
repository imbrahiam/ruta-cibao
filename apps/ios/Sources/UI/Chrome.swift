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

/// Threads' settings row: outline icon, label, optional value, chevron.
struct SettingsRow: View {
    let symbol: String
    let title: String
    var value: String? = nil
    var tint: Color? = nil
    var chevron = true
    /// iOS Settings' icon: a white glyph on a rounded square of this colour.
    var badge: Color? = nil
    /// A number shown as text in a capsule (never colour alone).
    var count: Int? = nil
    /// Airbnb's menu gutter (24pt), wider than the feed's.
    var inset: CGFloat = 24
    @Environment(\.palette) private var palette

    var body: some View {
        HStack(spacing: 14) {
            Group {
                if let badge {
                    Image(systemName: symbol)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 30, height: 30)
                        .background(badge.gradient, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                } else {
                    Image(systemName: symbol)
                        .font(.system(size: 20, weight: .regular))
                        .foregroundStyle(tint ?? palette.text)
                        .frame(width: 30)
                }
            }
            .accessibilityHidden(true)
            Text(title)
                .font(.system(size: 16))
                .foregroundStyle(tint ?? palette.text)
            Spacer(minLength: 8)
            if let value {
                Text(value).font(.system(size: 15)).foregroundStyle(palette.textTertiary).monospacedDigit()
            }
            if let count {
                Text(verbatim: "\(count)")
                    .font(.system(size: 14, weight: .semibold).monospacedDigit())
                    .foregroundStyle(palette.background)
                    .padding(.horizontal, 9)
                    .frame(minWidth: 26, minHeight: 26)
                    .background(palette.text, in: Capsule())
            }
            if chevron {
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(palette.textTertiary)
                    .accessibilityHidden(true)
            }
        }
        .padding(.horizontal, inset)
        .frame(minHeight: 56)
        .contentShape(Rectangle())
    }
}

/// The hairline between groups of rows, inset to the rows' gutter.
struct GroupDivider: View {
    var inset: CGFloat = 24
    @Environment(\.palette) private var palette
    var body: some View {
        Rectangle().fill(palette.hairline).frame(height: 0.5).padding(.horizontal, inset).padding(.vertical, 8)
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
                    Text(title(option))
                        .font(.system(size: 15, weight: isSelected ? .semibold : .medium))
                        .foregroundStyle(isSelected ? palette.text : palette.textTertiary)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .overlay(alignment: .bottom) {
                            if isSelected {
                                Rectangle().fill(RutaHighlight.enabled ? RutaHighlight.color : palette.text).frame(height: 1.5)
                                    .matchedGeometryEffect(id: "underline", in: underline)
                            }
                        }
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
