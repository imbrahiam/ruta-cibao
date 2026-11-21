import MapKit
import RutaKit
import SwiftUI

/// One consultation as a thread: the question, the ayuntamiento's answers, the neighbours' replies.
struct ConsultationDetailScreen: View {
    let slug: String

    var body: some View {
        Host(make: { $0.consultationDetail() }, flow: { $0.state }, setup: { $0.load(slug: slug) }) { detail in
            Host(make: { $0.comments() }, flow: { $0.state }, setup: { $0.load(kind: .consultation, ref: slug) }) { comments in
                Thread(model: detail, comments: comments)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .paperBackground()
        .hidesTabBar()
    }
}

private struct Thread: View {
    let model: Screen<ConsultationDetailViewModel, ConsultationDetailUiState>
    let comments: Screen<CommentsViewModel, CommentsUiState>
    @Environment(\.dismiss) private var dismiss
    @State private var replying = false
    @State private var menu = false

    private var state: ConsultationDetailUiState { model.state }
    private var vm: ConsultationDetailViewModel { model.vm }
    private var pending: Bool { state.detail?.publicationStatus == .pending }
    private var canReply: Bool { !pending || state.canRespond }

    var body: some View {
        VStack(spacing: 0) {
            switch state.phase {
            case .loading: detailSkeleton
            case .notFound: StateView(symbol: "bubble.left", title: L10n.Consultations.missing)
            case .failed: StateView(error: state.error ?? .unknown) { vm.retry() }
            case .ready:
                if let detail = state.detail { content(detail) }
            }
        }
        .toolbar {
            if state.detail != nil {
                ToolbarItem(placement: .topBarTrailing) { Button(L10n.SafetyUi.menuLabel, systemImage: "ellipsis") { menu = true } }
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if state.phase == .ready, canReply {
                Button(action: startReply) {
                    HStack {
                        Text(state.canRespond ? L10n.Comments.replyPlaceholder : L10n.Comments.placeholder).type(.body, .ink3)
                        Spacer()
                        Image(systemName: "arrow.up").font(.system(size: 14, weight: .medium)).foregroundStyle(Color.onInk)
                            .frame(width: 32, height: 32).background(Color.action, in: Circle())
                    }
                    .padding(.leading, 20)
                    .padding(.trailing, 8)
                    .frame(height: 52)
                    // Glass only where something floats over content, like the map's chrome.
                    .glassEffect(.regular.interactive(), in: Capsule())
                }
                .buttonStyle(Pressable(scale: 0.98))
                .padding(.horizontal, 16)
                .padding(.bottom, 6)
                .readable()
            }
        }
        .sheet(isPresented: $replying) {
            ReplyComposer(model: model, comments: comments) { replying = false }
        }
        .sheet(isPresented: $menu) {
            if let detail = state.detail {
                PostMenu(consultationId: detail.id, slug: detail.slug, title: detail.title) { dismiss() }
            }
        }
        .fullScreenCover(isPresented: Binding(
            get: { state.signInRequested || comments.state.signInRequested },
            set: { if !$0 { vm.signInHandled(); comments.vm.signInHandled() } }
        ), onDismiss: { vm.refresh(); comments.vm.refresh() }) { SignInScreen() }
    }

    private var detailSkeleton: some View {
        ScrollView {
            Skeleton {
                VStack(alignment: .leading, spacing: 0) {
                    HStack {
                        Capsule().frame(width: 76, height: 21)
                        Spacer()
                        Capsule().frame(width: 56, height: 12)
                    }
                    SkeletonLine(264, lineHeight: 29, barHeight: 17, relativeTo: .title2)
                        .padding(.top, 12)
                    VStack(alignment: .leading, spacing: 3) {
                        SkeletonLine(360)
                        SkeletonLine(316)
                        SkeletonLine(190)
                    }
                    .padding(.top, 8)
                    HStack(spacing: 10) {
                        Circle().frame(width: 28, height: 28)
                        Capsule().frame(width: 86, height: 13)
                        Spacer()
                        Capsule().frame(width: 80, height: 28)
                    }
                    .padding(.top, 16)
                }
                .padding(.horizontal, Metrics.gutter)
                .padding(.top, 8)
            }
        }
        .readable()
    }

    private func startReply() {
        if state.canRespond || comments.state.signedIn { replying = true } else { comments.vm.requestSignIn() }
    }

    private func byline(_ detail: ConsultationDetail) -> some View {
        PublicProfileButton(name: detail.openedBy, image: detail.openedByImage) {
            HStack(spacing: 10) {
                PersonAvatar(name: detail.openedBy, image: detail.openedByImage, size: 28)
                Text([detail.isMine ? L10n.Consultations.you : (detail.openedBy ?? L10n.Traffic.resident), detail.municipalityName].joined(separator: " · "))
                    .type(.callout, .ink2)
            }
            .accessibilityElement(children: .combine)
        }
    }

    private func category(_ detail: ConsultationDetail) -> some View {
        HStack(spacing: 6) {
            CategoryArtwork(icon: detail.categoryIcon, size: 15)
            Text(detail.categoryName)
        }
        .type(.caption, .ink2)
        .fixedSize()
        .padding(.horizontal, 10)
        .frame(minHeight: 28)
        .background(Color.paper2, in: Capsule())
    }

    private func content(_ detail: ConsultationDetail) -> some View {
        let replies = detail.responses.count + Int(comments.state.total)
        return ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // Corners, as on the Gestión cards: state top-left, time top-right, so the
                // title is the first thing read; who and where close the block.
                HStack(spacing: 8) {
                    StatusBadge(status: detail.statusValue)
                    Spacer(minLength: 8)
                    Text(detail.createdAt.relativeText).type(.caption, .ink3)
                        .accessibilityValue(detail.createdAt.date.formatted(date: .long, time: .shortened))
                }
                .padding(.horizontal, Metrics.gutter)
                .padding(.top, 8)
                .rise(0)

                Text(detail.title).type(.title).padding(.horizontal, Metrics.gutter).padding(.top, 12).rise(1)
                Text(detail.body).type(.body).lineSpacing(3).padding(.horizontal, Metrics.gutter).padding(.top, 8).rise(2)

                // Byline left, category right while both fit; the category drops under the
                // byline for a long town name or large text.
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 10) { byline(detail); Spacer(minLength: 8); category(detail) }
                    VStack(alignment: .leading, spacing: 10) { byline(detail); category(detail) }
                }
                .padding(.horizontal, Metrics.gutter)
                .padding(.top, 16)
                .rise(3)

                if let photos = detail.photos, !photos.isEmpty {
                    PhotoStrip(urls: photos.map(\.url), height: 240).padding(.top, 16).rise(4)
                }
                if let location = detail.location {
                    PlaceCard(latitude: location.lat, longitude: location.lng).padding(.horizontal, Metrics.gutter).padding(.top, 12).rise(4)
                }

                PostActions(supported: detail.supported, supportCount: Int(detail.supportCount), replies: replies, slug: detail.slug, title: detail.title, support: { vm.toggleSupport() }, reply: { if canReply { startReply() } })
                    .padding(.horizontal, Metrics.gutter - 10)
                    .padding(.top, 2)

                Hairline().padding(.top, 4)

                if !detail.responses.isEmpty {
                    VStack(spacing: 10) {
                        ForEach(detail.responses, id: \.id) { OfficialReply(author: $0.author ?? L10n.Comments.officialBadge, text: $0.body, date: $0.createdAt) }
                    }
                    .padding(.horizontal, Metrics.gutter)
                    .padding(.top, 18)
                }

                if pending {
                    // Only its author sees a case before review: say so, plainly.
                    Label(L10n.Contribute.reviewNote, systemImage: "clock")
                        .type(.callout, .ink3)
                        .padding(.horizontal, Metrics.gutter)
                        .padding(.vertical, 20)
                } else {
                    CommentThread(comments: comments, emptyNote: detail.responses.isEmpty)
                }
            }
            .padding(.bottom, 24)
            .readable()
        }
        // Text scrolls under the back and menu buttons: a solid edge keeps it from showing through.
        .scrollEdgeEffectStyle(.hard, for: .top)
        .refreshable { vm.refresh(); comments.vm.refresh() }
    }
}

