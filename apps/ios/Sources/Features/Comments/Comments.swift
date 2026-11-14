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
    /// Nil when something else already fills the thread (official replies).
    var empty: String?

    private var state: CommentsUiState { model.state }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let error = state.actionError {
                ThreadErrorNotice(
                    message: error == .offline ? L10n.Common.offlineBody : L10n.Comments.actionFailed,
                    retry: { model.viewModel.retryAction() }
                )
                .padding(.horizontal, PostMetrics.inset)
            }
            if state.items.isEmpty {
                if state.loading {
                    SkeletonFeed(count: 3)
                } else if let error = state.loadError {
                    ThreadLoadError(offline: error == .offline) { model.viewModel.retryLoad() }
                } else if let empty {
                    Text(empty)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, PostMetrics.inset)
                        .padding(.vertical, 32)
                }
            }
            ForEach(state.items, id: \.id) { comment in
                CommentRow(comment: comment, model: model)
                    .onAppear { if comment.id == state.items.last?.id { model.viewModel.loadMore() } }
            }
            if !state.items.isEmpty {
                if state.loading {
                    SkeletonFeed(count: 1)
                } else if let error = state.loadError {
                    ThreadLoadError(offline: error == .offline) { model.viewModel.retryLoad() }
                }
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

/// X's thread geometry: its narrow gutter and the 40 pt reply avatar.
enum XMetrics {
    static let inset: CGFloat = 12
    static let avatar: CGFloat = 40
    static let gap: CGFloat = 8
}

/// X's reply row, shared by residents and the ayuntamiento: 40 pt avatar,
/// bold name, then in grey the handle slot ("Oficial" for the ayuntamiento,
/// after X's blue seal) and the age; the text at 15 pt under it; a rule.
struct ReplyRow<Avatar: View, Trailing: View>: View {
    let name: String
    var official = false
    let date: Date
    let text: String
    @ViewBuilder var avatar: () -> Avatar
    @ViewBuilder var trailing: () -> Trailing
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: XMetrics.gap) {
                avatar()
                VStack(alignment: .leading, spacing: 2) {
                    HStack(alignment: .firstTextBaseline, spacing: 3) {
                        Text(name)
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(palette.text)
                            .lineLimit(1)
                        if official {
                            Image(systemName: "checkmark.seal.fill")
                                .font(.system(size: 14))
                                .foregroundStyle(palette.accentInk)
                                .accessibilityHidden(true)
                            Text(L10n.Comments.officialBadge)
                                .font(.system(size: 15))
                                .foregroundStyle(palette.textSecondary)
                                .lineLimit(1)
                        }
                        Text(verbatim: "· \(CompactTime.since(date))")
                            .font(.system(size: 15))
                            .foregroundStyle(palette.textSecondary)
                            .lineLimit(1)
                            .layoutPriority(1)
                        Spacer(minLength: 0)
                    }
                    .padding(.trailing, 28)
                    Text(text)
                        .font(.system(size: 15))
                        .lineSpacing(3)
                        .foregroundStyle(palette.text)
                        .textSelection(.enabled)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.horizontal, XMetrics.inset)
            .padding(.vertical, 12)
            .overlay(alignment: .topTrailing) { trailing().padding(.top, 0).padding(.trailing, 2) }
            Rectangle().fill(palette.hairline).frame(height: 1)
        }
    }
}

private struct CommentRow: View {
    let comment: CommentsListOutput.Item
    let model: CommentsModel

    var body: some View {
        ReplyRow(name: comment.author, date: comment.createdAt.date, text: comment.body) {
            AuthorAvatar(name: comment.author, image: comment.authorImage, size: XMetrics.avatar)
        } trailing: {
            menu
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
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.secondary)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .disabled(model.state.workingCommentId != nil)
        .accessibilityLabel(L10n.Comments.options)
    }
}

/// X's reply bar. At rest: one grey pill. Writing: "Respondiendo a" with
/// the name in blue above the pill, and under it X's toolbar: tools on the
/// left (staff's mode and status), the character ring and the blue
/// "Responder" pill on the right.
struct CommentComposer: View {
    let model: CommentsModel
    let placeholder: String
    var focus: FocusState<Bool>.Binding
    var signInLabel: String = L10n.Comments.signInToComment
    /// Shown above the field while composing: "Respondiendo a …".
    var replyingTo: String?
    /// Staff's "who answers" menu, shown in the toolbar while writing.
    var tools: AnyView?

