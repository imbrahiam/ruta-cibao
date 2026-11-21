import RutaKit
import SwiftUI

/// Photos full screen on the page's own background (white in light, black in dark): swipe between them, pinch or double-tap to zoom, drag down or
/// tap the close button to leave.
struct PhotoViewer: View {
    let urls: [String]
    @State var index: Int
    @Environment(\.dismiss) private var dismiss
    @State private var pull: CGFloat = 0

    var body: some View {
        TabView(selection: $index) {
            ForEach(Array(urls.enumerated()), id: \.offset) { offset, url in
                ZoomablePhoto(url: url, pull: $pull, leave: { dismiss() }).tag(offset)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: urls.count > 1 ? .always : .never))
        // The page dots sit on a pill of their own, so they read on a white page too.
        .indexViewStyle(.page(backgroundDisplayMode: .always))
        .background(Color(uiColor: .systemBackground).opacity(1 - min(pull / 500, 0.5)).ignoresSafeArea())
        .overlay(alignment: .topTrailing) {
            Button { dismiss() } label: {
                Image(systemName: "xmark").font(.system(size: 15, weight: .semibold)).foregroundStyle(Color(uiColor: .label))
                    .frame(width: 40, height: 40).background(Color(uiColor: .secondarySystemBackground), in: Circle())
                    .frame(width: 44, height: 44).contentShape(Circle())
            }
            .buttonStyle(Pressable())
            .accessibilityLabel(L10n.Common.close)
                .padding(.horizontal, 16)
                .padding(.top, 6)
        }
        .presentationBackground(.clear)
        .statusBarHidden()
    }
}

private struct ZoomablePhoto: View {
    let url: String
    @Binding var pull: CGFloat
    let leave: () -> Void
    @State private var scale: CGFloat = 1
    @State private var settled: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var rested: CGSize = .zero
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        AsyncImage(url: AppConfig.url(url)) { phase in
            if let image = phase.image {
                image.resizable().scaledToFit()
            } else if phase.error != nil {
                Image(systemName: "photo").font(.system(size: 28, weight: .light)).foregroundStyle(Color(uiColor: .tertiaryLabel))
            } else {
                ProgressView()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .scaleEffect(scale)
        .offset(x: offset.width, y: offset.height + (scale == 1 ? pull : 0))
        .contentShape(Rectangle())
        .gesture(
            MagnifyGesture()
                .onChanged { scale = min(max(settled * $0.magnification, 1), 5) }
                .onEnded { _ in
                    settled = scale
                    if scale == 1 { withAnimation(move) { offset = .zero; rested = .zero } }
                }
        )
        // Zoomed in, a drag moves the photo. At rest, a drag down pulls the viewer away and a
        // sideways one is left to the pager.
        .simultaneousGesture(
            DragGesture(minimumDistance: 12)
                .onChanged { drag in
                    if scale > 1 {
                        offset = CGSize(width: rested.width + drag.translation.width, height: rested.height + drag.translation.height)
                    } else if drag.translation.height > abs(drag.translation.width) {
                        pull = max(drag.translation.height, 0)
                    }
                }
                .onEnded { drag in
                    if scale > 1 { rested = offset; return }
                    if pull > 110 { leave() } else { withAnimation(move) { pull = 0 } }
                },
            isEnabled: true
        )
        .onTapGesture(count: 2) {
            withAnimation(move) {
                scale = scale > 1 ? 1 : 2.5
                settled = scale
                offset = .zero
                rested = .zero
            }
        }
        .accessibilityHidden(true)
    }

    private var move: Animation? { reduceMotion ? nil : .snappy(duration: 0.28) }
}

private struct OpensPhotos: ViewModifier {
    let urls: [String]
    let index: Int
    @State private var showing = false

    func body(content: Content) -> some View {
        content
            .contentShape(Rectangle())
            .onTapGesture { showing = true }
            .accessibilityElement()
            .accessibilityLabel(L10n.Place.photoOpen)
            .accessibilityAddTraits([.isButton, .isImage])
            .accessibilityAction { showing = true }
            .fullScreenCover(isPresented: $showing) { PhotoViewer(urls: urls, index: index) }
    }
}

extension View {
    /// A tap opens these photos full screen, starting at `index`.
    func opensPhotos(_ urls: [String], at index: Int = 0) -> some View { modifier(OpensPhotos(urls: urls, index: index)) }
}
