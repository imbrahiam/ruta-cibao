import SwiftUI

/// The Encuentro mark (open C + meeting point) from `packages/shared/src/brand.ts`,
/// drawn as vectors so it stays crisp at any size and can draw itself in.
struct BrandMark: View {
    var size: CGFloat = 64
    var color: Color = RutaBrand.iris
    var animated = true

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var progress: CGFloat = 0

    var body: some View {
        let scale = size / 256
        ZStack {
            MarkCurve()
                .trim(from: 0, to: progress)
                .stroke(color, style: StrokeStyle(lineWidth: 32 * scale, lineCap: .round))
            Circle()
                .fill(color)
                .frame(width: 30 * scale, height: 30 * scale)
                .position(x: 207 * scale, y: 57 * scale)
                .scaleEffect(progress > 0.85 ? 1 : 0.01, anchor: .center)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
        .onAppear {
            guard animated, !reduceMotion else { progress = 1; return }
            withAnimation(.spring(duration: 1.1, bounce: 0.2).delay(0.1)) { progress = 1 }
        }
    }
}

nonisolated struct MarkCurve: Shape {
    func path(in rect: CGRect) -> Path {
        let s = rect.width / 256
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x * s, y: y * s) }
        var path = Path()
        path.move(to: p(190, 106))
        path.addCurve(to: p(127, 54), control1: p(181, 74), control2: p(158, 54))
        path.addCurve(to: p(54, 128), control1: p(86, 54), control2: p(54, 87))
        path.addCurve(to: p(127, 202), control1: p(54, 169), control2: p(86, 202))
        path.addCurve(to: p(193, 154), control1: p(158, 202), control2: p(182, 184))
        return path
    }
}
