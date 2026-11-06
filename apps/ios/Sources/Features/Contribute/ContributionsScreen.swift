import Observation
import RutaKit
import SwiftUI

@Observable
final class InboxModel {
    private(set) var state: InboxUiState
    @ObservationIgnored private let scope: ScreenScope
    @ObservationIgnored let viewModel: InboxViewModel

    init(graph: AppGraph) {
        scope = ScreenScope(graph: graph)
        viewModel = scope.inbox()
        state = viewModel.state.value
    }

    func observe() async { for await next in viewModel.state { state = next } }
    isolated deinit { scope.close() }
}

@Observable
final class ContributionsModel {
    private(set) var state: ContributionsUiState
    @ObservationIgnored private let scope: ScreenScope
    @ObservationIgnored let viewModel: ContributionsViewModel

    init(graph: AppGraph) {
        scope = ScreenScope(graph: graph)
        viewModel = scope.contributions()
        state = viewModel.state.value
    }

    func observe() async {
        for await next in viewModel.state { state = next }
    }

    isolated deinit { scope.close() }
}

/// The three ways to contribute.
enum ContributeAction: String, Identifiable, CaseIterable {
    case consultation, traffic, place
    var id: String { rawValue }

    var title: String {
        switch self {
        case .consultation: L10n.Contributions.exampleCaseTitle
        case .traffic: L10n.Contributions.exampleTrafficTitle
        case .place: L10n.Contributions.examplePlaceTitle
        }
    }

    var symbol: String {
        switch self {
        case .consultation: "text.bubble"
        case .traffic: "exclamationmark.triangle"
        case .place: "mappin.and.ellipse"
        }
    }
}

/// "Aportes": start a contribution, and follow the ones you've made.
struct ContributionsScreen: View {
    @Environment(\.graph) private var graph
    @Environment(\.palette) private var palette
    @State private var model: ContributionsModel?
    @State private var inbox: InboxModel?
    @Environment(DeepLinks.self) private var links
    @State private var section: Section = {
        #if DEBUG
        ProcessInfo.processInfo.environment["RUTA_DEBUG_COMPOSE"] == "inbox" ? .inbox : .mine
        #else
        .mine
        #endif
    }()
    @State private var path: [ConsultationRoute] = []

    private enum Section: Hashable { case mine, inbox }
    @State private var composing: ContributeAction? = Self.debugComposing

