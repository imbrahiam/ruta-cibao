import RutaKit
import SwiftUI

extension EnvironmentValues {
    /// The app graph. Previews and tests can inject their own.
    @Entry var graph: AppGraph? = nil
    @Entry var palette: RutaPalette = .palette(.clasico, .light)
}

private struct RutaThemeModifier: ViewModifier {
    @Environment(\.colorScheme) private var scheme
    var theme: RutaTheme

    func body(content: Content) -> some View {
        let palette = RutaPalette.palette(theme, scheme)
        content
            .environment(\.palette, palette)
            .tint(palette.accent)
            .toggleStyle(RutaSwitchStyle())
    }
}

/// The app's own colour, kept to what Apple's guidance reserves an accent
/// for: the one primary action on a screen, where you are (the selected tab
/// and segment), what's on (switches) and what you've done (your support).
/// Not on filters, tiles or the location arrow: several can be on at once,
/// and the map's blue is the system's convention for "you".
/// One place to change it; set `enabled = false` to fall back to plain ink
/// and system green everywhere at once.
enum RutaHighlight {
    static let enabled = true
    /// Trial: primary buttons ("Cómo llegar", submit…) in the app colour too,
    /// instead of ink. Set to false to put them back to black/white.
    static let primaryButtons = true

    /// Iris, lifted in dark mode so it keeps its contrast on black.
    static let color = Color(UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0xA5 / 255, green: 0x8E / 255, blue: 0xD8 / 255, alpha: 1)
            : UIColor(red: 0x78 / 255, green: 0x60 / 255, blue: 0xA8 / 255, alpha: 1)
    })

    /// Primary buttons: solid iris in both modes, so white on it keeps its contrast.
    static let solid = Color(red: 0x78 / 255, green: 0x60 / 255, blue: 0xA8 / 255)
    /// Text and spinners on a primary button.
    static func onPrimary(_ palette: RutaPalette) -> Color { enabled && primaryButtons ? .white : palette.onAccent }

    /// For a selected control whose plain alternative is the label colour.
    static var selection: AnyShapeStyle { enabled ? AnyShapeStyle(color) : AnyShapeStyle(.primary) }
    /// For a switch that's on.
    static var toggle: Color { enabled ? color : Color(.systemGreen) }
    /// For support you've given.
    static var support: Color { enabled ? color : Color(.systemRed) }
}

/// Switches carry the highlight, never the accent: an "on" track tinted with
/// the accent turns white in clásico dark, and the white knob vanishes.
struct RutaSwitchStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Toggle(configuration).toggleStyle(.switch).tint(RutaHighlight.toggle)
    }
}

extension View {
    func rutaTheme(_ theme: RutaTheme = .clasico) -> some View {
        modifier(RutaThemeModifier(theme: theme))
    }
}

/// The one primary-button look: Liquid Glass prominent, tinted with the
/// theme accent, text always `onAccent` (in "clásico" dark the accent is
/// white, so the system's default white label would vanish).
struct RutaProminentStyle: PrimitiveButtonStyle {
    /// A colour of its own (a place's category colour, say) in place of the
    /// app's; the label turns black or white, whichever reads better on it.
    var tint: Color? = nil
    @Environment(\.palette) private var palette
    @Environment(\.colorScheme) private var scheme
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        if tint == nil, !isEnabled {
            // Clearly off, still legible: a neutral tonal fill and the secondary label colour,
            // which keeps over 4.5:1 on `fill` in both schemes while reading as inactive.
            // A plain label, not a Button: the system dims disabled buttons again.
            configuration.label
                .foregroundStyle(palette.textSecondary)
                .background(palette.fill, in: Capsule())
                .accessibilityAddTraits(.isButton)
        } else if let tint {
            // Exactly the badge's fill (the colour's own gradient), so the
            // button and the pin above it read as one colour.
            Button(role: configuration.role, action: configuration.trigger) {
                configuration.label.foregroundStyle(Self.ink(on: tint, scheme))
            }
            .buttonStyle(TintedCapsule(fill: tint))
        } else {
            let branded = RutaHighlight.enabled && RutaHighlight.primaryButtons
            Button(role: configuration.role, action: configuration.trigger) {
                configuration.label.foregroundStyle(RutaHighlight.onPrimary(palette))
            }
            .buttonStyle(.glassProminent)
            .tint(branded ? RutaHighlight.solid : palette.accent)
        }
    }

    /// White, as the badge's glyph is, while it keeps WCAG's 3:1 for large
    /// bold text (labels are semibold); black only on light colours.
    static func ink(on color: Color, _ scheme: ColorScheme) -> Color {
        let traits = UITraitCollection(userInterfaceStyle: scheme == .dark ? .dark : .light)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        UIColor(color).resolvedColor(with: traits).getRed(&r, green: &g, blue: &b, alpha: &a)
        func linear(_ c: CGFloat) -> CGFloat { c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4) }
        let luminance = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
        let onWhite = 1.05 / (luminance + 0.05)
        return onWhite >= 3 ? .white : .black
    }
}

/// A capsule filled with a colour's gradient, pressed like the system's.
private struct TintedCapsule: ButtonStyle {
    let fill: Color
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(fill.gradient, in: Capsule())
            .opacity(isEnabled ? 1 : 0.45)
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .brightness(configuration.isPressed ? -0.06 : 0)
            .animation(.snappy(duration: 0.15), value: configuration.isPressed)
            .contentShape(Capsule())
    }
}

