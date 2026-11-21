import RutaKit
import SwiftUI

/// One palette taken from the mark: its pine green for what you act on or have picked, and
/// nothing else green. Surfaces are white, ink and greys are neutral. Light only for now.
extension Color {
    nonisolated static func solid(_ hex: UInt32, alpha: Double = 1) -> Color {
        Color(.sRGB, red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255, opacity: alpha)
    }

    static let ink = solid(0x161718)
    static let ink2 = solid(0x5C5E62)
    /// The lightest text allowed: 5.2:1 on white, 4.7:1 on `paper2`.
    static let ink3 = solid(0x6A6C71)
    static let ink4 = solid(0xB4B6BA)
    static let paper = solid(0xFFFFFF)
    /// Groups, fields and chips resting on the page.
    static let paper2 = solid(0xF3F3F4)
    static let paper3 = solid(0xE8E8EA)
    static let line = solid(0xE1E1E4)
    static let card = solid(0xFFFFFF)
    /// Text and glyphs on a brand or ink fill.
    static let onInk = solid(0xFFFFFF)
    static let success = solid(0x2F7D57)
    static let warning = solid(0xB87503)
    static let danger = solid(0xC8372D)
    /// The mark's pine green: the selected tab, links, the verified seal, map pins.
    static let brand = solid(0x28594A)
    /// The green pressed, and as text on its own soft tint.
    static let brandDeep = solid(0x1F4739)
    /// A tonal button or a picked chip.
    static let brandSoft = solid(0xE6EFEB)
    /// The main action's fill.
    static let action = brand
    static let scrim = solid(0x161718, alpha: 0.32)
    static let pin = brand
    /// Support given to a post or a place.
    static let heart = solid(0xE0364A)
    /// "You are here" on the map.
    static let locate = solid(0x2F6FE4)
}

/// The colour of a kind of thing on the map. Categories are database rows with a hex chosen in
/// the admin panel; each folds onto the nearest of these by hue, so the map keeps one family of
/// colours that sit beside the brand green. Each is dark enough for white text at 4.5:1, so
/// the same tone fills a pin, a sheet's disc and that sheet's main button.
enum PinTone: String {
    case pine, moss, clay, ochre, sky, plum, slate
    /// What is happening on the road, and the eco routes.
    case blocked, caution, trail

    var hex: UInt32 {
        switch self {
        case .pine: 0x28594A
        // Green categories (parks, sport, pharmacies): a leaf green, so they never read as the brand's pine.
        case .moss: 0x5E7F2B
        case .clay: 0xB5523B
        case .ochre: 0x94661A
        case .sky: 0x2F6C96
        case .plum: 0x7B5596
        case .slate: 0x5A5C61
        case .blocked: 0xC8372D
        case .caution: 0x9C6400
        case .trail: 0x2F7D57
        }
    }

    var color: Color { .solid(hex) }
    /// The same colour for the map's own layers.
    var css: String { String(format: "#%06X", hex) }

    static func of(hex: String) -> PinTone {
        var value = hex.trimmingCharacters(in: .whitespaces)
        if value.hasPrefix("#") { value.removeFirst() }
        guard value.count == 6, let rgb = UInt32(value, radix: 16) else { return .slate }
        let r = Double((rgb >> 16) & 0xFF) / 255, g = Double((rgb >> 8) & 0xFF) / 255, b = Double(rgb & 0xFF) / 255
        let high = max(r, g, b), delta = high - min(r, g, b)
        guard high > 0, delta / high > 0.25 else { return .slate }
        var hue = high == r ? 60 * ((g - b) / delta).truncatingRemainder(dividingBy: 6) : high == g ? 60 * ((b - r) / delta + 2) : 60 * ((r - g) / delta + 4)
        if hue < 0 { hue += 360 }
        switch hue {
        case 0..<20, 335...360: return .clay
        case 20..<65: return .ochre
        case 65..<170: return .moss
        case 170..<250: return .sky
        default: return .plum
        }
    }
}

/// A list glyph's disc: quiet by default, the brand's soft green where the row is the app's own.
enum Tint {
    case brand, neutral
    /// A category's own colour with a white glyph, as on its map pin.
    case solid(Color)

    var fill: Color {
        switch self {
        case .brand: .brandSoft
        case .neutral: .paper3
        case .solid(let color): color
        }
    }

    var ink: Color {
        switch self {
        case .brand: .brandDeep
        case .neutral: .ink
        case .solid: .onInk
        }
    }
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
            .shadow(color: Color.ink.opacity(0.10), radius: 10, y: 3)
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