    @Environment(\.palette) private var palette
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private var state: CommentsUiState { model.state }
    private var expanded: Bool { focus.wrappedValue || !state.draft.isEmpty }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if state.sendError != nil {
                ThreadErrorNotice(message: L10n.Comments.sendFailed) { model.viewModel.send() }
            }
            if state.signedIn {
                if expanded, let replyingTo {
                    ReplyingToLine(name: replyingTo).transition(.opacity)
                }
                ReplyField(
                    text: Binding(get: { state.draft }, set: { model.viewModel.updateDraft(value: $0) }),
                    placeholder: placeholder,
                    focus: focus,
                    sending: state.sending,
                    inset: expanded ? 4 : 12
                )
                if expanded {
                    ComposerToolbar(
                        tools: tools,
                        count: state.draft.count,
                        limit: CommentLimits.comment,
                        canSend: state.canSend,
                        sending: state.sending,
                        send: { model.viewModel.send() }
                    )
                    .transition(.opacity)
                }
            } else {
                Button { model.viewModel.requestSignIn() } label: {
                    HStack(spacing: 8) {
                        Text(signInLabel)
                            .font(.system(size: 17))
                            .multilineTextAlignment(.leading)
                        Spacer(minLength: 0)
                        Image(systemName: "arrow.right")
                            .font(.subheadline.weight(.semibold))
                    }
                    .foregroundStyle(palette.textSecondary)
                    .padding(.horizontal, 16)
                    .frame(maxWidth: .infinity, minHeight: ComposerMetrics.height, alignment: .leading)
                    .contentShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .animation(reduceMotion ? nil : .snappy(duration: 0.2), value: expanded)
        .composerGlass(expanded: expanded && state.signedIn)
    }
}

/// The composer as iOS 26 draws its own floating controls: one Liquid Glass
/// capsule over the content, just above the tab bar. While writing it grows
/// into a glass card that holds the context line, the field and the toolbar.
/// Radius 24 on a 48 pt capsule is a capsule; the card keeps the same corners.
private struct ComposerGlass: ViewModifier {
    let expanded: Bool

    func body(content: Content) -> some View {
        content
            .padding(.horizontal, expanded ? 12 : 4)
            .padding(.vertical, expanded ? 10 : 4)
            .glassEffect(.regular.interactive(), in: .rect(cornerRadius: 24))
            .padding(.horizontal, 16)
            .padding(.bottom, 8)
    }
}

extension View {
    func composerGlass(expanded: Bool) -> some View { modifier(ComposerGlass(expanded: expanded)) }
}

/// The server's limits, so the ring fills where the server would refuse.
enum CommentLimits {
    static let comment = 500
    static let officialReply = 2_000
}

/// One geometry for both composers (resident and staff).
enum ComposerMetrics {
    static let height: CGFloat = 40
}

/// "Respondiendo a Franklin": grey, the name in X's blue.
struct ReplyingToLine: View {
    let name: String
    @Environment(\.palette) private var palette

    var body: some View {
        Text(attributed)
            .font(.system(size: 15))
            .lineLimit(1)
            .padding(.leading, 4)
    }

    private var attributed: AttributedString {
        var line = AttributedString(L10n.Comments.replyingTo(name: name))
        line.foregroundColor = palette.textSecondary
        if let range = line.range(of: name, options: .backwards) { line[range].foregroundColor = palette.accentInk }
        return line
    }
}

/// The field inside the glass: 17 pt text, grows to five lines.
struct ReplyField: View {
    @Binding var text: String
    let placeholder: String
    var focus: FocusState<Bool>.Binding
    let sending: Bool
    /// The text's inset inside the glass: 12 pt in the capsule, 4 pt in the
    /// open card (the card adds its own 12, lining up with the toolbar).
    var inset: CGFloat = 12
    @Environment(\.palette) private var palette

