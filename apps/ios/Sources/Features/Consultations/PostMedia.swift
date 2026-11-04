import RutaKit
import SwiftUI

/// A photo as the UI needs it, from whichever API shape carried it.
struct PostPhoto: Hashable {
    let url: String
    let width: Int
    let height: Int
    let alt: String?
}

extension PostPhoto {
    init(_ p: ConsultationsBrowseOutput.ItemPhoto) {
        self.init(url: p.url, width: Int(p.width), height: Int(p.height), alt: p.alt)
    }

    init(_ p: ConsultationsDetailOutput.Photo) {
        self.init(url: p.url, width: Int(p.width), height: Int(p.height), alt: p.alt)
    }
}

/// Threads-style media for a post: one photo spans the text column; several
/// become a carousel that starts at the column and bleeds off the right edge.
/// Space is reserved from the photo's own dimensions, so nothing jumps.
struct PostMedia: View {
    let photos: [PostPhoto]
    /// Where the text column starts, so the carousel lines up with the text.
    let leadingInset: CGFloat
    @Namespace private var zoom
    @State private var selection: PhotoSelection?

    var body: some View {
        Group {
            if photos.count == 1, let photo = photos.first {
                tile(photo, index: 0)
                    .aspectRatio(clamp(aspect(photo), 0.8, 1.78), contentMode: .fit)
                    .padding(.leading, leadingInset)
                    .padding(.trailing, 16)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(Array(photos.enumerated()), id: \.offset) { index, photo in
                            tile(photo, index: index)
                                .frame(width: 240 * clamp(aspect(photo), 0.6, 1.5), height: 240)
                        }
                    }
                    .padding(.leading, leadingInset)
                    .padding(.trailing, 16)
                }
                .scrollClipDisabled()
            }
        }
        .fullScreenCover(item: $selection) { selection in
            PhotoViewer(photos: photos, start: selection.index)
                .navigationTransition(.zoom(sourceID: selection.index, in: zoom))
        }
    }

    private func tile(_ photo: PostPhoto, index: Int) -> some View {
        Button {
            selection = PhotoSelection(index: index)
        } label: {
            RemotePhoto(photo: photo, contentMode: .fill)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .strokeBorder(Color.primary.opacity(0.08), lineWidth: 0.5)
                }
                .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
        .matchedTransitionSource(id: index, in: zoom)
        .accessibilityLabel(photo.alt ?? "")
        .accessibilityHidden(photo.alt == nil)
    }

    private func aspect(_ photo: PostPhoto) -> CGFloat { CGFloat(photo.width) / CGFloat(max(photo.height, 1)) }
    private func clamp(_ v: CGFloat, _ lo: CGFloat, _ hi: CGFloat) -> CGFloat { min(max(v, lo), hi) }
}

private struct PhotoSelection: Identifiable {
    let index: Int
    var id: Int { index }
}

/// A remote image with a calm placeholder and a short crossfade.
struct RemotePhoto: View {
    let photo: PostPhoto
    var contentMode: ContentMode = .fill
    @Environment(\.palette) private var palette

    var body: some View {
        Rectangle()
            .fill(palette.inset)
            .overlay {
                AsyncImage(url: AppConfig.url(photo.url), transaction: Transaction(animation: .easeOut(duration: 0.25))) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().aspectRatio(contentMode: contentMode).transition(.opacity)
                    case .failure:
                        Image(systemName: "photo").foregroundStyle(palette.textTertiary)
                    default:
                        EmptyView()
                    }
                }
            }
            .clipped()
    }
}

/// Full-screen photos: page between them, pinch to zoom, swipe down to close.
struct PhotoViewer: View {
    let photos: [PostPhoto]
    @State var index: Int
    @Environment(\.dismiss) private var dismiss
    @State private var drag: CGFloat = 0

    init(photos: [PostPhoto], start: Int) {
        self.photos = photos
        _index = State(initialValue: start)
    }

    var body: some View {
        ZStack {
            // The page colour of the current appearance, light or dark.
            Color(uiColor: .systemBackground).opacity(1 - min(abs(drag) / 400, 0.6)).ignoresSafeArea()
            TabView(selection: $index) {
                ForEach(Array(photos.enumerated()), id: \.offset) { i, photo in
                    ZoomablePhoto(photo: photo).tag(i)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .ignoresSafeArea(.container)
            .offset(y: drag)
            .simultaneousGesture(
                DragGesture(minimumDistance: 20)
                    .onChanged { value in
                        if abs(value.translation.height) > abs(value.translation.width) { drag = value.translation.height }
                    }
                    .onEnded { value in
                        if abs(value.translation.height) > 120 { dismiss() } else { withAnimation(.snappy) { drag = 0 } }
                    }
            )
        }
        .overlay(alignment: .top) {
            HStack {
                SheetCloseButton()
                Spacer()
                if photos.count > 1 {
                    Text(verbatim: "\(index + 1)/\(photos.count)")
                        .font(.footnote.weight(.semibold).monospacedDigit())
                        .foregroundStyle(.primary)
                        .padding(.horizontal, 12)
                        .frame(height: 36)
                        .glassEffect(.regular, in: Capsule())
                }
            }
            .padding(.horizontal, 16)
            .opacity(drag == 0 ? 1 : 0)
        }
    }
}

private struct ZoomablePhoto: View {
    let photo: PostPhoto
    @State private var scale: CGFloat = 1
    @GestureState private var pinch: CGFloat = 1

    var body: some View {
        AsyncImage(url: AppConfig.url(photo.url)) { image in
            image.resizable().aspectRatio(contentMode: .fit)
        } placeholder: {
            ProgressView()
        }
        .scaleEffect(scale * pinch)
        .gesture(
            MagnifyGesture()
                .updating($pinch) { value, state, _ in state = value.magnification }
                .onEnded { value in withAnimation(.snappy) { scale = min(max(scale * value.magnification, 1), 4) } }
        )
        .onTapGesture(count: 2) { withAnimation(.snappy) { scale = scale > 1 ? 1 : 2.5 } }
        .accessibilityLabel(photo.alt ?? "")
    }
}

/// Kotlin data classes don't conform to `Identifiable`; the API id is stable.
extension ConsultationsBrowseOutput.Item: @retroactive Identifiable {}
