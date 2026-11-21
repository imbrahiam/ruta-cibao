import SwiftUI

/// Categories are database rows with a Lucide icon name and a hex colour. The app maps the
/// name to an SF Symbol; the colour is used only where colour carries meaning (map pins).
enum Glyph {
    /// "Where": an address, a location field, a town. A plain pin; `mappin.and.ellipse` draws a
    /// pin on a disc that reads as a joystick at small sizes on iOS 27.
    static let location = "mappin"

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
        "trophy": "trophy.fill",
        "shield-alert": "exclamationmark.shield.fill",
        "messages-square": "bubble.left.and.bubble.right.fill",
        "octagon-x": "xmark.octagon.fill",
    ]
}

/// A category model or its existing SF Symbol when an admin adds an unfamiliar category.
struct CategoryArtwork: View {
    let model: PlaceModel?
    let symbol: String
    let size: CGFloat

    init(model: PlaceModel?, symbol: String, size: CGFloat) {
        self.model = model
        self.symbol = symbol
        self.size = size
    }

    init(icon: String, size: CGFloat) {
        self.init(model: PlaceModel(icon: icon), symbol: Glyph.symbol(icon, filled: true), size: size)
    }

    var body: some View {
        Group {
            if let model {
                Image(uiImage: model.image).resizable().scaledToFit()
            } else {
                Image(systemName: symbol).font(.system(size: size * 0.82, weight: .medium))
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

extension Color {
    var markerTint: Color { mix(with: .white, by: 0.16) }

    /// `#RRGGBB` from the admin panel; nil when malformed.
    init?(hex: String) {
        var value = hex.trimmingCharacters(in: .whitespaces)
        if value.hasPrefix("#") { value.removeFirst() }
        guard value.count == 6, let rgb = UInt32(value, radix: 16) else { return nil }
        self.init(red: Double((rgb >> 16) & 0xFF) / 255, green: Double((rgb >> 8) & 0xFF) / 255, blue: Double(rgb & 0xFF) / 255)
    }
}
