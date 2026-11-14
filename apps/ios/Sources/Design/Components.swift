import RutaKit
import SwiftUI

// MARK: - Buttons

/// The landing's pill: ink for the one main action, paper for the rest.
struct PillStyle: ButtonStyle {
    enum Kind { case ink, quiet, outline, danger }
    var kind: Kind = .ink
    var compact = false
    var fill = true
    @Environment(\.isEnabled) private var enabled
    /// A disabled main action rests as a quiet slab instead of a faded black one.
    private var off: Bool { kind == .ink && !enabled }

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .type(compact ? .label : .bodyStrong, off ? .ink3 : foreground)
            .lineLimit(1)
            .padding(.horizontal, compact ? 16 : 22)
            .frame(maxWidth: fill ? .infinity : nil, minHeight: compact ? 40 : 52)
            .background(off ? Color.paper3 : background, in: Capsule())
            .overlay { if kind == .outline { Capsule().strokeBorder(Color.line, lineWidth: 1) } }
            .contentShape(Capsule())
            .opacity(enabled || off ? 1 : 0.4)
            // Pressed is felt at the finger: the pill gives a little.
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(Motion.quick, value: configuration.isPressed)
    }

    private var foreground: Color {
        switch kind {
        case .ink: .onInk
        case .quiet, .outline: .ink
        case .danger: .danger
        }
    }

    private var background: Color {
        switch kind {
        case .ink: .action
        case .quiet, .danger: .paper2
        case .outline: .clear
        }
    }
}

extension ButtonStyle where Self == PillStyle {
    static var ink: PillStyle { PillStyle() }
    static var quiet: PillStyle { PillStyle(kind: .quiet) }
    static func pill(_ kind: PillStyle.Kind, compact: Bool = false, fill: Bool = true) -> PillStyle {
        PillStyle(kind: kind, compact: compact, fill: fill)
    }
}

/// A round icon button: 44 pt target, paper fill, one thin symbol.
struct IconButton: View {
    let symbol: String
    let label: String
    var floating = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 17, weight: .regular))
                .foregroundStyle(Color.ink)
                .frame(width: 44, height: 44)
                .modifier(Surface(floating: floating))
                .contentShape(Circle())
        }
        .buttonStyle(Pressable())
        .accessibilityLabel(label)
    }

    private struct Surface: ViewModifier {
        let floating: Bool
        func body(content: Content) -> some View {
            if floating { content.glassEffect(.regular.interactive(), in: Circle()) } else { content.background(Color.paper2, in: Circle()) }
        }
    }
}

/// Any custom tappable: an immediate pressed state, nothing else.
struct Pressable: ButtonStyle {
    var scale: CGFloat = 0.96
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.72 : 1)
            .scaleEffect(configuration.isPressed ? scale : 1)
            .animation(Motion.quick, value: configuration.isPressed)
    }
}

/// A whole row that responds to touch with a paper tint.
struct RowPress: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
            .background(configuration.isPressed ? Color.paper2 : .clear)
            .animation(Motion.quick, value: configuration.isPressed)
    }
}

// MARK: - Chips

struct Chip: View {
    let title: String
    var symbol: String?
    let selected: Bool
    /// Over the map: Liquid Glass instead of a paper surface.
    var glass = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 7) {
                if let symbol { Image(systemName: symbol).font(.system(size: 13, weight: .regular)) }
                Text(title)
            }
            .type(.label, glass && selected ? .white : .ink)
            .padding(.horizontal, 14)
            .frame(height: 38)
            .modifier(ChipSurface(selected: selected, glass: glass))
            .contentShape(Capsule())
        }
        .buttonStyle(Pressable())
        .accessibilityAddTraits(selected ? .isSelected : [])
        .sensoryFeedback(.selection, trigger: selected)
    }
}

/// Every input is a white card with a hairline; the pick takes the brand's lavender and a ring.
/// Over the map the same chip is glass, tinted iris when chosen.
private struct ChipSurface: ViewModifier {
    let selected: Bool
    let glass: Bool

    func body(content: Content) -> some View {
        if glass {
            content.glassEffect(selected ? .regular.tint(Color.iris).interactive() : .regular.interactive(), in: Capsule())
        } else {
            content
                .background(selected ? Tint.lavender.fill : Color.card, in: Capsule())
                .overlay { Capsule().strokeBorder(selected ? Color.iris : Color.line, lineWidth: selected ? 1.5 : 1) }
        }
    }
}

