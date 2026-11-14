import SwiftUI

/// Categories are database rows with a Lucide icon name and a hex colour. The app maps the
/// name to an SF Symbol; the colour is used only where colour carries meaning (map pins).
enum Glyph {
    /// Outline symbols, like the landing's thin icons. The map's pins ask for the filled ones.
    static func symbol(_ lucide: String, filled: Bool = false) -> String {
        let name = table[lucide] ?? "mappin"
        return filled || !name.hasSuffix(".fill") ? name : String(name.dropLast(5))
    }

    private static let table: [String: String] = [
        "utensils": "fork.knife",
        "coffee": "cup.and.saucer.fill",
        "bed-double": "bed.double.fill",
        "fuel": "fuelpump.fill",
        "car": "car.fill",
        "bus": "bus.fill",
        "bike": "bicycle",
        "route": "road.lanes",
        "footprints": "figure.hiking",
        "trees": "tree.fill",
        "wheat": "leaf.fill",
        "waves": "water.waves",
        "droplets": "drop.fill",
        "cloud-rain": "cloud.rain.fill",
        "graduation-cap": "graduationcap.fill",
        "building-2": "building.2.fill",
        "landmark": "building.columns.fill",
        "church": "building.columns.fill",
        "pill": "pills.fill",
        "cross": "cross.case.fill",
        "shopping-basket": "basket.fill",
        "lightbulb": "lightbulb.fill",
        "trash-2": "trash.fill",
        "wrench": "wrench.and.screwdriver.fill",
        "triangle-alert": "exclamationmark.triangle.fill",
        "flag": "flag.fill",
        "image": "photo.fill",
        "store": "storefront.fill",
        "shield-alert": "exclamationmark.shield.fill",
        "messages-square": "bubble.left.and.bubble.right.fill",
        "octagon-x": "xmark.octagon.fill",
    ]
}

extension Color {
    /// `#RRGGBB` from the admin panel; nil when malformed.
    init?(hex: String) {
        var value = hex.trimmingCharacters(in: .whitespaces)
        if value.hasPrefix("#") { value.removeFirst() }
        guard value.count == 6, let rgb = UInt32(value, radix: 16) else { return nil }
        self.init(red: Double((rgb >> 16) & 0xFF) / 255, green: Double((rgb >> 8) & 0xFF) / 255, blue: Double(rgb & 0xFF) / 255)
    }
}
