import SwiftUI

/// What a road notice is, as an illustrated icon drawn in code (the way navigation apps show
/// reports): a striped barricade for a closed road, a cone for a blocked lane, the hazard
/// triangle, a rain cloud for floods, cars for slow traffic, and the rest of the set ready for
/// new categories.
enum TrafficSignKind: String, CaseIterable {
    case closed, blockedLane, pothole, hazard, flood, traffic, crash, police

    /// From a traffic category's name or icon, as the API gives them.
    static func of(category: String, icon: String) -> TrafficSignKind {
        let key = "\(category) \(icon)".lowercased()
        if key.contains("bloque") || key.contains("cerrad") || key.contains("octagon") || key.contains("closed") { return .closed }
        if key.contains("carril") || key.contains("cone") || key.contains("lane") { return .blockedLane }
        if key.contains("hoyo") || key.contains("bache") || key.contains("pothole") { return .pothole }
        if key.contains("inund") || key.contains("lluvia") || key.contains("rain") || key.contains("flood") || key.contains("water") { return .flood }
        if key.contains("tapón") || key.contains("tapon") || key.contains("lento") || key.contains("slow") || key.contains("traffic") { return .traffic }
        if key.contains("choque") || key.contains("accidente") || key.contains("crash") { return .crash }
        if key.contains("polic") || key.contains("amet") || key.contains("police") { return .police }
        return .hazard
    }

    /// The colour the notice's stretch of road is drawn in.
    var lineCSS: String {
        switch self {
        case .closed, .blockedLane, .crash: "#D7352B"
        case .flood: "#2F6C96"
        case .police: "#3B5BA8"
        default: "#E39A0C"
        }
    }

    /// A closed road's stretch is drawn as a barrier: red and white stripes, with a marker at
    /// either end as well as the middle.
    var striped: Bool { self == .closed || self == .blockedLane }

    /// The soft disc behind the icon on the map's marker.
    var wash: Color {
        switch self {
        case .closed, .blockedLane, .crash: Color.solid(0xF9C3B6)
        case .flood: Color.solid(0xC7DDEE)
        case .police: Color.solid(0xCFD9F2)
        default: Color.solid(0xF9E0A6)
        }
    }
}

/// The illustrated icon alone, for a grid of report kinds or a sheet's heading.
struct TrafficSign: View {
    let kind: TrafficSignKind
    var size: CGFloat = 34

