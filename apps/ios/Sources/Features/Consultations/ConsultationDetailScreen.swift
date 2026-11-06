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
    @State private var replyingAsStaff = true
    @State private var officialDraft = ""
    @State private var officialStatus: ConsultationsRespondInput.StatusAfter = .answered
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
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    ThreadComposerBar {
                        if state.canRespond && replyingAsStaff {
                            StaffReplyComposer(
                                model: model,
                                text: $officialDraft,
                                status: $officialStatus,
                                replyingAsStaff: $replyingAsStaff,
                                focus: $composing
                            )
                        } else if let comments {
                            CommentComposer(model: comments, placeholder: L10n.Comments.placeholder, focus: $composing, replyingTo: detail.isMine ? nil : detail.openedBy, leading: state.canRespond ? AnyView(
                                ComposerModeMenu(replyingAsStaff: $replyingAsStaff, status: $officialStatus, statuses: state.replyStatuses)
                                    .disabled(comments.state.sending)
                            ) : nil)
                        }
                    }
                }
                .onChange(of: state.replySent) { _, sent in
                    if sent {
                        officialDraft = ""
                        vm.replySentHandled()
                    }
                }
                .sheet(isPresented: Binding(
                    get: { if case .none = onEnum(of: state.stepUp) { false } else { true } },
                    set: { if !$0 { vm.dismissStepUp() } }
                )) {
                    StepUpSheet(
                        state: state.stepUp,
                        verify: { vm.verifyStepUp(code: $0) },
                        useRecovery: { vm.useRecoveryCode(recovery: $0) },
                        dismiss: { vm.dismissStepUp() }
                    )
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
                        .font(.body.weight(.bold))
                        .fixedSize(horizontal: false, vertical: true)
                    Text("\(detail.municipalityName) · \(CompactTime.since(detail.createdAt.date))")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
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

            // X's stats bar: hairlines above and below, icons with bare counts.
            Rectangle().fill(palette.hairline).frame(height: 0.5)
                .padding(.horizontal, inset)
                .padding(.top, 14)
            HStack(spacing: 8) {
                PostActions(supported: detail.supported, support: support, reply: {}, shareURL: shareURL(detail.slug), shareTitle: detail.title, showsReply: false, supportCount: Int(detail.supportCount))
                Spacer(minLength: 0)
                StatusPill(status: detail.statusValue)
            }
            .padding(.leading, inset - 11)
            .padding(.trailing, inset)
            .padding(.vertical, 2)
            Rectangle().fill(palette.hairline).frame(height: 0.5)
                .padding(.horizontal, inset)
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
        .background(palette.raised, in: Capsule())
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
        .mapStyle(.ruta)
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
        // No replies, no heading: the composer already says who can answer.
        if !detail.responses.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                Rectangle().fill(palette.hairline).frame(height: 0.5)
                HStack(spacing: 6) {
                    Text(L10n.Comments.officialReplies)
                    Text(verbatim: "\(detail.responses.count)").foregroundStyle(.secondary)
                }
                .font(.system(size: 15, weight: .semibold))
                .padding(.horizontal, PostMetrics.inset)
                .padding(.top, 18)
                .padding(.bottom, 4)
                .accessibilityAddTraits(.isHeader)
                ForEach(detail.responses, id: \.id) { response in
                    Reply(response: response)
                }
            }
        }
    }
}

/// One official reply: the ayuntamiento's mark, its name with an "Oficial"
/// badge (text, not colour) and the time, then the answer.
private struct Reply: View {
    let response: ConsultationsDetailOutput.Response
    @Environment(\.palette) private var palette

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            GlyphDisc(symbol: "building.columns", size: 32)
            VStack(alignment: .leading, spacing: 2) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(response.author ?? L10n.Consultations.municipality)
                        .font(.system(size: 13, weight: .bold))
                        .fixedSize(horizontal: false, vertical: true)
                    Text(L10n.Comments.officialBadge)
                        .font(.system(size: 11, weight: .semibold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(palette.raised, in: Capsule())
                    Text(CompactTime.since(response.createdAt.date))
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary)
                    Spacer(minLength: 0)
                }
                Text(response.body)
                    .font(.callout)
                    .lineSpacing(2)
                    .textSelection(.enabled)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.horizontal, PostMetrics.inset)
        .padding(.vertical, 12)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Staff reply

