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
    @Environment(AppChrome.self) private var chrome: AppChrome?
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
        // A conversation owns the bottom edge: the reply field sits where the tab bar was.
        .onAppear { chrome?.conversation = true }
        .onDisappear { chrome?.conversation = false }
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
    @State private var replyingAsStaff = true
    @State private var officialDraft = ""
    @State private var officialStatus: ConsultationsRespondInput.StatusAfter = .answered
    @State private var menuOpen = false
    @State private var replyOpen = false
    private var state: ConsultationDetailUiState { model.state }
    private var vm: ConsultationDetailViewModel { model.viewModel }
    private var canReply: Bool { state.canRespond || comments?.state.signedIn == true }

    /// The capsule and the post's reply button: the reply sheet, or sign-in first.
    private func startReply() {
        if canReply {
            replyOpen = true
        } else {
            comments?.viewModel.requestSignIn()
        }
    }

    private var capsuleLabel: String {
        guard canReply else { return L10n.Comments.signInToComment }
        return state.canRespond && replyingAsStaff ? L10n.Comments.replyPlaceholder : L10n.Comments.placeholder
    }

    /// Debug-only: `SIMCTL_CHILD_RUTA_DEBUG_REPLY="texto"` opens the reply sheet with
    /// that text typed (as an official reply when the viewer is staff), and
    /// `RUTA_DEBUG_REPLY_SEND=1` sends it.
    private func debugReply() {
        #if DEBUG
        guard let value = DebugHook.value("RUTA_DEBUG_REPLY"), !value.isEmpty else { return }
        if state.canRespond { officialDraft = value } else { comments?.viewModel.updateDraft(value: value) }
        replyOpen = true
        if DebugHook.value("RUTA_DEBUG_REPLY_SEND") == "1", state.canRespond {
            Task {
                try? await Task.sleep(for: .milliseconds(1500))
                vm.respond(body: value, statusAfter: officialStatus)
            }
        }
        #endif
    }

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
                        let replies = detail.responses.count + Int(comments?.state.total ?? 0)
                        OriginalPost(detail: detail, replyCount: replies, support: { vm.toggleSupport() }, reply: { if detail.publicationStatus != .pending || state.canRespond { startReply() } })
                        // One thread, as X shows it: the ayuntamiento's answers
                        // pinned first, then the residents', all in the same row.
                        if replies > 0 {
                            CommentsHeader(title: L10n.Consultations.responses(count: replies), total: replies)
                        }
                        ForEach(detail.responses, id: \.id) { response in
                            OfficialReply(response: response)
                        }
                        if detail.publicationStatus == .pending {
                            // Only its author sees a case before review: say so, plainly.
                            Label(L10n.Contribute.reviewNote, systemImage: "clock")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .padding(.horizontal, PostMetrics.inset)
                                .padding(.vertical, 16)
                        } else if let comments {
                            CommentList(model: comments, empty: detail.responses.isEmpty ? L10n.Comments.empty : nil)
                        }
                    }
                    .padding(.bottom, 16)
                }
                .readableWidth()
                .defaultScrollAnchor(DebugFlags.scrollToBottom ? .bottom : .top)
                // At rest a glass capsule over the tab bar; writing happens in
                // its own sheet, so the keyboard never lifts the tab bar.
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    // Nothing to reply to until the case is published.
                    if detail.publicationStatus != .pending || state.canRespond {
                        ThreadComposerBar {
                            ReplyCapsule(label: capsuleLabel, signIn: !canReply, action: startReply)
                        }
                    }
                }
                .sheet(isPresented: $replyOpen) {
                    ReplySheet(
                        detail: detail,
                        model: model,
                        comments: comments,
                        replyingAsStaff: $replyingAsStaff,
                        officialDraft: $officialDraft,
                        officialStatus: $officialStatus
                    )
                }
                // A comment that went through closes the sheet; a failed one keeps it open.
                .onChange(of: comments?.state.sending ?? false) { was, now in
                    if was, !now, comments?.state.sendError == nil { replyOpen = false }
                }
                .task { debugReply() }
                // X's bar: a plain "•••" at the end, no glass behind it.
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button { menuOpen = true } label: {
                            Image(systemName: "ellipsis").font(.system(size: 17, weight: .semibold))
                        }
                        .accessibilityLabel(L10n.SafetyUi.menuLabel)
                    }
                    .sharedBackgroundVisibility(.hidden)
                }
                .sheet(isPresented: $menuOpen) {
                    PostMenu(consultationId: detail.id, slug: detail.slug, title: detail.title) {}
                }
                .onChange(of: state.replySent) { _, sent in
                    if sent {
                        officialDraft = ""
                        replyOpen = false
                        vm.replySentHandled()
                    }
                }
                // While the reply sheet is up, it presents the step-up itself.
                .sheet(isPresented: Binding(
                    get: { if replyOpen { false } else if case .none = onEnum(of: state.stepUp) { false } else { true } },
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

/// X's opened post, field for field: a 48 pt photo with the bold name over
/// the grey handle (here the town) and, where X puts its label, the case's
/// status; the text at 17 pt (title in bold); the category tag, media and map
/// as X's bordered cards; the grey meta line (time · date · bold count); then
/// X's action row spread across the width.
private struct OriginalPost: View {
    let detail: ConsultationsDetailOutput
    let replyCount: Int
    let support: () -> Void
    let reply: () -> Void
    @Environment(\.palette) private var palette
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let inset = XMetrics.inset

    var body: some View {
        let photos = (detail.photos ?? []).map(PostPhoto.init)
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .center, spacing: XMetrics.gap) {
                AuthorAvatar(name: author, image: detail.openedByImage, size: 48)
                VStack(alignment: .leading, spacing: 0) {
                    Text(author)
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(palette.text)
                        .lineLimit(1)
                    Text(detail.municipalityName)
                        .font(.system(size: 17))
                        .foregroundStyle(palette.textSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 8)
                StatusPill(status: detail.statusValue)
            }
            .padding(.horizontal, inset)

            VStack(alignment: .leading, spacing: 4) {
                Text(detail.title)
                    .font(.system(size: 17, weight: .bold))
                    .accessibilityAddTraits(.isHeader)
                Text(detail.body)
                    .font(.system(size: 17))
                    .lineSpacing(4)
                    .textSelection(.enabled)
            }
            .foregroundStyle(palette.text)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, inset)
            .padding(.top, 12)

            CategoryTag(icon: detail.categoryIcon, hex: detail.categoryColor, name: detail.categoryName)
                .padding(.horizontal, inset)
                .padding(.top, 12)

            if !photos.isEmpty {
                PostMedia(photos: photos, leadingInset: inset)
                    .padding(.top, 12)
            }

            if let location = detail.location {
                LocationCard(latitude: location.lat, longitude: location.lng, tint: CategoryGlyph.style(detail.categoryIcon, hex: detail.categoryColor).color)
                    .padding(.horizontal, inset)
                    .padding(.top, 12)
            }

            // X's meta line: "5:20 p. m. · 11/6/26 · 8 apoyos", the count in bold ink.
            (Text(detail.createdAt.date, format: .dateTime.hour().minute())
                + Text(verbatim: " · ")
                + Text(detail.createdAt.date, format: .dateTime.day().month(.defaultDigits).year(.twoDigits))
                + Text(verbatim: " · ")
                + CountText.make(L10n.Consultations.supports(count: Int(detail.supportCount)), count: Int(detail.supportCount), ink: palette.text))
                .font(.system(size: 15))
                .foregroundStyle(palette.textSecondary)
                .padding(.horizontal, inset)
                .padding(.top, 16)

            // Three actions, grouped at the start as Threads does (spread edge
            // to edge like X's five they leave holes): support, reply, share.
            HStack(spacing: 4) {
                action(symbol: detail.supported ? "heart.fill" : "heart", count: Int(detail.supportCount),
                       label: detail.supported ? L10n.Consultations.supported : L10n.Consultations.support,
                       tint: detail.supported ? RutaHighlight.support : palette.textSecondary, action: support)
                    .symbolEffect(.bounce, value: reduceMotion ? false : detail.supported)
                    .sensoryFeedback(.impact(weight: .light), trigger: detail.supported)
                    .accessibilityAddTraits(detail.supported ? .isSelected : [])
                action(symbol: "bubble.left", count: replyCount, label: L10n.Comments.participantMode, tint: palette.textSecondary, action: reply)
                ShareLink(item: shareURL(detail.slug), subject: Text(detail.title)) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 19))
                        .foregroundStyle(palette.textSecondary)
                        .frame(minWidth: 44, minHeight: 44)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel(L10n.Common.share)
                Spacer(minLength: 0)
            }
            .padding(.leading, inset - 10)
            .padding(.trailing, inset - 12)
            .padding(.top, 6)
        }
        .padding(.top, 8)
    }

    private func action(symbol: String, count: Int, label: String, tint: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: symbol)
                    .font(.system(size: 19))
                    .foregroundStyle(tint)
                if count > 0 {
                    Text(verbatim: "\(count)")
                        .font(.system(size: 15))
                        .foregroundStyle(palette.textSecondary)
                        .contentTransition(reduceMotion ? .identity : .numericText())
                }
            }
            .frame(minWidth: 44, minHeight: 44, alignment: .leading)
            .padding(.horizontal, 10)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityValue(count > 0 ? "\(count)" : "")
    }

    /// Who opened it; "you" for your own case; the category when unnamed.
    private var author: String {
        if detail.isMine { return L10n.Consultations.you }
        return detail.openedBy ?? detail.categoryName
    }
}

