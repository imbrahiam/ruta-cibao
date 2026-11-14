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
            // Chrome (back chevrons, menus, bar buttons) stays ink. The brand
            // green is spent on the current tab, switches and primary actions.
            .tint(palette.text)
            .toggleStyle(RutaSwitchStyle())
    }
}

/// The app chrome is neutral ink: black on light, white on dark. Switches are
/// system green and the support heart is system red.
enum RutaHighlight {
    /// For a selected control whose plain alternative is the label colour.
    static var selection: AnyShapeStyle { AnyShapeStyle(.primary) }
    /// For a switch that's on.
    static var toggle: Color { Color(.systemGreen) }
    /// For support you've given.
    static var support: Color { Color(.systemRed) }
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
            Button(role: configuration.role, action: configuration.trigger) {
                configuration.label.foregroundStyle(palette.onAccent)
            }
            .buttonStyle(.glassProminent)
            .tint(palette.accent)
        }
    }

    /// `color`, darkened in steps of the same hue until white text on it reaches 4.5:1.
    static func fill(forWhiteOn color: Color, _ scheme: ColorScheme) -> Color {
        let traits = UITraitCollection(userInterfaceStyle: scheme == .dark ? .dark : .light)
        var h: CGFloat = 0, sat: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        UIColor(color).resolvedColor(with: traits).getHue(&h, saturation: &sat, brightness: &b, alpha: &a)
        func contrast(_ ui: UIColor) -> CGFloat {
            var r: CGFloat = 0, g: CGFloat = 0, bl: CGFloat = 0, al: CGFloat = 0
            ui.getRed(&r, green: &g, blue: &bl, alpha: &al)
            func linear(_ c: CGFloat) -> CGFloat { c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4) }
            return 1.05 / (0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(bl) + 0.05)
        }
        var ui = UIColor(hue: h, saturation: sat, brightness: b, alpha: 1)
        while contrast(ui) < 4.5, b > 0.05 {
            b -= 0.02
            ui = UIColor(hue: h, saturation: sat, brightness: b, alpha: 1)
        }
        return Color(ui)
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


/// Threads' secondary button: a flat grey capsule with an ink label, no glass or border.
/// The same fill as the place sheet's Llamar/WhatsApp, one step up in dark.
struct RutaTonalStyle: ButtonStyle {
    @Environment(\.palette) private var palette
    @Environment(\.colorScheme) private var scheme

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(palette.text)
            .padding(.horizontal, 16)
            .frame(minHeight: 44)
            .background(scheme == .dark ? palette.fillPressed : palette.inset, in: Capsule())
            .opacity(configuration.isPressed ? 0.7 : 1)
            .contentShape(Capsule())
    }
}