/// The composer for staff: the status the case is left in, then the public
/// reply. It sits in the same bar as the comment composer.
private struct StaffReplyComposer: View {
    let model: ConsultationDetailModel
    @Binding var text: String
    @Binding var status: ConsultationsRespondInput.StatusAfter
    @Binding var replyingAsStaff: Bool
    var focus: FocusState<Bool>.Binding
    @Environment(\.palette) private var palette
    @Environment(\.colorScheme) private var scheme
    private var state: ConsultationDetailUiState { model.state }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let error = state.replyError {
                if error == .tooShort {
                    Label(L10n.Gestion.replyTooShort, systemImage: "exclamationmark.circle")
                        .font(.footnote)
                        .foregroundStyle(palette.dangerInk)
                        .fixedSize(horizontal: false, vertical: true)
                } else {
                    ThreadErrorNotice(message: L10n.Comments.officialReplyFailed) {
                        model.viewModel.respond(body: text, statusAfter: status)
                    }
                }
            }
            HStack(alignment: .bottom, spacing: 8) {
                ComposerModeMenu(replyingAsStaff: $replyingAsStaff, status: $status, statuses: state.replyStatuses)
                    .disabled(state.replying)
                HStack(alignment: .bottom, spacing: 4) {
                    TextField(L10n.Comments.replyPlaceholder, text: $text, axis: .vertical)
                        .font(.body)
                        .lineLimit(1...5)
                        .focused(focus)
                        .disabled(state.replying)
                        .padding(.leading, 16)
                        .padding(.vertical, 12)
                    ThreadSendButton(
                        sending: state.replying,
                        enabled: !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                        label: L10n.Gestion.replySend,
                        action: { model.viewModel.respond(body: text, statusAfter: status) }
                    )
                    .padding(3)
                }
                .background(palette.raised, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .task { debugReply() }
    }

    /// Debug-only: `SIMCTL_CHILD_RUTA_DEBUG_REPLY="texto"` types the reply and sends it.
    private func debugReply() {
        #if DEBUG
        guard let value = ProcessInfo.processInfo.environment["RUTA_DEBUG_REPLY"], !value.isEmpty else { return }
        text = value
        if ProcessInfo.processInfo.environment["RUTA_DEBUG_REPLY_SEND"] == "1" {
            Task {
                try? await Task.sleep(for: .milliseconds(1500))
                model.viewModel.respond(body: value, statusAfter: status)
            }
        }
        #endif
    }

    fileprivate static func label(_ status: ConsultationsRespondInput.StatusAfter) -> String {
        switch status {
        case .inReview: L10n.Consultations.StatusLabel.in_review
        case .answered: L10n.Consultations.StatusLabel.answered
        case .resolved: L10n.Consultations.StatusLabel.resolved
        case .rejected: L10n.Consultations.StatusLabel.rejected
        }
    }
}


/// One compact menu: who answers, and the status the case is left in.
private struct ComposerModeMenu: View {
    @Binding var replyingAsStaff: Bool
    @Binding var status: ConsultationsRespondInput.StatusAfter
    let statuses: [ConsultationsRespondInput.StatusAfter]
    @Environment(\.palette) private var palette

    var body: some View {
        Menu {
            Picker(L10n.Comments.composerMode, selection: $replyingAsStaff) {
                Label(L10n.Comments.participantMode, systemImage: "person").tag(false)
                Label(L10n.Consultations.municipality, systemImage: "building.columns").tag(true)
            }
            if replyingAsStaff {
                Picker(L10n.Comments.statusAfter, selection: $status) {
                    ForEach(statuses, id: \.self) { option in
                        Text(StaffReplyComposer.label(option)).tag(option)
                    }
                }
            }
        } label: {
            HStack(spacing: 6) {
                VStack(alignment: .leading, spacing: 0) {
                    Text(replyingAsStaff ? L10n.Consultations.municipality : L10n.Comments.participantMode)
                        .fontWeight(.semibold)
                    if replyingAsStaff {
                        Text(StaffReplyComposer.label(status)).foregroundStyle(.secondary)
                    }
                }
                Image(systemName: "chevron.up.chevron.down")
                    .font(.caption2.weight(.semibold))
            }
            .font(.footnote)
            .foregroundStyle(.primary)
            .padding(.horizontal, 12)
            .frame(minHeight: 50)
            .background(palette.raised, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(L10n.Comments.composerMode)
        .accessibilityValue(replyingAsStaff ? "\(L10n.Consultations.municipality), \(StaffReplyComposer.label(status))" : L10n.Comments.participantMode)
    }
}