    var body: some View {
        Canvas { context, canvas in TrafficArt.draw(kind, in: &context, size: canvas) }
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

/// The icon on its soft disc, as a sheet's heading or a report grid shows it.
struct TrafficBadge: View {
    let kind: TrafficSignKind
    var size: CGFloat = 40

    var body: some View {
        TrafficSign(kind: kind, size: size * 0.66)
            .frame(width: size, height: size)
            .background(kind.wash, in: Circle())
    }
}

/// A notice on the map: its icon in a round marker with a white ring and a short point, so it
/// reads at street zoom without hiding the road.
struct TrafficMarker: View {
    let kind: TrafficSignKind
    var selected = false
    var body: some View {
        MapMarkerBadge(fill: kind.wash, selected: selected) {
            TrafficSign(kind: kind, size: MapMarkerBadgeMetrics.diameter * (kind == .pothole ? 0.57 : 0.66))
                .offset(y: kind == .pothole ? -0.5 : 0)
        }
    }
}

enum MapMarkerBadgeMetrics {
    static let diameter: CGFloat = 30
    static let tipHeight: CGFloat = 5
    static let height = diameter + tipHeight - 1
}

struct MapMarkerBadge<Icon: View>: View {
    let fill: Color
    let selected: Bool
    @ViewBuilder var icon: () -> Icon

    var body: some View {
        let diameter = MapMarkerBadgeMetrics.diameter
        VStack(spacing: -1) {
            ZStack {
                Circle().fill(Color.white)
                Circle().fill(fill).padding(2.5)
                icon()
            }
            .frame(width: diameter, height: diameter)
            Triangle().fill(Color.white).frame(width: 8, height: MapMarkerBadgeMetrics.tipHeight)
        }
        .compositingGroup()
        .shadow(color: .black.opacity(selected ? 0.32 : 0.24), radius: 3, y: 2)
        .animation(Motion.quick, value: selected)
    }
}

private nonisolated struct Triangle: Shape {
    func path(in rect: CGRect) -> Path {
        Path { p in
            p.move(to: CGPoint(x: rect.minX, y: rect.minY))
            p.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
            p.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
            p.closeSubpath()
        }
    }
}

/// The drawings, on a 100 × 100 grid scaled to the canvas. Flat colours with a dark outline:
/// readable at 20 points, friendly at 60.
private enum TrafficArt {
    static let outline = Color.solid(0x2B2B2E)
    static let red = Color.solid(0xE2402F)
    static let orange = Color.solid(0xF2812B)
    static let yellow = Color.solid(0xF7C51E)
    static let blue = Color.solid(0x2F7FD0)
    static let navy = Color.solid(0x2D4B9A)
    static let grey = Color.solid(0xA3A9AF)
    static let white = Color.white

    static func draw(_ kind: TrafficSignKind, in context: inout GraphicsContext, size: CGSize) {
        let k = min(size.width, size.height) / 100
        context.translateBy(x: (size.width - 100 * k) / 2, y: (size.height - 100 * k) / 2)
        context.scaleBy(x: k, y: k)
        let line = StrokeStyle(lineWidth: 5, lineCap: .round, lineJoin: .round)
        switch kind {
        case .closed: barricade(&context, line)
        case .blockedLane: cone(&context, line)
        case .pothole: pothole(&context, line)
        case .hazard: hazard(&context)
        case .flood: cloud(&context)
        case .traffic: cars(&context, line)
        case .crash: crash(&context, line)
        case .police: police(&context, line)
        }
    }

    private static func barricade(_ c: inout GraphicsContext, _ line: StrokeStyle) {
        for x in [26.0, 74.0] {
            let leg = Path(CGRect(x: x - 4, y: 46, width: 8, height: 40))
            c.fill(leg, with: .color(grey)); c.stroke(leg, with: .color(outline), style: line)
        }
        let board = Path(roundedRect: CGRect(x: 8, y: 22, width: 84, height: 28), cornerRadius: 5)
        c.fill(board, with: .color(white))
        c.drawLayer { layer in
            layer.clip(to: board)
            for x in stride(from: -20.0, through: 100, by: 22) {
                var stripe = Path()
                stripe.move(to: CGPoint(x: x, y: 50)); stripe.addLine(to: CGPoint(x: x + 11, y: 50))
                stripe.addLine(to: CGPoint(x: x + 25, y: 22)); stripe.addLine(to: CGPoint(x: x + 14, y: 22)); stripe.closeSubpath()
                layer.fill(stripe, with: .color(red))
            }
        }
        c.stroke(board, with: .color(outline), style: line)
    }

    private static func cone(_ c: inout GraphicsContext, _ line: StrokeStyle) {
        var body = Path()
        body.move(to: CGPoint(x: 42, y: 10)); body.addLine(to: CGPoint(x: 58, y: 10))
        body.addLine(to: CGPoint(x: 76, y: 80)); body.addLine(to: CGPoint(x: 24, y: 80)); body.closeSubpath()
        c.fill(body, with: .color(orange))
        c.drawLayer { layer in
            layer.clip(to: body)
            layer.fill(Path(CGRect(x: 0, y: 32, width: 100, height: 11)), with: .color(white))
            layer.fill(Path(CGRect(x: 0, y: 56, width: 100, height: 11)), with: .color(white))
        }
        c.stroke(body, with: .color(outline), style: line)
        let base = Path(roundedRect: CGRect(x: 14, y: 80, width: 72, height: 10), cornerRadius: 3)
        c.fill(base, with: .color(orange)); c.stroke(base, with: .color(outline), style: line)
    }

    private static func hazard(_ c: inout GraphicsContext) {
        var tri = Path()
        tri.move(to: CGPoint(x: 50, y: 10)); tri.addLine(to: CGPoint(x: 92, y: 84)); tri.addLine(to: CGPoint(x: 8, y: 84)); tri.closeSubpath()
        c.fill(tri, with: .color(yellow))
        c.stroke(tri, with: .color(outline), style: StrokeStyle(lineWidth: 6, lineCap: .round, lineJoin: .round))
        c.fill(Path(roundedRect: CGRect(x: 45, y: 34, width: 10, height: 28), cornerRadius: 5), with: .color(outline))
        c.fill(Path(ellipseIn: CGRect(x: 44.5, y: 67, width: 11, height: 11)), with: .color(outline))
    }

    /// A stretch of road seen ahead, its centre line, and a hole broken into it.
    private static func pothole(_ c: inout GraphicsContext, _ line: StrokeStyle) {
        var road = Path()
        road.move(to: CGPoint(x: 36, y: 12)); road.addLine(to: CGPoint(x: 64, y: 12))
        road.addLine(to: CGPoint(x: 92, y: 88)); road.addLine(to: CGPoint(x: 8, y: 88)); road.closeSubpath()
        c.fill(road, with: .color(Color.solid(0x6E747B)))
        c.drawLayer { layer in
            layer.clip(to: road)
            for (y, h) in [(14.0, 10.0), (34.0, 13.0), (58.0, 16.0)] {
                layer.fill(Path(CGRect(x: 47.5, y: y, width: 5, height: h)), with: .color(yellow))
            }
        }
        c.stroke(road, with: .color(outline), style: line)
        let rim = Path(ellipseIn: CGRect(x: 22, y: 56, width: 44, height: 22))
        c.fill(rim, with: .color(Color.solid(0x9EA4AA)))
        c.stroke(rim, with: .color(outline), style: StrokeStyle(lineWidth: 4))
        c.fill(Path(ellipseIn: CGRect(x: 28, y: 61, width: 32, height: 14)), with: .color(outline))
    }

    private static func cloud(_ c: inout GraphicsContext) {
        var cloud = Path()
        cloud.addEllipse(in: CGRect(x: 10, y: 30, width: 34, height: 30))
        cloud.addEllipse(in: CGRect(x: 28, y: 14, width: 42, height: 40))
        cloud.addEllipse(in: CGRect(x: 54, y: 28, width: 36, height: 32))
        cloud.addRoundedRect(in: CGRect(x: 20, y: 40, width: 62, height: 20), cornerSize: CGSize(width: 10, height: 10))
        // Stroked wide, then filled again, so only the outer edge of the outline shows.
        c.stroke(cloud, with: .color(outline), style: StrokeStyle(lineWidth: 10, lineCap: .round, lineJoin: .round))
        c.fill(cloud, with: .color(Color.solid(0xD3D8DE)))
        for (x, y) in [(30.0, 70.0), (50.0, 74.0), (70.0, 70.0)] {
            var drop = Path()
            drop.move(to: CGPoint(x: x, y: y)); drop.addLine(to: CGPoint(x: x - 6, y: y + 16))
            c.stroke(drop, with: .color(blue), style: StrokeStyle(lineWidth: 7, lineCap: .round))
        }
    }

    private static func car(_ c: inout GraphicsContext, _ line: StrokeStyle, at x: Double, _ y: Double, _ color: Color) {
        var roof = Path()
        roof.move(to: CGPoint(x: x + 8, y: y + 13)); roof.addLine(to: CGPoint(x: x + 14, y: y))
        roof.addLine(to: CGPoint(x: x + 32, y: y)); roof.addLine(to: CGPoint(x: x + 38, y: y + 13)); roof.closeSubpath()
        c.fill(roof, with: .color(Color.solid(0xCFE3F2))); c.stroke(roof, with: .color(outline), style: line)
        let body = Path(roundedRect: CGRect(x: x, y: y + 12, width: 46, height: 18), cornerRadius: 6)
        c.fill(body, with: .color(color)); c.stroke(body, with: .color(outline), style: line)
        for wx in [x + 6, x + 30] {
            c.fill(Path(ellipseIn: CGRect(x: wx, y: y + 24, width: 11, height: 11)), with: .color(outline))
        }
    }

    private static func cars(_ c: inout GraphicsContext, _ line: StrokeStyle) {
        car(&c, line, at: 46, 14, yellow)
        car(&c, line, at: 28, 36, orange)
        car(&c, line, at: 8, 58, red)
    }

    private static func crash(_ c: inout GraphicsContext, _ line: StrokeStyle) {
        car(&c, line, at: 2, 48, blue)
        car(&c, line, at: 52, 48, Color.solid(0x2FA36B))
        var burst = Path()
        let points = (0..<16).map { index -> CGPoint in
            let angle = Double(index) * .pi / 8 - .pi / 2
            let radius = index.isMultiple(of: 2) ? 26.0 : 13.0
            return CGPoint(x: 50 + cos(angle) * radius, y: 34 + sin(angle) * radius)
        }
        burst.addLines(points); burst.closeSubpath()
        c.fill(burst, with: .color(yellow)); c.stroke(burst, with: .color(outline), style: line)
    }

    private static func police(_ c: inout GraphicsContext, _ line: StrokeStyle) {
        let face = Path(ellipseIn: CGRect(x: 24, y: 36, width: 52, height: 52))
        c.fill(face, with: .color(Color.solid(0xC98B5E))); c.stroke(face, with: .color(outline), style: line)
        var cap = Path()
        cap.move(to: CGPoint(x: 18, y: 46)); cap.addQuadCurve(to: CGPoint(x: 82, y: 46), control: CGPoint(x: 50, y: 4)); cap.closeSubpath()
        c.fill(cap, with: .color(navy)); c.stroke(cap, with: .color(outline), style: line)
        c.fill(Path(roundedRect: CGRect(x: 16, y: 43, width: 68, height: 9), cornerRadius: 4), with: .color(outline))
        c.fill(Path(ellipseIn: CGRect(x: 44, y: 24, width: 12, height: 12)), with: .color(yellow))
        for x in [38.0, 56.0] { c.fill(Path(ellipseIn: CGRect(x: x, y: 60, width: 6, height: 6)), with: .color(outline)) }
        var smile = Path()
        smile.move(to: CGPoint(x: 40, y: 74)); smile.addQuadCurve(to: CGPoint(x: 60, y: 74), control: CGPoint(x: 50, y: 82))
        c.stroke(smile, with: .color(outline), style: StrokeStyle(lineWidth: 4, lineCap: .round))
    }
}

#Preview("Report icons") {
    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 4), spacing: 18) {
        ForEach(TrafficSignKind.allCases, id: \.self) { kind in
            VStack { TrafficSign(kind: kind, size: 48); TrafficMarker(kind: kind) }
        }
    }
    .padding()
}
