import SwiftUI

/// The 3D illustrations (masters in `design/illustrations`). Decorative:
/// every screen that shows one also says the same thing in words.
enum Art: String {
    case mailbox = "Mailbox", colmado = "Colmado"
}

/// One illustration, arriving with a small float-in (still under Reduce Motion).
struct Illustration: View {
    let art: Art
    var size: CGFloat = 220
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shown = false

    var body: some View {
        Image(art.rawValue)
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
            .scaleEffect(shown || reduceMotion ? 1 : 0.92)
            .offset(y: shown || reduceMotion ? 0 : 10)
            .opacity(shown || reduceMotion ? 1 : 0)
            .accessibilityHidden(true)
            .onAppear { withAnimation(.spring(duration: 0.6, bounce: 0.25)) { shown = true } }
    }
}

/// Airbnb's empty state: an illustration (or a quiet symbol), a bold line,
/// one quiet line.
struct EmptyState: View {
    var art: Art? = nil
    var symbol: String? = nil
    let title: String
    var message: String? = nil
    var size: CGFloat = 200
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(spacing: 10) {
            if let art {
                Illustration(art: art, size: size).padding(.bottom, 6)
            } else {
                // Threads' empty inbox: the glyph in a soft grey disc.
                Image(systemName: symbol ?? "tray")
                    .font(.system(size: 24, weight: .medium))
                    .foregroundStyle(palette.textTertiary)
                    .frame(width: 56, height: 56)
                    .background(palette.inset, in: Circle())
                    .padding(.bottom, 6)
                    .accessibilityHidden(true)
            }
            Text(title)
                .font(.system(size: art == nil ? 17 : 22, weight: .bold))
                .tracking(-0.3)
                .multilineTextAlignment(.center)
            if let message {
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(palette.textSecondary)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(.horizontal, 32)
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }
}
