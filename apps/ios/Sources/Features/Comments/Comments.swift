import Observation
import RutaKit
import SwiftUI

@Observable
final class CommentsModel {
    private(set) var state: CommentsUiState
    @ObservationIgnored private let scope: ScreenScope
    @ObservationIgnored let viewModel: CommentsViewModel

    init(graph: AppGraph, kind: CommentsListInput.Kind, ref: String) {
        scope = ScreenScope(graph: graph)
        viewModel = scope.comments()
        viewModel.load(kind: kind, ref: ref)
        state = viewModel.state.value
    }

    func observe() async { for await next in viewModel.state { state = next } }
    isolated deinit { scope.close() }
}

/// Unboxed public replies with author, age, text and genuine moderation actions.
struct CommentList: View {
    let model: CommentsModel
    var empty: String

    private var state: CommentsUiState { model.state }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let error = state.loadError {
                ThreadErrorNotice(
                    message: error == .offline ? L10n.Common.offlineBody : L10n.Common.errorBody,
                    retry: { model.viewModel.retryLoad() }
                )
                .padding(.horizontal, PostMetrics.inset)
            }
            if let error = state.actionError {
                ThreadErrorNotice(
                    message: error == .offline ? L10n.Common.offlineBody : L10n.Comments.actionFailed,
                    retry: { model.viewModel.retryAction() }
                )
                .padding(.horizontal, PostMetrics.inset)
            }
            if state.items.isEmpty {
                if state.loading {
                    ProgressView().frame(maxWidth: .infinity).padding(.vertical, 24)
                } else if state.loadError == nil {
                    Text(empty)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, PostMetrics.inset)
                        .padding(.vertical, 28)
                }
            }
            ForEach(state.items, id: \.id) { comment in
                CommentRow(comment: comment, model: model)
                    .onAppear { if comment.id == state.items.last?.id { model.viewModel.loadMore() } }
            }
            if state.loading, !state.items.isEmpty {
                ProgressView().frame(maxWidth: .infinity).padding(.vertical, 12)
            }
        }
        .alert(L10n.Comments.reported, isPresented: Binding(
            get: { state.reported },
            set: { if !$0 { model.viewModel.reportHandled() } }
        )) {
            Button(L10n.Common.close, role: .cancel) {}
        }
    }
}

private struct CommentRow: View {
    let comment: CommentsListOutput.Item
    let model: CommentsModel

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 10) {
                AuthorAvatar(name: comment.author, image: comment.authorImage, size: 32)
                    .padding(.top, 4)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(comment.author)
                            .font(.system(size: 13, weight: .semibold))
                            .fixedSize(horizontal: false, vertical: true)
                        Text(CompactTime.since(comment.createdAt.date))
                            .font(.system(size: 13))
                            .foregroundStyle(.secondary)
                        Spacer(minLength: 0)
                    }
                    .frame(minHeight: 32, alignment: .leading)
                    Text(comment.body)
                        .font(.callout)
                        .lineSpacing(2)
                        .textSelection(.enabled)
                        .fixedSize(horizontal: false, vertical: true)
                }
                menu
            }
            .padding(.horizontal, PostMetrics.inset)
            .padding(.vertical, 12)
            Divider().padding(.leading, PostMetrics.inset + 42)
        }
    }

    private var menu: some View {
        Menu {
            if comment.isMine {
                Button(L10n.Comments.delete, systemImage: "trash", role: .destructive) {
                    model.viewModel.delete(id: comment.id)
                }
            } else {
                Menu(L10n.Comments.report, systemImage: "exclamationmark.bubble") {
                    ForEach([SafetyReportInput.Reason.abuse, .personalInformation, .unsafe, .other], id: \.self) { reason in
                        Button(SafetyText.reason(reason)) { model.viewModel.report(id: comment.id, reason: reason) }
                    }
                }
            }
        } label: {
            Image(systemName: "ellipsis")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.secondary)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .disabled(model.state.workingCommentId != nil)
        .accessibilityLabel(L10n.Comments.options)
    }
}

/// A stable avatar and capsule. The send target never shifts as the draft grows.
struct CommentComposer: View {
    let model: CommentsModel
    let placeholder: String
    var focus: FocusState<Bool>.Binding
    var signInLabel: String = L10n.Comments.signInToComment
    /// Replaces the avatar, e.g. staff's "who answers" chip, so the composer stays one row.
    var leading: AnyView?