/// X's "147K Views": the number in bold ink inside a plural phrase.
enum CountText {
    static func make(_ phrase: String, count: Int, ink: Color) -> Text {
        let number = "\(count)"
        guard count > 0, let range = phrase.range(of: number) else { return Text(phrase) }
        return Text(phrase[..<range.lowerBound])
            + Text(number).fontWeight(.bold).foregroundColor(ink)
            + Text(phrase[range.upperBound...])
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
    @Environment(\.palette) private var palette

    var body: some View {
        let coordinate = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
        Map(initialPosition: .region(MKCoordinateRegion(center: coordinate, latitudinalMeters: 600, longitudinalMeters: 600)), interactionModes: []) {
            Marker("", coordinate: coordinate).tint(tint)
        }
        .mapStyle(.ruta)
        .frame(height: 150)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay {
            // X's card edge: one pale blue-grey pixel.
            RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(palette.fillPressed, lineWidth: 1)
        }
        .accessibilityLabel(L10n.Consultations.location)
    }
}

// MARK: - The thread

/// One official reply in the shared row: the ayuntamiento's disc, its name
/// with the "Oficial" badge, the age, then the answer.
private struct OfficialReply: View {
    let response: ConsultationsDetailOutput.Response

    var body: some View {
        ReplyRow(
            name: response.author ?? L10n.Consultations.municipality,
            official: true,
            date: response.createdAt.date,
            text: response.body
        ) {
            GlyphDisc(symbol: "building.columns", size: XMetrics.avatar)
        } trailing: {
            EmptyView()
        }
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Staff reply

/// The resting composer: one Liquid Glass capsule above the tab bar that
/// opens the reply sheet (or asks to sign in first, with an arrow).
private struct ReplyCapsule: View {
    let label: String
    let signIn: Bool
    let action: () -> Void
    @Environment(\.palette) private var palette

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Text(label)
                    .font(.system(size: 17))
                    .foregroundStyle(palette.textSecondary)
                    .lineLimit(1)
                Spacer(minLength: 0)
                if signIn {
                    Image(systemName: "arrow.right")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(palette.textSecondary)
                }
            }
            .padding(.horizontal, 12)
            .frame(maxWidth: .infinity, minHeight: ComposerMetrics.height)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .composerGlass(expanded: false)
    }
}

/// Writing a reply, as X and Threads do it: its own sheet over the thread.
/// "Cancelar" and the accent "Responder" pill on top; the post you answer
/// with its author's photo and a thread line running down to yours; the
/// field, focused; and above the keyboard, the staff's tools and the
/// character ring. A sent reply closes it (the screen watches for that).
private struct ReplySheet: View {
    let detail: ConsultationsDetailOutput
    let model: ConsultationDetailModel
    let comments: CommentsModel?
    @Binding var replyingAsStaff: Bool
    @Binding var officialDraft: String
    @Binding var officialStatus: ConsultationsRespondInput.StatusAfter
    @Environment(\.dismiss) private var dismiss
    @Environment(\.palette) private var palette
    @FocusState private var focused: Bool

