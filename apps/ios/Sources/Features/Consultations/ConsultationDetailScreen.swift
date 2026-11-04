import MapKit
import Observation
import RutaKit
import SwiftUI

@Observable
final class ConsultationDetailModel {
    private(set) var state: ConsultationDetailUiState
    @ObservationIgnored private let scope: ScreenScope
    @ObservationIgnored let viewModel: ConsultationDetailViewModel

    init(graph: AppGraph, slug: String) {
        scope = ScreenScope(graph: graph)
        viewModel = scope.consultationDetail()
        viewModel.load(slug: slug)
        state = viewModel.state.value
    }

    func observe() async {
        for await next in viewModel.state { state = next }
    }

    isolated deinit { scope.close() }
}

/// A case opened like a Threads post: the post in full, then the
/// ayuntamiento's replies as a thread, oldest first.
struct ConsultationDetailScreen: View {
    let slug: String
    @Environment(\.graph) private var graph
    @State private var model: ConsultationDetailModel?
    @State private var comments: CommentsModel?

    var body: some View {
        Group {
            if let model {
                DetailContent(model: model, comments: comments)
            } else {
                SkeletonFeed()
            }
        }
        .toolbarVisibility(.visible, for: .navigationBar)
        .navigationTitle(L10n.Consultations.postTitle)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            guard let graph else { return }
            let model = self.model ?? ConsultationDetailModel(graph: graph, slug: slug)
            self.model = model
            let comments = self.comments ?? CommentsModel(graph: graph, kind: .consultation, ref: slug)
            self.comments = comments
            async let thread: Void = comments.observe()
            await model.observe()
            await thread
        }
    }
}

private struct DetailContent: View {
    let model: ConsultationDetailModel
    let comments: CommentsModel?
    @Environment(\.palette) private var palette
    @FocusState private var composing: Bool
    private var state: ConsultationDetailUiState { model.state }
    private var vm: ConsultationDetailViewModel { model.viewModel }

    var body: some View {
        switch state.phase {
        case .loading:
            SkeletonFeed()
        case .notFound:
            ContentUnavailableView(L10n.Consultations.missing, systemImage: "text.bubble")
        case .failed:
            ErrorStateView(error: state.error ?? .unknown) { vm.retry() }
        case .ready:
            if let detail = state.detail {
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        OriginalPost(detail: detail) { vm.toggleSupport() }
                        Thread(detail: detail)
                        if let comments {
                            Rectangle().fill(palette.hairline).frame(height: 0.5)
                            CommentsHeader(title: L10n.Comments.title, total: Int(comments.state.total))
                            CommentList(model: comments, empty: L10n.Comments.empty)
                        }
                    }
                    .padding(.bottom, 16)
                }
                .defaultScrollAnchor(DebugFlags.scrollToBottom ? .bottom : .top)
                .scrollDismissesKeyboard(.interactively)
                // Threads' reply bar: always at hand at the bottom of the post.
                .safeAreaInset(edge: .bottom) {
                    if let comments {
                        CommentComposer(model: comments, placeholder: L10n.Comments.placeholder, focus: $composing)
                    }
                }
                .fullScreenCover(isPresented: Binding(
                    get: { comments?.state.signInRequested ?? false },
                    set: { if !$0 { comments?.viewModel.signInHandled() } }
                )) {
                    SignInScreen()
                }
                .refreshable {
                    comments?.viewModel.refresh()
                    vm.refresh()
                    try? await Task.sleep(for: .milliseconds(150))
                    while model.state.refreshing { try? await Task.sleep(for: .milliseconds(100)) }
                }
                .fullScreenCover(isPresented: Binding(
                    get: { state.signInRequested },
                    set: { if !$0 { vm.signInHandled() } }
                )) {
                    SignInScreen()
                }
            }
        }
    }
}

// MARK: - The post

/// Threads' opened post: the person who opened it (photo, name, town) and
/// "…"; the title and text at full width; the category as a small tag; media;
/// then one hairline and a single row: support with its count, share, status.
private struct OriginalPost: View {
    let detail: ConsultationsDetailOutput
    let support: () -> Void
    @Environment(\.palette) private var palette
    @State private var menuOpen = false

    private let inset = PostMetrics.inset

    var body: some View {
        let photos = (detail.photos ?? []).map(PostPhoto.init)
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 12) {
                AuthorAvatar(name: author, image: detail.openedByImage, size: 44)
                VStack(alignment: .leading, spacing: 1) {
                    Text(author)
                        .font(PostMetrics.name)
                        .lineLimit(1)
                    Text("\(detail.municipalityName) · \(CompactTime.since(detail.createdAt.date))")
                        .font(PostMetrics.text)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 8)
                MoreButton { menuOpen = true }
            }
            .padding(.horizontal, inset)

            VStack(alignment: .leading, spacing: 6) {
                Text(detail.title)
                    .font(.title3.weight(.semibold))
                    .accessibilityAddTraits(.isHeader)
                Text(detail.body)
                    .font(.body)
                    .lineSpacing(3)
                    .textSelection(.enabled)
            }
            .padding(.horizontal, inset)
            .padding(.top, 14)

            CategoryTag(icon: detail.categoryIcon, hex: detail.categoryColor, name: detail.categoryName)
                .padding(.horizontal, inset)
                .padding(.top, 12)

            if !photos.isEmpty {
                PostMedia(photos: photos, leadingInset: inset)
                    .padding(.top, 14)
            }

            if let location = detail.location {
                LocationCard(latitude: location.lat, longitude: location.lng, tint: CategoryGlyph.style(detail.categoryIcon, hex: detail.categoryColor).color)
                    .padding(.horizontal, inset)
                    .padding(.top, 12)
            }

