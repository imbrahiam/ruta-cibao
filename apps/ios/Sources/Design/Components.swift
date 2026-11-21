import RutaKit
import SwiftUI

// MARK: - Buttons

/// A pill: the brand green for the one main action, quiet surfaces for the rest.
struct PillStyle: ButtonStyle {
    enum Kind { case ink, tonal, quiet, outline, danger }
    var kind: Kind = .ink
    var compact = false
    var fill = true
    /// The main action in the colour of the thing it acts on (a place's kind), not the brand's.
    var tint: Color?
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
            .overlay { if kind == .outline { Capsule().strokeBorder(Color.ink4, lineWidth: 1) } }
            .contentShape(Capsule())
            .opacity(enabled || off ? 1 : 0.4)
            // Pressed is felt at the finger: the pill gives a little.
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(Motion.quick, value: configuration.isPressed)
    }

    private var foreground: Color {
        switch kind {
        case .ink: .onInk
        case .tonal: .brandDeep
        case .quiet, .outline: .ink
        case .danger: .danger
        }
    }

    private var background: Color {
        switch kind {
        case .ink: tint ?? .action
        case .tonal: .brandSoft
        case .quiet, .danger: .paper2
        case .outline: .clear
        }
    }
}

extension ButtonStyle where Self == PillStyle {
    static var ink: PillStyle { PillStyle() }
    static var quiet: PillStyle { PillStyle(kind: .quiet) }
    /// The main action, filled with the colour of what it acts on.
    static func ink(tint: Color) -> PillStyle { PillStyle(tint: tint) }
    static func pill(_ kind: PillStyle.Kind, compact: Bool = false, fill: Bool = true) -> PillStyle {
        PillStyle(kind: kind, compact: compact, fill: fill)
    }
}

/// A round icon button: 44 pt target, one thin symbol. It rests on a quiet fill; over the map
/// it is a white disc with a shadow; the ways out (close, back) are Liquid Glass.
struct IconButton: View {
    let symbol: String
    let label: String
    var floating = false
    var glass = false
    /// On the brand header: a plain white line glyph, no disc behind it.
    var onBrand = false
    /// A smaller disc where room is tight (a sheet's heading); the target stays 44 points.
    var compact = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: onBrand ? 22 : compact ? 14 : 17, weight: compact ? .semibold : .regular))
                .foregroundStyle(onBrand ? Color.onInk : Color.ink)
                .frame(width: compact ? 34 : 44, height: compact ? 34 : 44)
                .modifier(Surface(floating: floating, glass: glass, onBrand: onBrand))
                .frame(width: 44, height: 44)
                .contentShape(Circle())
        }
        .buttonStyle(Pressable())
        .accessibilityLabel(label)
    }

    private struct Surface: ViewModifier {
        let floating: Bool
        let glass: Bool
        let onBrand: Bool
        func body(content: Content) -> some View {
            if onBrand {
                content
            } else if glass {
                content.glassEffect(.regular.interactive(), in: Circle())
            } else if floating {
                content.floating(in: Circle())
            } else {
                content.background(Color.paper2, in: Circle())
            }
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
            .background(configuration.isPressed ? Color.paper3 : .clear)
            .animation(Motion.quick, value: configuration.isPressed)
    }
}

// MARK: - Chips

struct Chip: View {
    let title: String
    var symbol: String?
    let selected: Bool
    /// Over the map: a white pill with a shadow, filled green when picked.
    var floating = false
    /// In a brand header: compact, a lighter green that turns white when picked.
    var onBrand = false
    /// A count beside the title (unread notices), in its own small pill.
    var badge: Int?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: onBrand ? 5 : 7) {
                if let symbol { Image(systemName: symbol).font(.system(size: onBrand ? 12 : 13, weight: .regular)) }
                Text(title)
                if let badge, badge > 0 {
                    Text("\(badge)")
                        .font(.system(size: 11.5, weight: .bold).monospacedDigit())
                        .foregroundStyle(onBrand && !selected ? Color.brandDeep : Color.onInk)
                        .padding(.horizontal, 6)
                        .frame(minWidth: 20, minHeight: 20)
                        .background(onBrand && !selected ? Color.onInk : Color.brand, in: Capsule())
                }
            }
            .type(.label, foreground)
            .fontWeight(selected ? .semibold : .medium)
            .padding(.horizontal, onBrand ? 12 : 14)
            .frame(height: onBrand ? 34 : 38)
            .modifier(ChipSurface(selected: selected, floating: floating, onBrand: onBrand))
            // The visible pill is compact; the finger still gets 44 points.
            .frame(minHeight: 44)
            .contentShape(Capsule())
        }
        .buttonStyle(Pressable())
        .accessibilityAddTraits(selected ? .isSelected : [])
        .sensoryFeedback(.selection, trigger: selected)
    }

    private var foreground: Color {
        if onBrand { return selected ? .brandDeep : .onInk }
        if selected { return floating ? .onInk : .brandDeep }
        return .ink
    }
}