    /// Debug-only: `SIMCTL_CHILD_RUTA_DEBUG_COMPOSE=traffic` opens a form at launch (screenshot runs).
    private static var debugComposing: ContributeAction? {
        #if DEBUG
        ProcessInfo.processInfo.environment["RUTA_DEBUG_COMPOSE"].flatMap(ContributeAction.init(rawValue:))
        #else
        nil
        #endif
    }
    @State private var signingIn = false

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if let model {
                    content(model)
                } else {
                    Color.clear
                }
            }
            .tabBarClearance()
            .navigationTitle(L10n.Contributions.title)
            .toolbarVisibility(.hidden, for: .navigationBar)
            .accessibilityElement(children: .contain)
            .accessibilityLabel(L10n.Contributions.title)
            .navigationDestination(for: ConsultationRoute.self) { ConsultationDetailScreen(slug: $0.slug).tabBarClearance() }
        }
        .task {
            guard let graph else { return }
            let model = self.model ?? ContributionsModel(graph: graph)
            self.model = model
            await model.observe()
        }
        .task {
            guard let graph else { return }
            let inbox = self.inbox ?? InboxModel(graph: graph)
            self.inbox = inbox
            await inbox.observe()
        }
        .sheet(item: $composing) { action in
            switch action {
            case .consultation:
                NewConsultationScreen { slug in
                    model?.viewModel.refresh()
                    path.append(ConsultationRoute(slug: slug))
                }
            case .traffic:
                TrafficReportScreen { model?.viewModel.refresh() }
            case .place:
                SuggestPlaceScreen { model?.viewModel.refresh() }
            }
        }
        .fullScreenCover(isPresented: $signingIn) { SignInScreen() }
        .onChange(of: links.pending, initial: true) { _, target in
            guard target == .contributions else { return }
            path = []
            section = .inbox
            inbox?.viewModel.refresh()
            links.pending = nil
        }
        .onReceive(NotificationCenter.default.publisher(for: AppDelegate.pushReceived)) { _ in
            inbox?.viewModel.refresh()
        }
    }

    @ViewBuilder private func content(_ model: ContributionsModel) -> some View {
        let state = model.state
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0, pinnedViews: [.sectionHeaders]) {
                ActionTiles { action in
                    if state.signedIn { composing = action } else { signingIn = true }
                }
                .padding(.horizontal, 16)
                .padding(.top, 12)
                .padding(.bottom, 16)

                if state.signedIn {
                    SwiftUI.Section {
                        if section == .inbox, let inbox {
                            if inbox.state.unread > 0 {
                                HStack {
                                    Spacer()
                                    Button { inbox.viewModel.markRead(id: nil) } label: {
                                        Text(L10n.Notifications.markAllRead)
                                            .font(.system(size: 15, weight: .medium))
                                            .frame(minHeight: 44)
                                            .contentShape(Rectangle())
                                    }
                                    .buttonStyle(.plain)
                                    .foregroundStyle(palette.text)
                                }
                                .padding(.horizontal, PostMetrics.inset)
                            }
                            InboxList(model: inbox) { slug in path.append(ConsultationRoute(slug: slug)) }
                        } else {
                            PendingOutboxView(hidesWhenEmpty: true)
                            myContributions(model)
                        }
                    } header: {
                        tabs.background(Color(.systemBackground))
                    }
                } else {
                    signedOut
                }
            }
            .padding(.bottom, 24)
        }
        .refreshable {
            model.viewModel.refresh()
            inbox?.viewModel.refresh()
        }
    }

    private var signedOut: some View {
        VStack(spacing: 14) {
            Text(L10n.Contributions.signedOutTitle)
                .font(.title3.weight(.bold))
                .multilineTextAlignment(.center)
            Text(L10n.Contributions.signedOutBody)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button { signingIn = true } label: {
                Text(L10n.Contributions.signIn).font(.headline).frame(maxWidth: .infinity, minHeight: 50)
            }
            .buttonStyle(RutaProminentStyle())
        }
        .padding(.horizontal, 24)
        .padding(.top, 36)
    }

    private var tabs: some View {
        let unread = Int(inbox?.state.unread ?? 0)
        return SegmentTabs(
            options: [Section.mine, .inbox],
            selected: section,
            title: { $0 == .mine ? L10n.Contributions.mine : (unread > 0 ? L10n.Contributions.inboxCount(count: String(unread)) : L10n.Contributions.inbox) },
            select: { section = $0 }
        )
    }

    @ViewBuilder private func myContributions(_ model: ContributionsModel) -> some View {
        let state = model.state
        switch state.phase {
        case .loading:
            SkeletonFeed()
        case .failed:
            ErrorStateView(error: state.error ?? .unknown) { model.viewModel.retry() }
                .padding(.top, 24)
        case .empty:
            EmptyState(symbol: "square.stack", title: L10n.Contributions.empty, message: L10n.Contributions.emptyBody)
                .padding(.top, 40)
        case .ready:
            ForEach(state.items, id: \.id) { item in
                if let slug = state.slugFor(item: item) {
                    Button { path.append(ConsultationRoute(slug: slug)) } label: {
                        ContributionRow(item: item, opens: true)
                    }
                    .buttonStyle(.plain)
                } else {
                    ContributionRow(item: item, opens: false)
                }
            }
        }
    }
}

/// The same tile as the traffic report types: a raised neutral fill, the
/// category-coloured glyph in a 44 circle, the label inside.
private struct ActionTiles: View {
    let start: (ContributeAction) -> Void
    @Environment(\.palette) private var palette

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            ForEach(ContributeAction.allCases) { action in
                Button { start(action) } label: {
                    VStack(spacing: 10) {
                        PinBadge(symbol: action.symbol, color: action.tint, size: 44)
                            .accessibilityHidden(true)
                        Text(action.title)
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(palette.text)
                            .multilineTextAlignment(.center)
                            .lineLimit(2)
                    }
                    .padding(.horizontal, 8)
                    .frame(maxWidth: .infinity, minHeight: 112)
                    .background(palette.raised, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                }
                .buttonStyle(PressScale())
            }
        }
    }
}

/// A light press: the tile dips a little, as native tiles do (none under Reduce Motion).
struct PressScale: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.96 : 1)
            .opacity(configuration.isPressed ? 0.85 : 1)
            .animation(.snappy(duration: 0.15), value: configuration.isPressed)
    }
}

/// One contribution, in the post style: kind icon, name, status word, time.
private struct ContributionRow: View {
    let item: PlacesContributionsItem
    let opens: Bool
    @Environment(\.palette) private var palette

