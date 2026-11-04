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

/// A thread of comments as Threads lays out replies: photo, name, age and
/// "…" on one line, the text under it. Your own can be deleted; anyone
/// else's reported. Loads more as you reach the end.
struct CommentList: View {
    let model: CommentsModel
    var empty: String

    @Environment(\.palette) private var palette
    private var state: CommentsUiState { model.state }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if state.items.isEmpty {
                if state.loading {
                    ProgressView().frame(maxWidth: .infinity).padding(.vertical, 24)
                } else {
                    Text(empty)
                        .font(PostMetrics.text)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                        .multilineTextAlignment(.center)
                        .padding(.vertical, 24)
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
        HStack(alignment: .top, spacing: 12) {
            AuthorAvatar(name: comment.author, image: comment.authorImage, size: 32)
            VStack(alignment: .leading, spacing: 2) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(comment.author).font(PostMetrics.name).lineLimit(1)
                    Text(CompactTime.since(comment.createdAt.date))
                        .font(PostMetrics.text)
                        .foregroundStyle(.secondary)
                    Spacer(minLength: 8)
                    menu
                }
                Text(comment.body)
                    .font(PostMetrics.text)
                    .lineSpacing(2)
                    .textSelection(.enabled)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.horizontal, PostMetrics.inset)
        .padding(.vertical, 10)
        .accessibilityElement(children: .combine)
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
                .frame(width: 32, height: 24)
                .contentShape(Rectangle())
        }
        .accessibilityLabel(L10n.Comments.options)
    }
}

/// The reply field, Threads-style: your photo, a growing field in a soft
/// capsule, and send once there's something to send.
struct CommentComposer: View {
    let model: CommentsModel
    let placeholder: String
    var focus: FocusState<Bool>.Binding

    @Environment(\.palette) private var palette
    @Environment(\.colorScheme) private var scheme
    private var state: CommentsUiState { model.state }

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            TextField(
                text: Binding(get: { state.draft }, set: { model.viewModel.updateDraft(value: $0) }),
                prompt: Text(placeholder).foregroundStyle(palette.textTertiary),
                axis: .vertical
            ) { Text(placeholder) }
                .font(.body)
                .lineLimit(1...5)
                .focused(focus)
                .padding(.horizontal, 16)
                .padding(.vertical, 11)
                .background(palette.raised(scheme), in: RoundedRectangle(cornerRadius: 22, style: .continuous))

            if state.canSend || state.sending {
                Button { model.viewModel.send() } label: {
                    ZStack {
                        Image(systemName: "arrow.up").opacity(state.sending ? 0 : 1)
                        if state.sending { ProgressView().tint(RutaHighlight.onPrimary(palette)) }
                    }
                    .font(.system(size: 17, weight: .bold))
                    .frame(width: 44, height: 44)
                }
                .buttonStyle(RutaProminentStyle())
                .buttonBorderShape(.circle)
                .disabled(state.sending)
                .accessibilityLabel(L10n.Comments.send)
                .transition(.scale.combined(with: .opacity))
            }
        }
        .animation(.snappy, value: state.canSend)
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
