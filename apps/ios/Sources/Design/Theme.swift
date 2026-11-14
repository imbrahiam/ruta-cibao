import RutaKit
import SwiftUI
import UIKit

/// One palette computed from the mark's iris (#7860A8): cream paper, violet-leaning ink and
/// greys, and muted accents around it. Dark follows the system.
extension Color {
    // Nonisolated: SwiftUI resolves dynamic colours from its render thread too.
    nonisolated fileprivate static func pair(_ light: UInt32, _ dark: UInt32, alpha: CGFloat = 1) -> Color {
        Color(UIColor { @Sendable traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(
                red: CGFloat((hex >> 16) & 0xFF) / 255,
                green: CGFloat((hex >> 8) & 0xFF) / 255,
                blue: CGFloat(hex & 0xFF) / 255,
                alpha: alpha
            )
        })
    }

    // Every neutral leans a little toward the mark's iris (hue 260), so black, grey and
    // silver belong to the same family as the logo; the paper is its warm counterpart, cream.
    static let ink = pair(0x17151C, 0xF3F1F6)
    static let ink2 = pair(0x55515E, 0xB6B2BF)
    static let ink3 = pair(0x6E6A78, 0x9995A3)
    static let ink4 = pair(0xB4B0BC, 0x58545F)
    static let paper = pair(0xFAF8F4, 0x121116)
    static let paper2 = pair(0xF2EEE7, 0x26242C)
    static let paper3 = pair(0xE8E3DA, 0x302E37)
    static let line = pair(0xDDD7CC, 0x35323D)
    static let card = pair(0xFFFFFF, 0x1D1B22)
    /// Text and glyphs on an ink fill.
    static let onInk = pair(0xFAF8F4, 0x17151C)
    static let success = pair(0x3F7D5A, 0x7FBF98)
    static let warning = pair(0xB07A1F, 0xE0B45A)
    static let danger = pair(0xC4473F, 0xEE7A70)
    /// The brand iris: the mark's field, tints and links.
    static let iris = pair(0x7860A8, 0xA590D6)
    /// The iris deep enough to read as text: the selected tab, links.
    static let irisDeep = pair(0x5F4A8C, 0xB9A6E6)
    /// The main action's fill: the mark's iris taken down to a deep indigo; at night the
    /// button stays light, like ink.
    static let action = pair(0x44367C, 0xF3F1F6)
    static let scrim = pair(0x17151C, 0x000000, alpha: 0.32)
    /// The landing's location pin.
    static let pin = pair(0xC4473F, 0xEE7A70)
}

/// The accents, all built around the iris: its own lavender, its complement (straw), and the
/// quiet neighbours either side: sage, denim, dusty rose, camel. Each has a soft fill with a
/// deep glyph for lists, and one solid mid-tone for map markers. Same lightness and chroma
/// across the set, so no one colour shouts.
enum Tint: CaseIterable {
    case mint, butter, lavender, denim, rose, camel, neutral

    var fill: Color {
        switch self {
        case .mint: Color.tone(0xE3EADB, 0x2A3324)
        case .butter: Color.tone(0xF6ECC9, 0x3A321C)
        case .lavender: Color.tone(0xEAE4F6, 0x2F2840)
        case .denim: Color.tone(0xDDE6F1, 0x22304A)
        case .rose: Color.tone(0xF4E1E1, 0x40262B)
        case .camel: Color.tone(0xEFDFC9, 0x3B2C1B)
        case .neutral: .paper2
        }
    }

    var ink: Color {
        switch self {
        case .mint: Color.tone(0x4F6645, 0xB7CFA6)
        case .butter: Color.tone(0x7A6428, 0xE3CB8E)
        case .lavender: Color.tone(0x5F4A8C, 0xC7B5E6)
        case .denim: Color.tone(0x3D5A80, 0xA9C1E6)
        case .rose: Color.tone(0x96505A, 0xE8B4BC)
        case .camel: Color.tone(0x8A5F2E, 0xE0BE94)
        case .neutral: .ink
        }
    }

    /// A marker's colour: white glyphs read on every one.
    var solid: Color {
        switch self {
        case .mint: Color.tone(0x6B8A5E, 0x7D9C70)
        case .butter: Color.tone(0xB8922E, 0xC6A244)
        case .lavender: Color.tone(0x7860A8, 0x8A72BA)
        case .denim: Color.tone(0x4A6FA5, 0x5C81B5)
        case .rose: Color.tone(0xB9667A, 0xC7788B)
        case .camel: Color.tone(0xA9753C, 0xB98750)
        case .neutral: Color.tone(0x5A5665, 0x76727F)
        }
    }