    @Environment(\.palette) private var palette
    @Environment(\.colorScheme) private var scheme
    private var state: CommentsUiState { model.state }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if state.sendError != nil {
                ThreadErrorNotice(message: L10n.Comments.sendFailed) { model.viewModel.send() }
            }
            HStack(alignment: .bottom, spacing: 10) {
                if let leading, state.signedIn {
                    leading
                } else {
                    ComposerAvatar()
                        .padding(.bottom, 6)
                }
                if state.signedIn {
                    HStack(alignment: .bottom, spacing: 4) {
                        TextField(
                            text: Binding(get: { state.draft }, set: { model.viewModel.updateDraft(value: $0) }),
                            prompt: Text(placeholder).foregroundStyle(palette.textTertiary),
                            axis: .vertical
                        ) { Text(placeholder) }
                            .font(.body)
                            .lineLimit(1...5)
                            .focused(focus)
                            .disabled(state.sending)
                            .padding(.leading, 16)
                            .padding(.vertical, 12)
                        ThreadSendButton(
                            sending: state.sending,
                            enabled: state.canSend,
                            label: L10n.Comments.send,
                            action: { model.viewModel.send() }
                        )
                        .padding(3)
                    }
                    .background(palette.raised, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
                } else {
                    Button { model.viewModel.requestSignIn() } label: {
                        HStack(spacing: 8) {
                            Text(signInLabel)
                                .font(.body)
                                .multilineTextAlignment(.leading)
                            Spacer(minLength: 0)
                            Image(systemName: "arrow.right")
                                .font(.subheadline.weight(.semibold))
                        }
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 16)
                        .frame(maxWidth: .infinity, minHeight: 50, alignment: .leading)
                        .padding(.vertical, 2)
                        .background(palette.raised, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }
}

/// A section title in the Threads detail: bold, with its count.
struct CommentsHeader: View {
    let title: String
    let total: Int

    var body: some View {
        HStack(spacing: 6) {
            Text(title).font(.headline)
            if total > 0 {
                Text(verbatim: "\(total)").font(.headline).foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, PostMetrics.inset)
        .padding(.top, 18)
        .padding(.bottom, 4)
        .accessibilityAddTraits(.isHeader)
    }
}

/// Solid, single-inset surface shared by consultation and place threads.
struct ThreadComposerBar<Content: View>: View {
    @ViewBuilder var content: () -> Content
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(spacing: 0, content: content)
            .frame(maxWidth: .infinity)
            .background(.bar)
            .overlay(alignment: .top) { Divider() }
    }
}

struct ComposerAvatar: View {
    var official = false

    var body: some View {
        Image(systemName: official ? "building.columns.fill" : "person.fill")
            .font(.system(size: 15, weight: .medium))
            .foregroundStyle(.secondary)
            .frame(width: 36, height: 36)
            .background(Color.primary.opacity(0.07), in: Circle())
            .accessibilityHidden(true)
    }
}

struct ThreadSendButton: View {
    let sending: Bool
    let enabled: Bool
    let label: String
    let action: () -> Void
    @Environment(\.palette) private var palette
    @Environment(\.colorScheme) private var scheme

    /// Dark: a light disc with a dark arrow, so it reads on black.
    private var disc: Color { scheme == .dark ? .white : RutaBrand.iris }
    private var glyph: Color { scheme == .dark ? .black : .white }

    var body: some View {
        Button(action: action) {
            ZStack {
                Image(systemName: "arrow.up").opacity(sending ? 0 : 1)
                if sending { ProgressView().tint(glyph) }
            }
            .font(.system(size: 17, weight: .bold))
            .foregroundStyle(glyph)
            .frame(width: 44, height: 44)
            .background(disc.opacity(enabled || sending ? 1 : 0.4), in: Circle())
            .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .disabled(!enabled || sending)
        .accessibilityLabel(label)
    }
}

struct ThreadErrorNotice: View {
    let message: String
    let retry: () -> Void
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Label(message, systemImage: "exclamationmark.circle")
                .font(.footnote)
                .foregroundStyle(palette.dangerInk)
                .fixedSize(horizontal: false, vertical: true)
            Button(L10n.Common.retry, action: retry)
                .font(.footnote.weight(.semibold))
                .frame(minHeight: 44)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 8)
    }
}

struct PlaceExperiencesView: View {
    let place: MapPlace
    @Environment(\.graph) private var graph
    @State private var model: CommentsModel?
    @FocusState private var composing: Bool

    var body: some View {
        NavigationStack {
            ScrollView {
                if let model {
                    VStack(alignment: .leading, spacing: 0) {
                        CommentsHeader(title: L10n.Comments.experiences, total: Int(model.state.total))
                        CommentList(model: model, empty: L10n.Comments.emptyExperiences)
                    }
                    .padding(.bottom, 16)
                } else {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 24)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                if let model {
                    ThreadComposerBar {
                        CommentComposer(
                            model: model,
                            placeholder: L10n.Comments.experiencePlaceholder,
                            focus: $composing,
                            signInLabel: L10n.Comments.signInToExperience
                        )
                    }
                }
            }
            .refreshable { model?.viewModel.refresh() }
            .navigationTitle(place.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { SheetCloseButton() } }
        }
        .task(id: place.slug) {
            guard let graph else { return }
            let model = self.model ?? CommentsModel(graph: graph, kind: .place, ref: place.slug)
            self.model = model
            await model.observe()
        }
        .fullScreenCover(isPresented: Binding(
            get: { model?.state.signInRequested ?? false },
            set: { if !$0 { model?.viewModel.signInHandled() } }
        )) {
            SignInScreen()
        }
    }
}