    private var state: ConsultationDetailUiState { model.state }
    private var asStaff: Bool { state.canRespond && replyingAsStaff }
    private var text: Binding<String> {
        asStaff ? $officialDraft : Binding(
            get: { comments?.state.draft ?? "" },
            set: { comments?.viewModel.updateDraft(value: $0) }
        )
    }
    private var limit: Int { asStaff ? CommentLimits.officialReply : CommentLimits.comment }
    private var sending: Bool { asStaff ? state.replying : (comments?.state.sending ?? false) }
    private var canSend: Bool {
        if asStaff {
            let trimmed = officialDraft.trimmingCharacters(in: .whitespacesAndNewlines)
            return !trimmed.isEmpty && officialDraft.count <= limit
        }
        return comments?.state.canSend ?? false
    }
    private var author: String {
        if detail.isMine { return L10n.Consultations.you }
        return detail.openedBy ?? detail.categoryName
    }

    private func send() {
        if asStaff {
            model.viewModel.respond(body: officialDraft, statusAfter: officialStatus)
        } else {
            comments?.viewModel.send()
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    // The post, and the thread line from its author down to you.
                    HStack(alignment: .top, spacing: XMetrics.gap) {
                        VStack(spacing: 4) {
                            AuthorAvatar(name: author, image: detail.openedByImage, size: XMetrics.avatar)
                            Capsule().fill(palette.fillPressed).frame(width: 2).frame(maxHeight: .infinity)
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(alignment: .firstTextBaseline, spacing: 4) {
                                Text(author).font(.system(size: 15, weight: .bold)).lineLimit(1)
                                Text(verbatim: "· \(CompactTime.since(detail.createdAt.date))")
                                    .font(.system(size: 15))
                                    .foregroundStyle(palette.textSecondary)
                                    .layoutPriority(1)
                            }
                            Text(detail.title)
                                .font(.system(size: 15, weight: .semibold))
                                .padding(.top, 2)
                            Text(detail.body)
                                .font(.system(size: 15))
                                .lineSpacing(2)
                                .lineLimit(4)
                            if !detail.isMine, let name = detail.openedBy {
                                ReplyingToLine(name: name)
                                    .padding(.leading, -4)
                                    .padding(.top, 10)
                            }
                        }
                        .foregroundStyle(palette.text)
                        .padding(.bottom, 18)
                    }
                    .fixedSize(horizontal: false, vertical: true)

                    // You: who answers, and the field.
                    HStack(alignment: .top, spacing: XMetrics.gap) {
                        GlyphDisc(symbol: asStaff ? "building.columns" : "person", size: XMetrics.avatar)
                        TextField(
                            text: text,
                            prompt: Text(asStaff ? L10n.Comments.replyPlaceholder : L10n.Comments.placeholder)
                                .foregroundStyle(palette.textSecondary),
                            axis: .vertical
                        ) { Text(L10n.Comments.placeholder) }
                            .font(.system(size: 17))
                            .lineLimit(3...)
                            .focused($focused)
                            .disabled(sending)
                            .padding(.top, 9)
                    }
                    errors.padding(.leading, XMetrics.avatar + XMetrics.gap)
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
            }
            .scrollDismissesKeyboard(.never)
            // Above the keyboard: the staff's tools and the ring.
            .safeAreaInset(edge: .bottom, spacing: 0) {
                HStack(spacing: 10) {
                    if state.canRespond {
                        ComposerModeMenu(replyingAsStaff: $replyingAsStaff)
                        if asStaff { StatusAfterMenu(status: $officialStatus, statuses: state.replyStatuses) }
                    }
                    Spacer(minLength: 0)
                    let count = text.wrappedValue.count
                    if count > 0 { CharacterRing(count: count, limit: limit) }
                }
                .disabled(sending)
                .padding(.horizontal, 16)
                .frame(minHeight: 48)
                .background(palette.background)
                .overlay(alignment: .top) { Rectangle().fill(palette.fill).frame(height: 0.5) }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L10n.Common.cancel) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    ReplyButton(canSend: canSend, sending: sending, action: send)
                }
                .sharedBackgroundVisibility(.hidden)
            }
            .navigationBarTitleDisplayMode(.inline)
            .background(palette.background)
        }
        .onAppear { focused = true }
        // Switching who answers keeps the keyboard up.
        .onChange(of: replyingAsStaff) { focused = true }
        .presentationDragIndicator(.visible)
        .sheet(isPresented: Binding(
            get: { if case .none = onEnum(of: state.stepUp) { false } else { true } },
            set: { if !$0 { model.viewModel.dismissStepUp() } }
        )) {
            StepUpSheet(
                state: state.stepUp,
                verify: { model.viewModel.verifyStepUp(code: $0) },
                useRecovery: { model.viewModel.useRecoveryCode(recovery: $0) },
                dismiss: { model.viewModel.dismissStepUp() }
            )
        }
    }

    @ViewBuilder private var errors: some View {
        if asStaff, let error = state.replyError {
            if error == .tooShort {
                Label(L10n.Gestion.replyTooShort, systemImage: "exclamationmark.circle")
                    .font(.footnote)
                    .foregroundStyle(palette.dangerInk)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 8)
            } else {
                ThreadErrorNotice(message: L10n.Comments.officialReplyFailed) { send() }
            }
        } else if !asStaff, comments?.state.sendError != nil {
            ThreadErrorNotice(message: L10n.Comments.sendFailed) { send() }
        }
    }
}