    var body: some View {
        let style = kindStyle
        HStack(alignment: .top, spacing: PostMetrics.gap) {
            PinBadge(symbol: style.symbol, color: style.color, size: PostMetrics.avatar)
            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline) {
                    Text(item.name).font(PostMetrics.name).lineLimit(2)
                    Spacer(minLength: 8)
                    Text(CompactTime.since(item.createdAt.date))
                        .font(PostMetrics.text)
                        .foregroundStyle(palette.textTertiary)
                }
                (Text(style.kind).foregroundStyle(palette.textTertiary)
                    + Text(verbatim: " · ").foregroundStyle(palette.textTertiary)
                    + Text(statusText).foregroundStyle(statusInk))
                    .font(PostMetrics.text)
                if let note = item.note, !note.isEmpty {
                    Text(note)
                        .font(PostMetrics.text)
                        .foregroundStyle(palette.textSecondary)
                        .padding(.top, 2)
                }
            }
        }
        .padding(.horizontal, PostMetrics.inset)
        .padding(.vertical, 12)
        .overlay(alignment: .bottom) { Rectangle().fill(palette.hairline).frame(height: 0.5) }
        .accessibilityElement(children: .combine)
    }

    private var kindStyle: (symbol: String, color: Color, kind: String) {
        switch item.kind {
        case .place: ("mappin.and.ellipse", .green, L10n.Contributions.Kind.place)
        case .report: ("flag", .orange, L10n.Contributions.Kind.report)
        case .photo: ("camera", .blue, L10n.Contributions.Kind.photo)
        case .traffic: ("exclamationmark.triangle", .orange, L10n.Contributions.Kind.traffic)
        case .consultation: ("text.bubble", .blue, L10n.Contributions.Kind.consultation)
        case .claim: ("storefront", .purple, L10n.Contributions.Kind.claim)
        }
    }

    private var statusText: String {
        switch item.status {
        case .draft: L10n.Contributions.Status.draft
        case .pending: L10n.Contributions.Status.pending
        case .published: L10n.Contributions.Status.published
        case .rejected: L10n.Contributions.Status.rejected
        case .archived: L10n.Contributions.Status.archived
        case .resolved: L10n.Contributions.Status.resolved
        case .dismissed: L10n.Contributions.Status.dismissed
        case .active: L10n.Contributions.Status.active
        case .cleared: L10n.Contributions.Status.cleared
        case .expired: L10n.Contributions.Status.expired
        case .removed: L10n.Contributions.Status.removed
        case .open: item.kind == .consultation ? L10n.Consultations.StatusLabel.open : L10n.Contributions.Status.open
        case .inReview: L10n.Contributions.Status.in_review
        case .answered: item.kind == .consultation ? L10n.Consultations.StatusLabel.answered : L10n.Contributions.Status.answered
        case .approved: L10n.Contributions.Status.approved
        }
    }

    private var statusInk: Color {
        switch item.status {
        case .published, .resolved, .answered, .approved, .active: palette.successInk
        case .pending, .inReview, .draft: palette.warningInk
        case .rejected, .removed: palette.dangerInk
        default: palette.textTertiary
        }
    }
}

// MARK: - Inbox

private struct InboxList: View {
    let model: InboxModel
    let open: (String) -> Void
    @Environment(\.palette) private var palette

    var body: some View {
        let state = model.state
        switch state.phase {
        case .loading:
            SkeletonFeed()
        case .failed:
            ErrorStateView(error: state.error ?? .unknown) { model.viewModel.refresh() }.padding(.top, 24)
        case .empty:
            EmptyState(title: L10n.Notifications.empty)
                .padding(.top, 40)
        case .ready:
            ForEach(state.items, id: \.id) { notice in
                Button {
                    model.viewModel.markRead(id: notice.id)
                    if let slug = notice.consultationSlug { open(slug) }
                } label: {
                    NoticeRow(notice: notice)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
    }
}

private struct NoticeRow: View {
    let notice: Notice
    @Environment(\.palette) private var palette

    var body: some View {
        let style = self.style
        HStack(alignment: .top, spacing: PostMetrics.gap) {
            PinBadge(symbol: style.symbol, color: style.color, size: PostMetrics.avatar)
            VStack(alignment: .leading, spacing: 3) {
                Text(L10n.message(key: notice.messageKey, params: notice.params))
                    .font(notice.unread ? PostMetrics.text.weight(.semibold) : PostMetrics.text)
                    .lineLimit(2)
                Text(CompactTime.since(notice.createdAt.date))
                    .font(PostMetrics.text)
                    .foregroundStyle(palette.textTertiary)
            }
            Spacer(minLength: 0)
            if notice.unread {
                Circle().fill(RutaHighlight.color).frame(width: 9, height: 9).padding(.top, 6).accessibilityHidden(true)
            }
        }
        .padding(.horizontal, PostMetrics.inset)
        .padding(.vertical, 12)
        .overlay(alignment: .bottom) { Rectangle().fill(palette.hairline).frame(height: 0.5) }
        .accessibilityElement(children: .combine)
    }

    private var style: (symbol: String, color: Color) {
        let key = notice.messageKey
        if key.contains("consultation") { return ("text.bubble", .blue) }
        if key.contains("traffic") { return ("exclamationmark.triangle", .orange) }
        if key.contains("place") { return ("mappin.and.ellipse", .green) }
        if key.contains("business") { return ("storefront", .purple) }
        if key.contains("route") { return ("figure.hiking", .green) }
        return ("bell.fill", .gray)
    }
}

private extension ContributeAction {
    var tint: Color {
        switch self {
        case .consultation: .blue
        case .traffic: .orange
        case .place: .green
        }
    }
}