            HStack(spacing: 0) {
                PostActions(supported: detail.supported, support: support, reply: {}, shareURL: shareURL(detail.slug), shareTitle: detail.title, showsReply: false)
                if detail.supportCount > 0 {
                    Text(L10n.Consultations.supports(count: Int(detail.supportCount)))
                        .font(PostMetrics.text)
                        .foregroundStyle(.secondary)
                        .contentTransition(.numericText())
                        .animation(.snappy, value: detail.supportCount)
                        .padding(.leading, 4)
                }
                Spacer(minLength: 8)
                StatusPill(status: detail.statusValue)
            }
            .padding(.leading, inset - 11)
            .padding(.trailing, inset)
            .padding(.top, 10)
            .padding(.bottom, 6)
        }
        .padding(.top, 8)
        .sheet(isPresented: $menuOpen) {
            PostMenu(consultationId: detail.id, slug: detail.slug, title: detail.title) {}
        }
    }

    /// Who opened it; "you" for your own case; the category when unnamed.
    private var author: String {
        if detail.isMine { return L10n.Consultations.you }
        return detail.openedBy ?? detail.categoryName
    }
}

/// A person: their photo when they have one, their initials when not.
struct AuthorAvatar: View {
    let name: String
    let image: String?
    var size: CGFloat = 40
    @Environment(\.palette) private var palette
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        Circle()
            .fill(Color.primary.opacity(0.1))
            .frame(width: size, height: size)
            .overlay {
                Text(initials)
                    .font(.system(size: size * 0.38, weight: .semibold))
                    .foregroundStyle(.primary)
            }
            .overlay {
                if let url = image.flatMap(AppConfig.url) {
                    AsyncImage(url: url) { phase in
                        if case .success(let picture) = phase {
                            picture.resizable().aspectRatio(contentMode: .fill)
                        }
                    }
                    .clipShape(Circle())
                }
            }
            .accessibilityHidden(true)
    }

    private var initials: String {
        name.split(separator: " ").prefix(2).compactMap(\.first).map(String.init).joined().uppercased()
    }
}

/// The category as a small tag: its pin colour and glyph, then the name.
private struct CategoryTag: View {
    let icon: String
    let hex: String
    let name: String
    @Environment(\.palette) private var palette
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        HStack(spacing: 6) {
            CategoryPinBadge(icon: icon, hex: hex, size: 20)
            Text(name).font(.footnote.weight(.semibold))
        }
        .padding(.leading, 4)
        .padding(.trailing, 10)
        .frame(height: 28)
        .background(palette.raised(scheme), in: Capsule())
    }
}

/// Where the case is, as a quiet map card (not interactive: it's context).
private struct LocationCard: View {
    let latitude: Double
    let longitude: Double
    let tint: Color

    var body: some View {
        let coordinate = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
        Map(initialPosition: .region(MKCoordinateRegion(center: coordinate, latitudinalMeters: 600, longitudinalMeters: 600)), interactionModes: []) {
            Marker("", coordinate: coordinate).tint(tint)
        }
        .mapStyle(.standard(pointsOfInterest: .excludingAll))
        .frame(height: 150)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Color.primary.opacity(0.08), lineWidth: 0.5)
        }
        .accessibilityLabel(L10n.Consultations.location)
    }
}

// MARK: - The thread

private struct Thread: View {
    let detail: ConsultationsDetailOutput
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Rectangle().fill(palette.hairline).frame(height: 0.5)
            if detail.responses.isEmpty {
                Text(L10n.Consultations.noResponses)
                    .font(PostMetrics.text)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, PostMetrics.inset * 2)
                    .padding(.vertical, 28)
            } else {
                ForEach(Array(detail.responses.enumerated()), id: \.element.id) { index, response in
                    Reply(response: response, municipality: detail.municipalityName, isLast: index == detail.responses.count - 1)
                }
            }
        }
    }
}

/// One official reply, laid out as a feed post. The line joins the
/// ayuntamiento's replies into one thread, as Threads does for a chain.
private struct Reply: View {
    let response: ConsultationsDetailOutput.Response
    let municipality: String
    let isLast: Bool
    @Environment(\.palette) private var palette

    var body: some View {
        HStack(alignment: .top, spacing: PostMetrics.gap) {
            VStack(spacing: 6) {
                GlyphDisc(symbol: "building.columns")
                if !isLast {
                    Capsule().fill(palette.hairline).frame(width: 2).frame(maxHeight: .infinity)
                }
            }
            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(response.author ?? L10n.Consultations.municipality)
                        .font(PostMetrics.name)
                        .lineLimit(1)
                    Image(systemName: "checkmark.seal.fill")
                        .font(.caption)
                        .foregroundStyle(RutaBrand.iris)
                        // Who speaks, in words: the seal says "ayuntamiento".
                        .accessibilityLabel("\(L10n.Consultations.municipality) · \(municipality)")
                    Spacer(minLength: 8)
                    Text(CompactTime.since(response.createdAt.date))
                        .font(PostMetrics.text)
                        .foregroundStyle(palette.textTertiary)
                }
                Text(response.body)
                    .font(PostMetrics.text)
                    .lineSpacing(2)
                    .textSelection(.enabled)
                StatusPill(status: response.statusAfterValue)
                    .padding(.top, 6)
            }
            .padding(.bottom, isLast ? 14 : 20)
        }
        .padding(.horizontal, PostMetrics.inset)
        .padding(.top, 12)
        .accessibilityElement(children: .combine)
    }
}
