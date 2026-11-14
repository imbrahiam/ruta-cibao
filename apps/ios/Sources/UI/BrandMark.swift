import SwiftUI

/// The Ruta Cibao mark: the green circle with the winding road, from
/// `brand/logo/mark.svg` (built by `scripts/brand/export-logo.ts`), kept as a
/// vector image so it stays crisp at any size. It settles in with a small
/// spring, or simply appears under Reduce Motion.
struct BrandMark: View {
    var size: CGFloat = 64
    var animated = true

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shown = false

    var body: some View {
        Image("BrandMark")
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
            .scaleEffect(shown ? 1 : 0.85)
            .opacity(shown ? 1 : 0)
            .accessibilityHidden(true)
            .onAppear {
                guard animated, !reduceMotion else { shown = true; return }
                withAnimation(.spring(duration: 0.6, bounce: 0.25).delay(0.05)) { shown = true }
            }
    }
}
