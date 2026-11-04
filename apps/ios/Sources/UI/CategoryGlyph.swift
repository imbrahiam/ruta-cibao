import SwiftUI

/// How a category looks on iOS: an SF Symbol and a system colour.
///
/// The admin panel stays in charge. Categories are database rows with a Lucide
/// icon name and a hex colour; iOS maps the icon to its SF Symbol and the hex
/// to the *nearest system colour by hue* (grey when unsaturated, brown for a
/// dark orange). A colour changed in the panel shows up on the iPhone without
/// a release, while staying native: system colours follow dark mode and
/// Increase Contrast. An icon this table doesn't know gets a generic symbol,
/// still in the panel's colour.
enum CategoryGlyph {
    struct Style {
        let symbol: String
        let color: Color
    }

    static func style(_ lucide: String, hex: String) -> Style {
        Style(symbol: symbol(lucide), color: nativeColor(hex: hex) ?? fallback(lucide).color)
    }

    static func symbol(_ lucide: String) -> String { fallback(lucide).symbol }

    /// The closest system colour to an admin-chosen hex.
    static func nativeColor(hex: String) -> Color? {
        var value = hex.trimmingCharacters(in: .whitespaces)
        if value.hasPrefix("#") { value.removeFirst() }
        guard value.count == 6, let rgb = UInt32(value, radix: 16) else { return nil }
        let r = Double((rgb >> 16) & 0xFF) / 255, g = Double((rgb >> 8) & 0xFF) / 255, b = Double(rgb & 0xFF) / 255
        let maxC = max(r, g, b), minC = min(r, g, b), delta = maxC - minC
        let saturation = maxC == 0 ? 0 : delta / maxC
        if saturation < 0.4 || delta < 0.08 { return .gray }
        var hue: Double
        if maxC == r { hue = 60 * ((g - b) / delta).truncatingRemainder(dividingBy: 6) }
        else if maxC == g { hue = 60 * ((b - r) / delta + 2) }
        else { hue = 60 * ((r - g) / delta + 4) }
        if hue < 0 { hue += 360 }
        if (15...45).contains(hue), maxC < 0.6 { return .brown }
        let wheel: [(Double, Color)] = [
            (0, .red), (28, .orange), (50, .yellow), (135, .green), (165, .mint),
            (185, .teal), (200, .cyan), (215, .blue), (245, .indigo), (280, .purple), (330, .pink), (360, .red),
        ]
        return wheel.min { abs($0.0 - hue) < abs($1.0 - hue) }?.1
    }

    /// Symbol per Lucide name, with the colour used only if the hex is unusable.
    private static func fallback(_ lucide: String) -> Style {
        switch lucide {
        case "utensils": Style(symbol: "fork.knife", color: .orange)
        case "coffee": Style(symbol: "cup.and.saucer.fill", color: .orange)
        case "bed-double": Style(symbol: "bed.double.fill", color: .purple)
        case "fuel": Style(symbol: "fuelpump.fill", color: .blue)
        case "car": Style(symbol: "car.fill", color: .blue)
        case "bus": Style(symbol: "bus.fill", color: .blue)
        case "bike": Style(symbol: "bicycle", color: .blue)
        case "route": Style(symbol: "road.lanes", color: .indigo)
        case "footprints": Style(symbol: "figure.hiking", color: .green)
        case "trees": Style(symbol: "tree.fill", color: .green)
        case "wheat": Style(symbol: "leaf.fill", color: .green)
        case "waves": Style(symbol: "water.waves", color: .cyan)
        case "droplets": Style(symbol: "drop.fill", color: .cyan)
        case "cloud-rain": Style(symbol: "cloud.rain.fill", color: .cyan)
        case "graduation-cap": Style(symbol: "graduationcap.fill", color: .brown)
        case "building-2": Style(symbol: "building.2.fill", color: .mint)
        case "landmark": Style(symbol: "building.columns.fill", color: .gray)
        case "church": Style(symbol: "building.columns.fill", color: .gray)
        case "pill": Style(symbol: "pills.fill", color: .pink)
        case "cross": Style(symbol: "cross.case.fill", color: .red)
        case "shopping-basket": Style(symbol: "basket.fill", color: .yellow)
        case "lightbulb": Style(symbol: "lightbulb.fill", color: .yellow)
        case "trash-2": Style(symbol: "trash.fill", color: .gray)
        case "wrench": Style(symbol: "wrench.and.screwdriver.fill", color: .gray)
        case "triangle-alert": Style(symbol: "exclamationmark.triangle.fill", color: .orange)
        case "octagon-x": Style(symbol: "xmark.octagon.fill", color: .red)
        default: Style(symbol: "mappin", color: .gray)
        }
    }

}

/// The map pin's look off the map: the category colour filled, its glyph in
/// white, so the sheet reads as "this pin" at a glance.
struct CategoryPinBadge: View {
    let icon: String
    let hex: String
    var size: CGFloat = 48

    var body: some View {
        let style = CategoryGlyph.style(icon, hex: hex)
        PinBadge(symbol: style.symbol, color: style.color, size: size)
    }
}

/// The map pin's look off the map: a filled colour disc, white glyph.
struct PinBadge: View {
    let symbol: String
    let color: Color
    var size: CGFloat = 48

    var body: some View {
        Circle()
            .fill(color.gradient)
            .frame(width: size, height: size)
            .overlay {
                Image(systemName: symbol)
                    .font(.system(size: size * 0.44, weight: .semibold))
                    .foregroundStyle(.white)
            }
            .accessibilityHidden(true)
    }
}