// MARK: - Fields

/// A text field on paper: no border until focused, the placeholder is the label.
struct Field: View {
    let placeholder: String
    @Binding var text: String
    var lines: ClosedRange<Int> = 1...1
    var symbol: String?
    @FocusState private var focused: Bool

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            if let symbol { Image(systemName: symbol).font(.system(size: 15)).foregroundStyle(Color.ink3) }
            TextField("", text: $text, prompt: Text(placeholder).foregroundStyle(Color.ink3), axis: lines.upperBound > 1 ? .vertical : .horizontal)
                .lineLimit(lines)
                .type(.body)
                .focused($focused)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 15)
        .frame(minHeight: 52, alignment: .top)
        .background(Color.card, in: RoundedRectangle(cornerRadius: Metrics.radiusField, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Metrics.radiusField, style: .continuous)
                .strokeBorder(focused ? Color.action : Color.line, lineWidth: focused ? 1.5 : 1)
        }
        .animation(Motion.quick, value: focused)
        .contentShape(Rectangle())
        .onTapGesture { focused = true }
        .accessibilityLabel(placeholder)
    }
}

// MARK: - Small pieces

struct Hairline: View {
    var inset: CGFloat = 0
    var body: some View {
        Rectangle().fill(Color.line).frame(height: 1 / UIScreen.main.scale * 2).padding(.leading, inset)
    }
}

/// A glyph on a soft disc in one of the landing's accents. Saturated colour stays on the map.
struct GlyphDisc: View {
    var icon: String = ""
    var symbol: String?
    var size: CGFloat = 40
    var tint: Tint = .neutral

    var body: some View {
        Image(systemName: symbol ?? Glyph.symbol(icon))
            .font(.system(size: size * 0.42, weight: .regular))
            .foregroundStyle(tint.ink)
            .frame(width: size, height: size)
            .background(tint.fill, in: Circle())
            .accessibilityHidden(true)
    }
}

/// The landing's location pin: a teardrop with a paper eye (`location-pin.tsx`, 24 by 28 box).
struct TeardropPin: View {
    var height: CGFloat = 42
    var color: Color = .pin

    var body: some View {
        Teardrop()
            .fill(color)
            .overlay { GeometryReader { box in Circle().fill(Color(red: 1, green: 0.98, blue: 0.97)).frame(width: box.size.width / 3, height: box.size.width / 3).position(x: box.size.width / 2, y: box.size.height * 11 / 28) } }
            .frame(width: height * 24 / 28, height: height)
            .shadow(color: .black.opacity(0.22), radius: 3, y: 2)
            .accessibilityHidden(true)
    }

    private nonisolated struct Teardrop: Shape {
        nonisolated func path(in rect: CGRect) -> Path {
            let w = rect.width / 24, h = rect.height / 28
            func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: rect.minX + x * w, y: rect.minY + y * h) }
            var path = Path()
            path.move(to: p(12, 27))
            path.addCurve(to: p(22, 11), control1: p(12, 27), control2: p(22, 16.9))
            path.addArc(center: p(12, 11), radius: 10 * w, startAngle: .degrees(0), endAngle: .degrees(180), clockwise: true)
            path.addCurve(to: p(12, 27), control1: p(2, 16.9), control2: p(12, 27))
            path.closeSubpath()
            return path
        }
    }
}

struct Avatar: View {
    let name: String?
    var size: CGFloat = 40

    var body: some View {
        Text(initials)
            .font(.system(size: size * 0.36, weight: .medium))
            .foregroundStyle(Color.ink2)
            .frame(width: size, height: size)
            .background(Color.paper3, in: Circle())
            .accessibilityHidden(true)
    }

    private var initials: String {
        let parts = (name ?? "").split(separator: " ").prefix(2).compactMap(\.first)
        return parts.isEmpty ? "·" : String(parts).uppercased()
    }
}

/// A small state word with its dot: colour and text together, never colour alone.
struct StatusTag: View {
    let text: String
    var color: Color = .ink3

