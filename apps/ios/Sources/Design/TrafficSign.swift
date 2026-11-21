import SwiftUI

/// What a road notice is, drawn the way the road itself would sign it: the red octagon for a
/// closed road, and the Dominican yellow diamond for hazards (a pothole, a flood, a warning).
enum TrafficSignKind: String, CaseIterable {
    case closed, pothole, flood, slow, caution

    /// From a traffic category's id or icon, as the API names them.
    static func of(category: String, icon: String) -> TrafficSignKind {
        let key = "\(category) \(icon)".lowercased()
        if key.contains("bloque") || key.contains("octagon") || key.contains("closed") { return .closed }
        if key.contains("hoyo") || key.contains("pothole") || key.contains("triangle") { return .pothole }
        if key.contains("inund") || key.contains("rain") || key.contains("flood") || key.contains("water") { return .flood }
        if key.contains("lento") || key.contains("slow") || key.contains("traffic") { return .slow }
        return .caution
    }

    /// The colour the notice's stretch of road is drawn in.
    var lineColor: Color {
        switch self {
        case .closed: Color.danger
        case .flood: Color.solid(0x2F6C96)
        default: Color.solid(0xD99A06)
        }
    }

    var lineCSS: String {
        switch self {
        case .closed: "#C8372D"
        case .flood: "#2F6C96"
        default: "#D99A06"
        }
    }
}

/// A road sign, drawn in code so it stays sharp at any size: the shape, its border, and a
/// glyph that says what is on the road.
struct TrafficSign: View {
    let kind: TrafficSignKind
    var size: CGFloat = 34
    /// A raised sign has a white rim and a soft shadow, to stand on the map.
    var raised = true

    var body: some View {
        ZStack {
            switch kind {
            case .closed:
                Octagon().fill(Color.white).frame(width: size, height: size)
                Octagon().fill(Color.danger).padding(size * 0.06).frame(width: size, height: size)
                Octagon().strokeBorder(Color.white, lineWidth: size * 0.035).padding(size * 0.11).frame(width: size, height: size)
                // A white bar: no way through.
                RoundedRectangle(cornerRadius: size * 0.04).fill(Color.white).frame(width: size * 0.52, height: size * 0.14)
            default:
                Diamond().fill(Color.white).frame(width: size * 1.08, height: size * 1.08)
                Diamond().fill(Color.solid(0xF4C21B)).padding(size * 0.07).frame(width: size * 1.08, height: size * 1.08)
                Diamond().strokeBorder(Color.ink, lineWidth: size * 0.045).padding(size * 0.13).frame(width: size * 1.08, height: size * 1.08)
                glyph.foregroundStyle(Color.ink)
            }
        }
        .compositingGroup()
        .shadow(color: .black.opacity(raised ? 0.28 : 0), radius: 2.5, y: 1.5)
        .accessibilityHidden(true)
    }

    @ViewBuilder private var glyph: some View {
        switch kind {
        case .pothole:
            // A dip in the road: the surface line broken by a hollow.
            PotholeGlyph().stroke(style: StrokeStyle(lineWidth: size * 0.065, lineCap: .round, lineJoin: .round)).frame(width: size * 0.46, height: size * 0.24)
        case .flood:
            Image(systemName: "water.waves").font(.system(size: size * 0.32, weight: .bold))
        case .slow:
            Image(systemName: "car.rear.and.tire.marks").font(.system(size: size * 0.28, weight: .bold))
        default:
            Text("!").font(.system(size: size * 0.42, weight: .black))
        }
    }
}

private nonisolated struct Octagon: InsettableShape {
    var inset: CGFloat = 0

    func path(in rect: CGRect) -> Path {
        let r = rect.insetBy(dx: inset, dy: inset)
        // A regular octagon in a square cuts each corner at w / (2 + √2).
        let c = r.width / (2 + sqrt(2))
        return Path { p in
            p.move(to: CGPoint(x: r.minX + c, y: r.minY))
            p.addLine(to: CGPoint(x: r.maxX - c, y: r.minY))
            p.addLine(to: CGPoint(x: r.maxX, y: r.minY + c))
            p.addLine(to: CGPoint(x: r.maxX, y: r.maxY - c))
            p.addLine(to: CGPoint(x: r.maxX - c, y: r.maxY))
            p.addLine(to: CGPoint(x: r.minX + c, y: r.maxY))
            p.addLine(to: CGPoint(x: r.minX, y: r.maxY - c))
            p.addLine(to: CGPoint(x: r.minX, y: r.minY + c))
            p.closeSubpath()
        }
    }

    func inset(by amount: CGFloat) -> Octagon { var copy = self; copy.inset += amount; return copy }
}

private nonisolated struct Diamond: InsettableShape {
    var inset: CGFloat = 0

    func path(in rect: CGRect) -> Path {
        let r = rect.insetBy(dx: inset, dy: inset)
        let corner = r.width * 0.06
        return Path { p in
            p.move(to: CGPoint(x: r.midX, y: r.minY + corner))
            p.addQuadCurve(to: CGPoint(x: r.midX + corner, y: r.minY + corner * 1.6), control: CGPoint(x: r.midX + corner * 0.3, y: r.minY))
            p.addLine(to: CGPoint(x: r.maxX - corner * 1.6, y: r.midY - corner))
            p.addQuadCurve(to: CGPoint(x: r.maxX - corner * 1.6, y: r.midY + corner), control: CGPoint(x: r.maxX, y: r.midY))
            p.addLine(to: CGPoint(x: r.midX + corner, y: r.maxY - corner * 1.6))
            p.addQuadCurve(to: CGPoint(x: r.midX - corner, y: r.maxY - corner * 1.6), control: CGPoint(x: r.midX, y: r.maxY))
            p.addLine(to: CGPoint(x: r.minX + corner * 1.6, y: r.midY + corner))
            p.addQuadCurve(to: CGPoint(x: r.minX + corner * 1.6, y: r.midY - corner), control: CGPoint(x: r.minX, y: r.midY))
            p.addLine(to: CGPoint(x: r.midX - corner, y: r.minY + corner * 1.6))
            p.addQuadCurve(to: CGPoint(x: r.midX, y: r.minY + corner), control: CGPoint(x: r.midX - corner * 0.3, y: r.minY))
            p.closeSubpath()
        }
    }

    func inset(by amount: CGFloat) -> Diamond { var copy = self; copy.inset += amount; return copy }
}

/// The road's surface with a hollow in it.
private nonisolated struct PotholeGlyph: Shape {
    func path(in rect: CGRect) -> Path {
        Path { p in
            p.move(to: CGPoint(x: rect.minX, y: rect.minY + rect.height * 0.2))
            p.addLine(to: CGPoint(x: rect.minX + rect.width * 0.25, y: rect.minY + rect.height * 0.2))
            p.addQuadCurve(to: CGPoint(x: rect.minX + rect.width * 0.75, y: rect.minY + rect.height * 0.2), control: CGPoint(x: rect.midX, y: rect.maxY * 1.5))
            p.addLine(to: CGPoint(x: rect.maxX, y: rect.minY + rect.height * 0.2))
        }
    }
}

#Preview("Signs") {
    HStack(spacing: 18) { ForEach(TrafficSignKind.allCases, id: \.self) { TrafficSign(kind: $0, size: 44) } }.padding()
}