/// The ayuntamiento's answer: set apart on its own card, named and marked official.
private struct OfficialReply: View {
    let author: String
    let text: String
    let date: KotlinInstant

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "building.columns").font(.system(size: 13)).foregroundStyle(Color.onInk)
                    .frame(width: 28, height: 28).background(Color.action, in: Circle())
                Text(author).type(.label)
                Text(L10n.Comments.officialBadge).type(.caption, .success)
                Spacer(minLength: 4)
                Text(date.relativeText).type(.caption, .ink3)
            }
            Text(text).type(.body).lineSpacing(3)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.paper2, in: RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

/// Neighbours' replies, flat, with delete on your own and report on the rest.
struct CommentThread: View {
    let comments: Screen<CommentsViewModel, CommentsUiState>
    var emptyNote = true
    @State private var reporting: Comment?

    private var state: CommentsUiState { comments.state }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if state.loading && state.items.isEmpty {
                Skeleton {
                    VStack(alignment: .leading, spacing: 16) {
                        ForEach(0..<2) { _ in
                            HStack(alignment: .top, spacing: 12) {
                                Circle().frame(width: 36, height: 36)
                                    .frame(width: 44, height: 44)
                                VStack(alignment: .leading, spacing: 3) {
                                    SkeletonLine(116, lineHeight: 18, barHeight: 11, relativeTo: .callout)
                                    SkeletonLine(214)
                                }
                                Spacer(minLength: 0)
                            }
                        }
                    }
                    .padding(.vertical, 10)
                }
            } else if state.loadError != nil && state.items.isEmpty {
                StateView(error: state.loadError ?? .unknown) { comments.vm.retryLoad() }.frame(height: 200)
            } else if state.items.isEmpty {
                if emptyNote { Text(L10n.Comments.empty).type(.callout, .ink3).frame(maxWidth: .infinity).padding(.vertical, 28) }
            } else {
                ForEach(state.items, id: \.id) { comment in
                    HStack(alignment: .top, spacing: 12) {
                        PublicProfileButton(name: comment.author, image: comment.authorImage) {
                            PersonAvatar(name: comment.author, image: comment.authorImage, size: 36)
                                .frame(width: 44, height: 44)
                                .contentShape(Rectangle())
                        }
                        VStack(alignment: .leading, spacing: 3) {
                            HStack(spacing: 6) {
                                Text(comment.isMine ? L10n.Consultations.you : (comment.author ?? L10n.Traffic.resident)).type(.label)
                                Text(comment.createdAt.relativeText).type(.caption, .ink3)
                            }
                            Text(comment.body).type(.body, .ink2).lineSpacing(2)
                        }
                        Spacer(minLength: 0)
                        Menu {
                            if comment.isMine {
                                Button(L10n.Comments.delete, systemImage: "trash", role: .destructive) { comments.vm.delete(id: comment.id) }
                            } else {
                                Button(L10n.Comments.report, systemImage: "flag") { reporting = comment }
                            }
                        } label: {
                            Image(systemName: "ellipsis").font(.system(size: 14)).foregroundStyle(Color.ink3).frame(width: 44, height: 44)
                        }
                        .accessibilityLabel(L10n.Comments.options)
                    }
                    .padding(.leading, Metrics.gutter)
                    .padding(.trailing, 8)
                    .padding(.vertical, 14)
                    .opacity(state.workingCommentId == comment.id ? 0.4 : 1)
                    .transition(.opacity)
                }
                if state.canLoadMore {
                    Button(L10n.Common.seeAll) { comments.vm.loadMore() }
                        .buttonStyle(.pill(.quiet, compact: true, fill: false))
                        .frame(maxWidth: .infinity)
                        .padding(.top, 16)
                }
            }
        }
        .animation(Motion.settle, value: state.items.count)
        .confirmationDialog(L10n.Comments.report, isPresented: Binding(get: { reporting != nil }, set: { if !$0 { reporting = nil } }), titleVisibility: .visible) {
            ForEach(SafetyReportInput.Reason.allCases, id: \.self) { reason in
                Button(reason.label) { if let id = reporting?.id { comments.vm.report(id: id, reason: reason) } }
            }
        }
        .alert(L10n.Comments.reported, isPresented: Binding(get: { state.reported }, set: { if !$0 { comments.vm.reportHandled() } })) {
            Button(L10n.Common.done) {}
        }
        .alert(L10n.Comments.actionFailed, isPresented: Binding(get: { state.actionError != nil }, set: { _ in })) {
            Button(L10n.Common.retry) { comments.vm.retryAction() }
            Button(L10n.Common.cancel, role: .cancel) {}
        }
    }
}