    var body: some View {
        HStack(spacing: 6) {
            Circle().fill(color).frame(width: 6, height: 6)
            Text(text).type(.caption, .ink2)
        }
        .padding(.horizontal, 10)
        .frame(height: 26)
        .background(.regularMaterial, in: Capsule())
        .accessibilityElement(children: .combine)
    }
}

/// The landing page's mark ("Encuentro"): an open C and its meeting point on iris, drawn from
/// the same geometry the web uses (`packages/shared/src/brand.ts`, 256 unit box).
struct Mark: View {
    var size: CGFloat = 56

    var body: some View {
        Canvas { context, canvas in
            let unit = canvas.width / 256
            var curve = Path()
            curve.move(to: CGPoint(x: 190, y: 106))
            curve.addCurve(to: CGPoint(x: 127, y: 54), control1: CGPoint(x: 181, y: 74), control2: CGPoint(x: 158, y: 54))
            curve.addCurve(to: CGPoint(x: 54, y: 128), control1: CGPoint(x: 86, y: 54), control2: CGPoint(x: 54, y: 87))
            curve.addCurve(to: CGPoint(x: 127, y: 202), control1: CGPoint(x: 54, y: 169), control2: CGPoint(x: 86, y: 202))
            curve.addCurve(to: CGPoint(x: 193, y: 154), control1: CGPoint(x: 158, y: 202), control2: CGPoint(x: 182, y: 184))
            let scale = CGAffineTransform(scaleX: unit, y: unit)
            context.stroke(curve.applying(scale), with: .color(.white), style: StrokeStyle(lineWidth: 32 * unit, lineCap: .round))
            context.fill(Path(ellipseIn: CGRect(x: 192, y: 42, width: 30, height: 30)).applying(scale), with: .color(.white))
        }
        .frame(width: size, height: size)
        .background(Color.iris, in: RoundedRectangle(cornerRadius: size * 0.29, style: .continuous))
        .accessibilityHidden(true)
    }
}

// MARK: - States

/// Three quiet dots: the app is fetching. No grey boxes pretending to be content.
struct LoadingDots: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var on = false

    var body: some View {
        HStack(spacing: 6) {
            ForEach(0..<3, id: \.self) { index in
                Circle()
                    .fill(Color.ink3)
                    .frame(width: 6, height: 6)
                    .opacity(on ? 0.9 : 0.25)
                    .animation(reduceMotion ? nil : .easeInOut(duration: 0.7).repeatForever().delay(Double(index) * 0.16), value: on)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onAppear { on = true }
        .accessibilityLabel(L10n.Common.loading)
    }
}

/// Empty, offline or failed: one symbol, one line, one way forward.
struct StateView: View {
    var symbol: String?
    let title: String
    var message: String?
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        VStack(spacing: 14) {
            if let symbol {
                Image(systemName: symbol).font(.system(size: 30, weight: .light)).foregroundStyle(Color.ink3)
            } else {
                Mark(size: 44)
            }
            VStack(spacing: 6) {
                Text(title).type(.title)
                if let message { Text(message).type(.body, .ink3) }
            }
            .multilineTextAlignment(.center)
            if let actionTitle, let action {
                Button(actionTitle, action: action).font(.system(size: 17)).tint(.iris).frame(minHeight: 44).padding(.top, 2)
            }
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

extension StateView {
    /// The shared error mapping: offline reads differently from a failure.
    init(error: UiError, retry: @escaping () -> Void) {
        let offline = error == .offline
        self.init(
            symbol: offline ? "wifi.slash" : "exclamationmark.circle",
            title: offline ? L10n.Common.offline : L10n.Common.errorTitle,
            message: offline ? L10n.Common.offlineBody : nil,
            actionTitle: L10n.Common.retry,
            action: retry
        )
    }
}

// MARK: - Screen furniture

/// A root screen's title, in the landing's display type, with optional trailing controls.
struct ScreenTitle<Trailing: View>: View {
    let title: String
    @ViewBuilder var trailing: Trailing

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            Text(title).type(.display).accessibilityAddTraits(.isHeader)
            Spacer(minLength: 8)
            trailing
        }
        .padding(.horizontal, Metrics.gutter)
        .padding(.top, 10)
        .padding(.bottom, 14)
    }
}

extension ScreenTitle where Trailing == EmptyView {
    init(_ title: String) { self.init(title: title) { EmptyView() } }
}

/// A sheet or pushed form's top row: a close button, a centred title, an optional action.
struct SheetBar<Trailing: View>: View {
    let title: String
    let close: () -> Void
    @ViewBuilder var trailing: Trailing

    var body: some View {
        ZStack {
            Text(title).type(.bodyStrong).accessibilityAddTraits(.isHeader)
            HStack {
                IconButton(symbol: "xmark", label: L10n.Common.close, action: close)
                Spacer()
                trailing
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }
}

extension SheetBar where Trailing == EmptyView {
    init(title: String, close: @escaping () -> Void) { self.init(title: title, close: close) { EmptyView() } }
}

/// Content rises into place once, staggered by its order on the page.
struct Rise: ViewModifier {
    let order: Int
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shown = false

    func body(content: Content) -> some View {
        content
            .opacity(shown ? 1 : 0)
            .offset(y: shown || reduceMotion ? 0 : 10)
            .onAppear { withAnimation(Motion.rise.delay(Double(order) * 0.05)) { shown = true } }
    }
}

extension View {
    func rise(_ order: Int = 0) -> some View { modifier(Rise(order: order)) }

    /// Keeps a scrolling page at a comfortable reading width on wide windows.
    func readable(_ limit: CGFloat = 640) -> some View { frame(maxWidth: limit).frame(maxWidth: .infinity) }
}

// MARK: - Pages and rows

/// A pushed page: the system navigation bar (back swipe and all) over scrolling content.
struct Page<Content: View, Trailing: View>: View {
    let title: String
    @ViewBuilder var trailing: Trailing
    @ViewBuilder var content: Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) { content }
                .padding(.horizontal, Metrics.gutter)
                .padding(.top, 10)
                .padding(.bottom, 28)
                .readable()
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { trailing } }
        .paperBackground()
    }
}