/// The words for the status a case is left in after an official reply.
private enum StatusAfterText {
    static func label(_ status: ConsultationsRespondInput.StatusAfter) -> String {
        switch status {
        case .inReview: L10n.Consultations.StatusLabel.in_review
        case .answered: L10n.Consultations.StatusLabel.answered
        case .resolved: L10n.Consultations.StatusLabel.resolved
        case .rejected: L10n.Consultations.StatusLabel.rejected
        }
    }
}

/// A tool in X's composer toolbar: a blue glyph and word, with a chevron
/// because it opens a menu.
private struct ToolLabel: View {
    let symbol: String
    /// X's tools are bare glyphs; a word only where the glyph can't say it.
    var title: String?
    @Environment(\.palette) private var palette

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: symbol).font(.system(size: 18, weight: .medium))
            if let title {
                Text(title).font(.system(size: 15, weight: .semibold)).lineLimit(1).truncationMode(.tail)
            }
            Image(systemName: "chevron.down").font(.system(size: 10, weight: .bold))
        }
        .foregroundStyle(palette.accentInk)
        .frame(minHeight: 44)
        .contentShape(Rectangle())
    }
}

/// Who answers: a resident's comment or the ayuntamiento's official reply.
private struct ComposerModeMenu: View {
    @Binding var replyingAsStaff: Bool

    var body: some View {
        Menu {
            Picker(L10n.Comments.composerMode, selection: $replyingAsStaff) {
                Label(L10n.Comments.participantMode, systemImage: "person").tag(false)
                Label(L10n.Consultations.municipality, systemImage: "building.columns").tag(true)
            }
        } label: {
            ToolLabel(symbol: replyingAsStaff ? "building.columns" : "person")
        }
        .buttonStyle(.plain)
        .accessibilityLabel(L10n.Comments.composerMode)
        .accessibilityValue(replyingAsStaff ? L10n.Consultations.municipality : L10n.Comments.participantMode)
    }
}

/// The status the case is left in after the official reply.
private struct StatusAfterMenu: View {
    @Binding var status: ConsultationsRespondInput.StatusAfter
    let statuses: [ConsultationsRespondInput.StatusAfter]

    var body: some View {
        Menu {
            Picker(L10n.Comments.statusAfter, selection: $status) {
                ForEach(statuses, id: \.self) { option in
                    Text(StatusAfterText.label(option)).tag(option)
                }
            }
        } label: {
            ToolLabel(symbol: "flag", title: StatusAfterText.label(status))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(L10n.Comments.statusAfter)
        .accessibilityValue(StatusAfterText.label(status))
    }
}