extension SafetyReportInput.Reason {
    var label: String {
        switch self {
        case .abuse: L10n.Safety.Reasons.abuse
        case .personalInformation: L10n.Safety.Reasons.personal_information
        case .unsafe: L10n.Safety.Reasons.unsafe
        case .other: L10n.Safety.Reasons.other
        }
    }
}

/// A still map of one point: where the case is.
struct PlaceCard: View {
    let latitude: Double
    let longitude: Double
    var height: CGFloat = 150

    var body: some View {
        let point = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
        Map(initialPosition: .region(MKCoordinateRegion(center: point, latitudinalMeters: 700, longitudinalMeters: 700)), interactionModes: []) {
            Annotation("", coordinate: point, anchor: .bottom) { TeardropPin(height: 38) }
        }
        .mapStyle(.standard(pointsOfInterest: .excludingAll))
        .frame(height: height)
        .clipShape(RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
        .allowsHitTesting(false)
        .accessibilityLabel(L10n.Consultations.location)
    }
}

/// Writing a reply: a resident's comment, or the ayuntamiento's answer with the status it leaves.
private struct ReplyComposer: View {
    let model: Screen<ConsultationDetailViewModel, ConsultationDetailUiState>
    let comments: Screen<CommentsViewModel, CommentsUiState>
    let close: () -> Void
    @State private var official = ""
    @State private var status: ConsultationsRespondInput.StatusAfter = .answered
    @FocusState private var focused: Bool