/// A section's heading, as in the system's own browse screens: bold, with a chevron when it leads somewhere.
struct SectionHeader: View {
    let title: String
    var action: (() -> Void)?

    var body: some View {
        Button { action?() } label: {
            HStack(spacing: 6) {
                Text(title).type(.title)
                if action != nil { Image(systemName: "chevron.right").font(.system(size: 15, weight: .bold)).foregroundStyle(Color.ink3) }
                Spacer(minLength: 0)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(Pressable(scale: 1))
        .disabled(action == nil)
        .accessibilityAddTraits(.isHeader)
        .padding(.horizontal, Metrics.gutter)
        .padding(.top, 26)
        .padding(.bottom, 12)
    }
}

extension Page where Trailing == EmptyView {
    init(title: String, @ViewBuilder content: () -> Content) {
        self.init(title: title, trailing: { EmptyView() }, content: content)
    }
}

/// Rows that belong together, on one card with a hairline ring.
struct RowGroup<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(spacing: 0) { content }
            .background(Color.card, in: RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
            .clipShape(RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous).strokeBorder(Color.line, lineWidth: 1))
    }
}

/// One line of a group: a thin glyph, a title, an optional value, and where it leads.
struct RowLabel: View {
    var symbol: String?
    let title: String
    var value: String?
    var badge: Int?
    var chevron = true
    var danger = false
    var divider = true

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 14) {
                if let symbol {
                    Image(systemName: symbol).font(.system(size: 17, weight: .light)).foregroundStyle(danger ? Color.danger : Color.ink).frame(width: 24)
                }
                Text(title).type(.body, danger ? .danger : .ink)
                Spacer(minLength: 8)
                if let badge, badge > 0 {
                    Text("\(badge)").font(.system(size: 12, weight: .medium).monospacedDigit()).foregroundStyle(Color.onInk)
                        .padding(.horizontal, 7).frame(minWidth: 22, minHeight: 22).background(Color.action, in: Capsule())
                }
                if let value { Text(value).type(.callout, .ink3) }
                if chevron { Image(systemName: "chevron.right").font(.system(size: 12, weight: .medium)).foregroundStyle(Color.ink4) }
            }
            .padding(.horizontal, 16)
            .frame(minHeight: 54)
            if divider { Hairline(inset: symbol == nil ? 16 : 54) }
        }
        .contentShape(Rectangle())
    }
}