    /// A category's admin colour, folded onto the nearest accent by hue.
    static func of(hex: String) -> Tint {
        var value = hex.trimmingCharacters(in: .whitespaces)
        if value.hasPrefix("#") { value.removeFirst() }
        guard value.count == 6, let rgb = UInt32(value, radix: 16) else { return .neutral }
        let r = Double((rgb >> 16) & 0xFF) / 255, g = Double((rgb >> 8) & 0xFF) / 255, b = Double(rgb & 0xFF) / 255
        let high = max(r, g, b), delta = high - min(r, g, b)
        guard high > 0, delta / high > 0.25 else { return .neutral }
        var hue = high == r ? 60 * ((g - b) / delta).truncatingRemainder(dividingBy: 6) : high == g ? 60 * ((b - r) / delta + 2) : 60 * ((r - g) / delta + 4)
        if hue < 0 { hue += 360 }
        switch hue {
        case 0..<18, 325...360: return .rose
        case 18..<42: return .camel
        case 42..<70: return .butter
        case 70..<175: return .mint
        case 175..<255: return .denim
        default: return .lavender
        }
    }
}

extension Color {
    nonisolated static func tone(_ light: UInt32, _ dark: UInt32) -> Color { pair(light, dark) }
}

/// The landing's type: light weights, tight tracking on large sizes, small quiet captions.
enum TextStyle {
    /// Screen titles: large, regular weight, tracked in.
    case display
    case title
    case heading
    case body
    case bodyStrong
    case callout
    case caption
    case label

    var font: Font {
        switch self {
        case .display: .system(size: 34, weight: .bold)
        case .title: .system(size: 22, weight: .bold)
        case .heading: .system(size: 17, weight: .semibold)
        case .body: .system(size: 16, weight: .regular)
        case .bodyStrong: .system(size: 16, weight: .medium)
        case .callout: .system(size: 14, weight: .regular)
        case .caption: .system(size: 12.5, weight: .regular)
        case .label: .system(size: 14, weight: .medium)
        }
    }

    /// The landing tracks headlines at -0.03em and leaves text alone.
    var tracking: CGFloat {
        switch self {
        case .display: -0.6
        case .title: -0.4
        case .heading: -0.35
        default: -0.1
        }
    }

    /// Scales with Dynamic Type against the closest system style.
    var relative: Font.TextStyle {
        switch self {
        case .display: .largeTitle
        case .title: .title2
        case .heading: .headline
        case .body, .bodyStrong: .body
        case .callout, .label: .subheadline
        case .caption: .caption
        }
    }
}

private struct Typed: ViewModifier {
    let style: TextStyle
    @ScaledMetric private var scale: CGFloat = 1

    func body(content: Content) -> some View {
        content.font(style.font).tracking(style.tracking)
    }
}

extension View {
    func type(_ style: TextStyle, _ color: Color = .ink) -> some View {
        modifier(Typed(style: style)).foregroundStyle(color)
    }

    /// The page surface behind a whole screen.
    func paperBackground() -> some View { background(Color.paper.ignoresSafeArea()) }

    /// A floating surface: hairline ring and the landing's soft shadow. Only for things
    /// that sit over something else (the tab bar, controls over the map).
    func floating<S: InsettableShape>(in shape: S) -> some View {
        background(Color.card, in: shape)
            .overlay(shape.strokeBorder(Color.ink.opacity(0.07), lineWidth: 1))
            .shadow(color: .black.opacity(0.07), radius: 9, y: 4)
    }
}

enum Metrics {
    static let gutter: CGFloat = 20
    static let radiusField: CGFloat = 14
    static let radiusCard: CGFloat = 18
    static let radiusPanel: CGFloat = 26
    static let tap: CGFloat = 48
}

enum Motion {
    static let quick = Animation.snappy(duration: 0.22)
    static let settle = Animation.spring(duration: 0.42, bounce: 0.18)
    static let rise = Animation.spring(duration: 0.5, bounce: 0.1)
}

extension EnvironmentValues {
    /// The app graph. Previews and tests can inject their own.
    @Entry var graph: AppGraph? = nil
}

/// Test hooks for simulator runs, inert in Release. A value comes from the environment
/// (`SIMCTL_CHILD_RUTA_DEBUG_TAB=map`) or from a launch argument (`-RUTA_DEBUG_TAB map`).
enum DebugHook {
    static func value(_ key: String) -> String? {
        #if DEBUG
        ProcessInfo.processInfo.environment[key] ?? UserDefaults.standard.string(forKey: key)
        #else
        nil
        #endif
    }
}