    private var asStaff: Bool { model.state.canRespond }
    private var busy: Bool { asStaff ? model.state.replying : comments.state.sending }
    private var canSend: Bool { asStaff ? official.trimmingCharacters(in: .whitespacesAndNewlines).count >= 3 : comments.state.canSend }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            SheetBar(title: asStaff ? L10n.Comments.officialReply : L10n.Comments.replyTitle, close: close) {
                Button { send() } label: {
                    HStack(spacing: 8) { if busy { ProgressView().tint(.onInk) }; Text(L10n.Common.send) }
                }
                .buttonStyle(.pill(.ink, compact: true, fill: false))
                .disabled(!canSend || busy)
            }

            // What the reply answers, so the sheet never loses its context.
            if let title = model.state.detail?.title {
                Text(L10n.Comments.replyingTo(name: "«\(title)»")).type(.callout, .ink3).lineLimit(2).padding(.horizontal, 20)
            }

            TextField("", text: asStaff ? $official : Binding(get: { comments.state.draft }, set: { comments.vm.updateDraft(value: $0) }),
                      prompt: Text(asStaff ? L10n.Comments.replyPlaceholder : L10n.Comments.placeholder).foregroundStyle(Color.ink3), axis: .vertical)
                .type(.body)
                .lineLimit(4...12)
                .focused($focused)
                .padding(.horizontal, 20)

            if asStaff {
                VStack(alignment: .leading, spacing: 8) {
                    Text(L10n.Comments.statusAfter).type(.caption, .ink3).padding(.horizontal, 20)
                    ScrollView(.horizontal) {
                        HStack(spacing: 8) {
                            ForEach(model.state.replyStatuses, id: \.self) { option in
                                Chip(title: option.label, selected: status == option) { status = option }
                            }
                        }
                        .padding(.horizontal, 20)
                    }
                    .scrollIndicators(.hidden)
                    .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
                    .edgeFade(20)
                }
            }

            if (asStaff && model.state.replyError != nil) || (!asStaff && comments.state.sendError != nil) {
                Label(asStaff ? L10n.Comments.officialReplyFailed : L10n.Comments.sendFailed, systemImage: "exclamationmark.circle")
                    .type(.callout, .danger).padding(.horizontal, 20)
            }
            Spacer(minLength: 0)
        }
        .paperBackground()
        .presentationDetents([.medium, .large])
        .presentationCornerRadius(Metrics.radiusPanel)
        .onAppear { focused = true }
        .onChange(of: model.state.replySent) { _, sent in if sent { model.vm.replySentHandled(); close() } }
        .onChange(of: comments.state.sending) { was, now in if was, !now, comments.state.sendError == nil { close() } }
        .sheet(isPresented: Binding(get: { model.state.stepUp.active }, set: { if !$0 { model.vm.dismissStepUp() } })) {
            StepUpSheet(state: model.state.stepUp, verify: { model.vm.verifyStepUp(code: $0) }, useRecovery: { model.vm.useRecoveryCode(recovery: $0) }, dismiss: { model.vm.dismissStepUp() })
        }
        .sensoryFeedback(.success, trigger: model.state.replySent)
    }

    private func send() {
        if asStaff { model.vm.respond(body: official, statusAfter: status) } else { comments.vm.send() }
    }
}