/// A chip rests on the quiet fill; the pick takes the soft green, a green ring and a heavier
/// weight. Over the map it floats in white and the pick fills green.
private struct ChipSurface: ViewModifier {
    let selected: Bool
    let floating: Bool
    let onBrand: Bool

    func body(content: Content) -> some View {
        if onBrand {
            content.background(selected ? Color.onInk : Color.onInk.opacity(0.14), in: Capsule())
        } else if floating, selected {
            content.background(Color.brand, in: Capsule()).shadow(color: Color.ink.opacity(0.10), radius: 10, y: 3)
        } else if floating {
            content.floating(in: Capsule())
        } else {
            content
                .background(selected ? Color.brandSoft : Color.paper2, in: Capsule())
                .overlay { if selected { Capsule().strokeBorder(Color.brand, lineWidth: 1.5) } }
        }
    }
}

// MARK: - Fields

/// A text field: a quiet fill that takes a green ring when focused; the placeholder is the label.
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
        .background(Color.paper2, in: RoundedRectangle(cornerRadius: Metrics.radiusField, style: .continuous))
        .overlay {
            if focused { RoundedRectangle(cornerRadius: Metrics.radiusField, style: .continuous).strokeBorder(Color.action, lineWidth: 1.5) }
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

/// A glyph on a soft disc. Saturated colour stays on the map.
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

/// The location pin: a green teardrop with a white eye (24 by 28 box).
struct TeardropPin: View {
    var height: CGFloat = 42
    var color: Color = .pin

    var body: some View {
        Teardrop()
            .fill(color)
            .overlay { GeometryReader { box in Circle().fill(Color.onInk).frame(width: box.size.width / 3, height: box.size.width / 3).position(x: box.size.width / 2, y: box.size.height * 11 / 28) } }
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

/// Where something stands: its word on a soft wash of the state's colour, with the state's glyph
/// when it has one, so the state is read from the word and never from colour alone.
/// Over a photo the tag is solid white.
struct StatusTag: View {
    let text: String
    var color: Color = .ink3
    /// A glyph for the state, when it has one; otherwise the wash and the word say it.
    var symbol: String?
    var solid = false

    var body: some View {
        HStack(spacing: 5) {
            if let symbol { Image(systemName: symbol).font(.system(size: 11, weight: .semibold)).foregroundStyle(color) }
            Text(text).font(.system(size: 12.5, weight: .medium)).foregroundStyle(Color.ink)
        }
        .padding(.horizontal, 9)
        .frame(height: 24)
        .background(solid ? AnyShapeStyle(Color.paper) : AnyShapeStyle(color.opacity(0.12)), in: Capsule())
        .accessibilityElement(children: .combine)
    }
}

/// The mark ("Vínculo"): two links of a chain, drawn from the same paths as the brand's SVG
/// (256 unit box, the links scaled to 75% around the centre).
struct MarkLinks: View {
    var size: CGFloat = 56
    var color: Color = .onInk

    var body: some View {
        Canvas { context, canvas in
            var links = Path()
            links.move(to: CGPoint(x: 112, y: 78))
            links.addLine(to: CGPoint(x: 94, y: 60))
            links.addCurve(to: CGPoint(x: 36, y: 60), control1: CGPoint(x: 78, y: 44), control2: CGPoint(x: 52, y: 44))
            links.addCurve(to: CGPoint(x: 36, y: 118), control1: CGPoint(x: 20, y: 76), control2: CGPoint(x: 20, y: 102))
            links.addLine(to: CGPoint(x: 74, y: 156))
            links.addCurve(to: CGPoint(x: 132, y: 156), control1: CGPoint(x: 90, y: 172), control2: CGPoint(x: 116, y: 172))
            links.addLine(to: CGPoint(x: 148, y: 140))
            links.move(to: CGPoint(x: 144, y: 178))
            links.addLine(to: CGPoint(x: 162, y: 196))
            links.addCurve(to: CGPoint(x: 220, y: 196), control1: CGPoint(x: 178, y: 212), control2: CGPoint(x: 204, y: 212))
            links.addCurve(to: CGPoint(x: 220, y: 138), control1: CGPoint(x: 236, y: 180), control2: CGPoint(x: 236, y: 154))
            links.addLine(to: CGPoint(x: 182, y: 100))
            links.addCurve(to: CGPoint(x: 124, y: 100), control1: CGPoint(x: 166, y: 84), control2: CGPoint(x: 140, y: 84))
            links.addLine(to: CGPoint(x: 108, y: 116))
            let unit = canvas.width / 256
            let place = CGAffineTransform(translationX: 32, y: 32).scaledBy(x: 0.75, y: 0.75).concatenating(CGAffineTransform(scaleX: unit, y: unit))
            context.stroke(links.applying(place), with: .color(color), style: StrokeStyle(lineWidth: 27 * 0.75 * unit, lineCap: .round, lineJoin: .round))
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// The mark on its green tile, as the app icon shows it.
struct Mark: View {
    var size: CGFloat = 56

    var body: some View {
        MarkLinks(size: size)
            .background(Color.brand, in: RoundedRectangle(cornerRadius: size * 0.235, style: .continuous))
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
    /// The page's main way forward (signing in): a filled button instead of an outlined one.
    var prominent = false
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
                // A real button, so an empty or failed state reads as a next step.
                if prominent {
                    Button(actionTitle, action: action).buttonStyle(.ink).frame(maxWidth: 300).padding(.top, 6)
                } else {
                    Button(actionTitle, action: action).buttonStyle(.pill(.outline, compact: true, fill: false)).padding(.top, 4)
                }
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

/// Adding to the map, from any tab's header: the one solid white button on the green, like
/// the search's green one on white.
struct ContributeButton: View {
    @Environment(AppChrome.self) private var chrome: AppChrome?

    var body: some View {
        Button { chrome?.contributing = true } label: {
            // As tall as the search pill beside it, so the header's row reads as one line.
            Image(systemName: "plus")
                .font(.system(size: 19, weight: .bold))
                .foregroundStyle(Color.brand)
                .frame(width: 48, height: 48)
                .background(Color.onInk, in: Circle())
                .contentShape(Circle())
        }
        .buttonStyle(Pressable())
        .accessibilityLabel(L10n.Contributions.contribute)
    }
}

extension View {
    /// A sideways row that runs past an edge fades into its background instead of being cut by
    /// it. The fade is as wide as the row's own inset, so the first item is whole at rest.
    func edgeFade(_ width: CGFloat = Metrics.gutter) -> some View {
        mask {
            HStack(spacing: 0) {
                LinearGradient(colors: [.clear, .black], startPoint: .leading, endPoint: .trailing).frame(width: width)
                Color.black
                LinearGradient(colors: [.black, .clear], startPoint: .leading, endPoint: .trailing).frame(width: width)
            }
        }
    }

    /// A tab's own header in place of the system navigation bar: the title, what you can do
    /// here and adding to the map on one row, and the tab's filters under it, all on the brand green.
    /// The page scrolls under it. Pushed pages keep the system bar and its back swipe.
    func rootHeader<Trailing: View, Accessory: View>(_ title: String, @ViewBuilder trailing: () -> Trailing, @ViewBuilder accessory: () -> Accessory) -> some View {
        toolbarVisibility(.hidden, for: .navigationBar)
            .safeAreaInset(edge: .top, spacing: 0) {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 10) {
                        Text(title).font(.system(size: 28, weight: .bold)).tracking(-0.6).foregroundStyle(Color.onInk).accessibilityAddTraits(.isHeader)
                        Spacer(minLength: 8)
                        trailing()
                        ContributeButton()
                    }
                    .padding(.horizontal, Metrics.gutter)
                    accessory()
                }
                .padding(.top, 4)
                .padding(.bottom, 14)
                .brandHeader()
            }
    }

    func rootHeader<Accessory: View>(_ title: String, @ViewBuilder accessory: () -> Accessory) -> some View {
        rootHeader(title, trailing: { EmptyView() }, accessory: accessory)
    }

    /// The header's slab: the brand green from the top of the screen, rounded where it meets
    /// the page.
    func brandHeader() -> some View {
        background {
            UnevenRoundedRectangle(bottomLeadingRadius: Metrics.radiusPanel, bottomTrailingRadius: Metrics.radiusPanel, style: .continuous)
                .fill(Color.brand)
                .ignoresSafeArea(edges: .top)
        }
        .lightStatusBar()
    }
}

/// A row of filters inside a brand header, scrolling sideways when they do not fit.
struct HeaderFilters<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 6) { content }.padding(.horizontal, Metrics.gutter)
        }
        .scrollIndicators(.hidden)
        .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
        .edgeFade()
    }
}

/// A sheet or pushed form's top row: a centred title with the way out at the trailing edge.
/// When the sheet has its own main action (send a reply), that takes the trailing edge and the
/// way out moves to the leading one, as in the system's compose sheets.
struct SheetBar<Action: View>: View {
    let title: String
    let close: () -> Void
    @ViewBuilder var action: Action

    private var closeButton: some View { IconButton(symbol: "xmark", label: L10n.Common.close, glass: true, action: close) }

    var body: some View {
        ZStack {
            Text(title).type(.bodyStrong).accessibilityAddTraits(.isHeader)
            HStack {
                if Action.self != EmptyView.self { closeButton }
                Spacer()
                if Action.self == EmptyView.self { closeButton } else { action }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }
}

extension SheetBar where Action == EmptyView {
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
        .scrollEdgeEffectStyle(.hard, for: .top)
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

/// Rows that belong together, on one quiet slab.
struct RowGroup<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(spacing: 0) { content }
            .background(Color.paper2, in: RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
            .clipShape(RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
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