    var body: some View {
        TextField(
            text: $text,
            prompt: Text(placeholder).foregroundStyle(palette.textSecondary),
            axis: .vertical
        ) { Text(placeholder) }
            .font(.system(size: 17))
            .lineLimit(1...5)
            .focused(focus)
            .disabled(sending)
            .padding(.horizontal, inset)
            .padding(.vertical, 9)
            .frame(maxWidth: .infinity, minHeight: ComposerMetrics.height, alignment: .leading)
            .contentShape(Rectangle())
    }
}

/// X's composer toolbar: tools on the left in blue, then the ring that
/// fills toward the limit and the blue "Responder" pill.
struct ComposerToolbar: View {
    let tools: AnyView?
    let count: Int
    let limit: Int
    let canSend: Bool
    let sending: Bool
    let send: () -> Void
    @Environment(\.palette) private var palette

    var body: some View {
        HStack(spacing: 12) {
            if let tools { tools }
            Spacer(minLength: 0)
            if count > 0 { CharacterRing(count: count, limit: limit) }
            ReplyButton(canSend: canSend, sending: sending, action: send)
                .layoutPriority(2)
        }
    }
}

/// X's "Reply" pill in the accent, its label in `onAccent`; half-strength
/// until there is something to send.
struct ReplyButton: View {
    let canSend: Bool
    let sending: Bool
    let action: () -> Void
    @Environment(\.palette) private var palette

    var body: some View {
        Button(action: action) {
            ZStack {
                Text(L10n.Comments.replyPlaceholder).lineLimit(1).fixedSize().opacity(sending ? 0 : 1)
                if sending { ProgressView().controlSize(.small).tint(palette.onAccent) }
            }
            .font(.system(size: 15, weight: .bold))
            .foregroundStyle(palette.onAccent)
            .padding(.horizontal, 16)
            .frame(minHeight: 34)
            .background(palette.accent.opacity(canSend || sending ? 1 : 0.5), in: Capsule())
            .padding(.vertical, 5)
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .disabled(!canSend || sending)
    }
}

/// X's character ring: fills in blue; in the last 20 it shows what's left
/// (amber), past the limit red, the number always spoken.
struct CharacterRing: View {
    let count: Int
    let limit: Int
    @Environment(\.palette) private var palette

    var body: some View {
        let left = limit - count
        let near = left <= 20
        let ink = left < 0 ? palette.danger : (near ? palette.warning : palette.accentInk)
        ZStack {
            Circle().stroke(palette.fill, lineWidth: 2)
            Circle()
                .trim(from: 0, to: min(1, CGFloat(count) / CGFloat(limit)))
                .stroke(ink, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                .rotationEffect(.degrees(-90))
            if near {
                Text(verbatim: "\(left)")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(left < 0 ? palette.danger : palette.textSecondary)
                    .monospacedDigit()
            }
        }
        .frame(width: near ? 28 : 22, height: near ? 28 : 22)
        .accessibilityElement()
        .accessibilityLabel(L10n.Comments.charactersLeft(count: max(0, left)))
    }
}

/// The thread's heading in X's meta style: the count in bold ink, the word grey.
struct CommentsHeader: View {
    let title: String
    let total: Int
    @Environment(\.palette) private var palette

    var body: some View {
        Text(title)
            .font(.system(size: 15, weight: .bold))
            .foregroundStyle(palette.textSecondary)
            .padding(.horizontal, XMetrics.inset)
            .padding(.top, 16)
            .padding(.bottom, 8)
            .accessibilityAddTraits(.isHeader)
    }
}

/// The slot the floating composer sits in: no bar of its own, the thread
/// scrolls under the glass and ends above it.
struct ThreadComposerBar<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(spacing: 0, content: content)
            .frame(maxWidth: .infinity)
    }
}

/// X's "Uh oh, an error was encountered / Try again": centred, bold, one action.
struct ThreadLoadError: View {
    let offline: Bool
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            Label(offline ? L10n.Common.offline : L10n.Common.errorTitle, systemImage: offline ? "wifi.slash" : "exclamationmark.circle")
                .font(.subheadline.weight(.bold))
            Button(L10n.Common.retry, action: retry)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .frame(minHeight: 44)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 24)
        .padding(.bottom, 8)
        .accessibilityElement(children: .contain)
    }
}

/// A failed action inside the composer: the message in words, then retry.
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
                    SkeletonFeed(count: 3)
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
