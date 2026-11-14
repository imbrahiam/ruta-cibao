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
        DebugHook.value("RUTA_DEBUG_COMPOSE") == "inbox" ? .inbox : .mine
        #else
        .mine
        #endif
    }()
    @State private var path: [ConsultationRoute] = []

    private enum Section: Hashable { case mine, inbox }
    private var unread: Int { Int(inbox?.state.unread ?? 0) }
    @State private var composing: ContributeAction? = Self.debugComposing

    /// Debug-only: `SIMCTL_CHILD_RUTA_DEBUG_COMPOSE=traffic` opens a form at launch (screenshot runs).
    private static var debugComposing: ContributeAction? {
        #if DEBUG
        DebugHook.value("RUTA_DEBUG_COMPOSE").flatMap(ContributeAction.init(rawValue:))
        #else
        nil
        #endif
    }
    @State private var signingIn = false
    /// What the person tapped before being asked to sign in.
    @State private var wanted: ContributeAction?

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if let model {
                    content(model)
                } else {
                    Color.clear
                }
            }
            .navigationTitle(L10n.Contributions.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if model?.state.signedIn == true {
                    // The system's segmented control in the bar, as in Phone or Calendar.
                    ToolbarItem(placement: .principal) {
                        Picker(L10n.Contributions.title, selection: $section) {
                            Text(L10n.Contributions.mine).tag(Section.mine)
                            Text(unread > 0 ? L10n.Contributions.inboxCount(count: String(unread)) : L10n.Contributions.inbox).tag(Section.inbox)
                        }
                        .pickerStyle(.segmented)
                        .fixedSize()
                    }
                    if section == .inbox, unread > 0 {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button(L10n.Notifications.markAllRead, systemImage: "checkmark") { inbox?.viewModel.markRead(id: nil) }
                        }
                    }
                }
            }
            .sensoryFeedback(.selection, trigger: section)
            .accessibilityElement(children: .contain)
            .accessibilityLabel(L10n.Contributions.title)
            .navigationDestination(for: ConsultationRoute.self) { ConsultationDetailScreen(slug: $0.slug) }
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
        // Signed in to do something: carry on with it instead of making them tap again.
        .fullScreenCover(isPresented: $signingIn, onDismiss: {
            if let action = wanted, model?.state.signedIn == true { composing = action }
            wanted = nil
        }) { SignInScreen() }
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
            LazyVStack(alignment: .leading, spacing: 0) {
                ActionTiles { action in
                    if state.signedIn { composing = action } else { wanted = action; signingIn = true }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 12)

                if !state.signedIn {
                    signedOut
                } else if section == .inbox, let inbox {
                    InboxList(model: inbox) { slug in path.append(ConsultationRoute(slug: slug)) }
                } else {
                    PendingOutboxView(hidesWhenEmpty: true)
                    myContributions(model)
                }
            }
            .padding(.bottom, 24)
            .animation(.snappy(duration: 0.25), value: section)
        }
        .readableWidth()
        .refreshable {
            model.viewModel.refresh()
            inbox?.viewModel.refresh()
        }
    }

    private var signedOut: some View {
        ContentUnavailableView {
            Label(L10n.Contributions.signedOutTitle, systemImage: "square.stack")
        } actions: {
            Button { signingIn = true } label: {
                Text(L10n.Contributions.signIn).font(.headline).padding(.horizontal, 28).frame(minHeight: 50)
            }
            .buttonStyle(RutaProminentStyle())
        }
        .padding(.top, 48)
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
                } else if let href = item.href {
                    // A place or a live traffic report: the map opens on it.
                    Button { links.open(href) } label: {
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

/// One contribution as an X row: the thing's own pin (the case's, the
/// place's, the traffic report's category) with a small badge for what you
/// did, the bold name and its age on one line, then kind and status.
private struct ContributionRow: View {
    let item: PlacesContributionsItem
    let opens: Bool
    @Environment(\.palette) private var palette

    var body: some View {
        HStack(alignment: .top, spacing: PostMetrics.gap) {
            SubjectAvatar(icon: item.categoryIcon, hex: item.categoryColor, badge: kindStyle.badge)
            VStack(alignment: .leading, spacing: 2) {
                // The age flows on after the name, as X writes it, even when the name wraps.
                (Text(item.name).font(.subheadline.weight(.bold)).foregroundStyle(palette.text)
                    + Text(verbatim: " · \(CompactTime.since(item.createdAt.date))").font(.subheadline).foregroundStyle(palette.textTertiary))
                    .lineLimit(3)
                    .fixedSize(horizontal: false, vertical: true)
                (Text(kindStyle.kind).foregroundStyle(palette.textTertiary)
                    + Text(verbatim: " · ").foregroundStyle(palette.textTertiary)
                    + Text(statusText).foregroundStyle(statusInk).fontWeight(.medium))
                    .font(.subheadline)
                if let note = item.note, !note.isEmpty {
                    Text(note)
                        .font(.subheadline)
                        .foregroundStyle(palette.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 2)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, PostMetrics.inset)
        .padding(.vertical, 12)
        .overlay(alignment: .bottom) { RowSeparator() }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    /// What you did, as the badge's glyph and the word beside the status.
    private var kindStyle: (badge: String, kind: String) {
        switch item.kind {
        case .place: ("plus", L10n.Contributions.Kind.place)
        case .report: ("flag.fill", L10n.Contributions.Kind.report)
        case .photo: ("camera.fill", L10n.Contributions.Kind.photo)
        case .traffic: ("exclamationmark.triangle.fill", L10n.Contributions.Kind.traffic)
        case .consultation: ("text.bubble.fill", L10n.Contributions.Kind.consultation)
        case .claim: ("storefront.fill", L10n.Contributions.Kind.claim)
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
    @Environment(DeepLinks.self) private var links

    var body: some View {
        let state = model.state
        switch state.phase {
        case .loading:
            SkeletonFeed()
        case .failed:
            ErrorStateView(error: state.error ?? .unknown) { model.viewModel.refresh() }.padding(.top, 24)
        case .empty:
            EmptyState(symbol: "bell", title: L10n.Notifications.empty)
                .padding(.top, 40)
        case .ready:
            ForEach(state.items, id: \.id) { notice in
                Button {
                    model.viewModel.markRead(id: notice.id)
                    if let slug = notice.consultationSlug {
                        open(slug)
                    } else if let href = notice.href {
                        links.open(href)
                    }
                } label: {
                    NoticeRow(notice: notice)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
    }
}

/// One notice as an X notification row: the pin of what it is about with a
/// badge for what happened, the sentence (bold while unread) and its age.
/// Unread rows also sit on a faint fill and keep a dot, so it never rests on
/// weight alone.
private struct NoticeRow: View {
    let notice: Notice
    @Environment(\.palette) private var palette

    var body: some View {
        let event = self.event
        HStack(alignment: .top, spacing: PostMetrics.gap) {
            if let icon = notice.categoryIcon, let hex = notice.categoryColor {
                SubjectAvatar(icon: icon, hex: hex, badge: event.symbol, badgeFill: event.fill)
            } else {
                GlyphDisc(symbol: event.symbol, size: PostMetrics.avatar)
            }
            (Text(L10n.message(key: notice.messageKey, params: notice.params))
                .font(notice.unread ? .subheadline.weight(.bold) : .subheadline)
                .foregroundStyle(palette.text)
                + Text(verbatim: " · \(CompactTime.since(notice.createdAt.date))")
                .font(.subheadline)
                .foregroundStyle(palette.textTertiary))
                .lineLimit(3)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 1)
            Spacer(minLength: 0)
            if notice.unread {
                Circle().fill(palette.accentInk).frame(width: 9, height: 9).padding(.top, 6).accessibilityHidden(true)
            }
        }
        .padding(.horizontal, PostMetrics.inset)
        .padding(.vertical, 12)
        .overlay(alignment: .bottom) { RowSeparator() }
        .accessibilityElement(children: .combine)
        .accessibilityValue(notice.unread ? L10n.Notifications.unread : "")
    }

    /// What happened: approvals in green, refusals and removals in red (the
    /// glyph's shape says it too), everything else in ink.
    private var event: (symbol: String, fill: Color?) {
        switch notice.messageKey.replacingOccurrences(of: "notifications.", with: "") {
        case "consultationAnswered": ("building.columns.fill", nil)
        case "consultationStatusChanged": ("arrow.triangle.2.circlepath", nil)
        case "consultationPublished", "placeApproved", "businessClaimApproved", "routeReviewed":
            ("checkmark", palette.successInk)
        case "placeRejected", "consultationHidden", "businessClaimRejected", "trafficRemoved", "trafficTextHidden", "contentRemoved":
            ("xmark", palette.dangerInk)
        case "trafficNearby": ("location.fill", nil)
        case "reportReady": ("doc.text.fill", nil)
        default: ("bell.fill", nil)
        }
    }
}

/// A list row's hairline, starting where the text starts (past the avatar),
/// as the system's list separators do.
struct RowSeparator: View {
    var body: some View {
        Rectangle().fill(Color(.separator)).frame(height: 1 / 3)
            .padding(.leading, PostMetrics.inset + PostMetrics.avatar + PostMetrics.gap)
    }
}

/// Threads' activity avatar: the subject's own map pin, with a small badge at
/// its lower right for what happened to it.
struct SubjectAvatar: View {
    let icon: String
    let hex: String
    let badge: String
    var badgeFill: Color?
    @Environment(\.palette) private var palette

    var body: some View {
        CategoryPinBadge(icon: icon, hex: hex, size: PostMetrics.avatar)
            .overlay(alignment: .bottomTrailing) {
                Image(systemName: badge)
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(badgeFill == nil ? palette.background : .white)
                    .frame(width: 18, height: 18)
                    .background(badgeFill ?? palette.text, in: Circle())
                    .padding(2)
                    .background(.background, in: Circle())
                    .offset(x: 5, y: 5)
            }
            .accessibilityHidden(true)
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
