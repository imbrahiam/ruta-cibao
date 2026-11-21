import RutaKit
import SwiftUI

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

    var detail: String {
        switch self {
        case .consultation: L10n.Contributions.exampleCaseBody
        case .traffic: L10n.Contributions.exampleTrafficBody
        case .place: L10n.Contributions.examplePlaceBody
        }
    }

    var symbol: String {
        switch self {
        case .consultation: "bubble.left"
        case .traffic: "exclamationmark.triangle"
        case .place: Glyph.location
        }
    }
}

/// What a resident sent and what came back: their contributions and the notices about them.
/// Adding something new is the header's add button, from anywhere in the app.
struct ContributionsScreen: View {
    @Environment(DeepLinks.self) private var links
    @Environment(AppChrome.self) private var chrome
    @State private var path: [ConsultationRoute] = []
    @State private var signingIn = false
    @State private var section: Section = DebugHook.value("RUTA_DEBUG_COMPOSE") == "inbox" ? .inbox : .mine

    enum Section { case mine, inbox }

    var body: some View {
        NavigationStack(path: $path) {
            Host(make: { $0.contributions() }, flow: { $0.state }) { mine in
                Host(make: { $0.inbox() }, flow: { $0.state }) { inbox in
                    page(mine, inbox)
                        .rootHeader(L10n.Contributions.title) {
                            if mine.state.signedIn { sections(inbox) }
                        }
                        // Something was just sent from the header's add button: show it.
                        .onChange(of: chrome.sent) { _, _ in mine.vm.refresh() }
                        .onChange(of: links.requestId, initial: true) { _, _ in
                            guard links.pending == .contributions else { return }
                            links.pending = nil
                            section = .inbox
                            inbox.vm.refresh()
                        }
                }
            }
            .navigationTitle(L10n.Contributions.title)
            .paperBackground()
            .navigationDestination(for: ConsultationRoute.self) { ConsultationDetailScreen(slug: $0.slug) }
        }
        .fullScreenCover(isPresented: $signingIn) { SignInScreen() }
    }

    private func sections(_ inbox: Screen<InboxViewModel, InboxUiState>) -> some View {
        HStack(spacing: 6) {
            Chip(title: L10n.Contributions.mine, selected: section == .mine, onBrand: true) { withAnimation(Motion.quick) { section = .mine } }
            Chip(title: L10n.Contributions.inbox, selected: section == .inbox, onBrand: true, badge: Int(inbox.state.unread)) {
                withAnimation(Motion.quick) { section = .inbox }
            }
            Spacer()
            if section == .inbox, inbox.state.unread > 0 {
                Button { inbox.vm.markRead(id: nil) } label: {
                    Label(L10n.Notifications.markAllRead, systemImage: "checkmark").labelStyle(.iconOnly)
                        .font(.system(size: 14, weight: .semibold)).foregroundStyle(Color.onInk)
                        .frame(width: 34, height: 34).background(Color.onInk.opacity(0.14), in: Circle()).frame(minWidth: 44, minHeight: 44)
                }
                .buttonStyle(Pressable())
                .transition(.scale.combined(with: .opacity))
            }
        }
        .padding(.horizontal, Metrics.gutter)
    }

    private func page(_ mine: Screen<ContributionsViewModel, ContributionsUiState>, _ inbox: Screen<InboxViewModel, InboxUiState>) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                if mine.state.signedIn {
                    switch section {
                    case .mine: MineList(model: mine, open: { path.append(ConsultationRoute(slug: $0)) })
                    case .inbox: InboxList(model: inbox, open: { path.append(ConsultationRoute(slug: $0)) })
                    }
                } else {
                    StateView(title: L10n.Contributions.signedOutTitle, message: L10n.Contributions.signedOutBody, actionTitle: L10n.Contributions.signIn, prominent: true) { signingIn = true }
                        .frame(height: 360)
                }
            }
            .padding(.top, 6)
            .readable()
        }
        .refreshable { mine.vm.refresh(); inbox.vm.refresh() }
    }
}

private struct MineList: View {
    let model: Screen<ContributionsViewModel, ContributionsUiState>
    let open: (String) -> Void
    @Environment(AppChrome.self) private var chrome: AppChrome?
    @Environment(DeepLinks.self) private var links

    var body: some View {
        switch model.state.phase {
        case .loading: ContributionSkeleton(showsStatus: true)
        case .failed: StateView(error: model.state.error ?? .unknown) { model.vm.retry() }.frame(height: 280)
        case .empty:
            StateView(title: L10n.Contributions.empty, message: L10n.Contributions.emptyBody, actionTitle: L10n.Contributions.contribute) { chrome?.contributing = true }
                .frame(height: 280)
        case .ready:
            ForEach(model.state.items, id: \.id) { item in
                Button {
                    if let slug = model.state.slugFor(item: item) { open(slug) } else if let href = item.href { links.open(href) }
                } label: {
                    HStack(spacing: 14) {
                        GlyphDisc(icon: item.categoryIcon, tint: .neutral)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(item.name).type(.bodyStrong).lineLimit(1)
                            Text("\(kind(item)) · \(CompactTime.since(item.createdAt.date))").type(.callout, .ink3)
                            // The team's reason, when they left one: why it was not approved, or what changed.
                            if let note = item.note, !note.isEmpty {
                                Text(note).type(.callout, .ink2).lineLimit(3).padding(.top, 2)
                            }
                        }
                        Spacer(minLength: 8)
                        StatusTag(text: status(item), color: color(item), symbol: symbol(item))
                    }
                    .padding(.horizontal, Metrics.gutter)
                    .padding(.vertical, 10)
                }
                .buttonStyle(RowPress())
                .disabled(model.state.slugFor(item: item) == nil && item.href == nil)
            }
        }
    }

    private func kind(_ item: PlacesContributionsItem) -> String {
        switch item.kind {
        case .place: L10n.Contributions.Kind.place
        case .report: L10n.Contributions.Kind.report
        case .photo: L10n.Contributions.Kind.photo
        case .traffic: L10n.Contributions.Kind.traffic
        case .consultation: L10n.Contributions.Kind.consultation
        case .claim: L10n.Contributions.Kind.claim
        }
    }

    private func status(_ item: PlacesContributionsItem) -> String {
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

    /// The same glyphs as a consultation's state, so a state reads alike everywhere.
    private func symbol(_ item: PlacesContributionsItem) -> String {
        switch item.status {
        case .published, .approved, .active, .resolved: "checkmark.circle.fill"
        case .answered: "bubble.left.fill"
        case .pending, .inReview: "eye.fill"
        case .draft: "pencil"
        case .open: "tray.and.arrow.down.fill"
        case .rejected, .removed: "xmark.circle.fill"
        case .expired, .cleared, .archived, .dismissed: "clock.fill"
        }
    }

    private func color(_ item: PlacesContributionsItem) -> Color {
        switch item.status {
        case .published, .resolved, .answered, .approved, .active: .success
        case .pending, .inReview, .draft: .warning
        case .rejected, .removed: .danger
        default: .ink3
        }
    }
}

private struct InboxList: View {
    let model: Screen<InboxViewModel, InboxUiState>
    let open: (String) -> Void
    @Environment(DeepLinks.self) private var links

    var body: some View {
        switch model.state.phase {
        case .loading: ContributionSkeleton(showsStatus: false)
        case .failed: StateView(error: model.state.error ?? .unknown) { model.vm.refresh() }.frame(height: 280)
        case .empty: StateView(symbol: "tray", title: L10n.Contributions.inboxEmpty, message: L10n.Contributions.inboxEmptyBody).frame(height: 280)
        case .ready:
            ForEach(model.state.items, id: \.id) { notice in
                Button {
                    model.vm.markRead(id: notice.id)
                    if let slug = notice.consultationSlug { open(slug) } else if let href = notice.href { links.open(href) }
                } label: {
                    HStack(alignment: .top, spacing: 14) {
                        GlyphDisc(icon: notice.categoryIcon ?? "bell", tint: .neutral)
                            .overlay(alignment: .topTrailing) {
                                if notice.unread { Circle().fill(Color.action).frame(width: 9, height: 9).overlay(Circle().strokeBorder(Color.paper, lineWidth: 2)) }
                            }
                        VStack(alignment: .leading, spacing: 3) {
                            Text(L10n.message(key: notice.messageKey, params: notice.params))
                                .type(notice.unread ? .bodyStrong : .body, notice.unread ? .ink : .ink2)
                                .multilineTextAlignment(.leading)
                            Text(CompactTime.since(notice.createdAt.date)).type(.caption, .ink3)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, Metrics.gutter)
                    .padding(.vertical, 10)
                }
                .buttonStyle(RowPress())
                .accessibilityValue(notice.unread ? L10n.Notifications.unread : "")
            }
        }
    }
}

private struct ContributionSkeleton: View {
    let showsStatus: Bool

    var body: some View {
        Skeleton {
            VStack(spacing: 0) {
                ForEach(0..<4) { _ in
                    HStack(spacing: 14) {
                        Circle().frame(width: 40, height: 40)
                        VStack(alignment: .leading, spacing: 3) {
                            SkeletonLine(showsStatus ? 145 : 215)
                            SkeletonLine(112, lineHeight: 17, barHeight: 10, relativeTo: .callout)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        if showsStatus { Capsule().frame(width: 68, height: 22) }
                    }
                    .padding(.horizontal, Metrics.gutter)
                    .padding(.vertical, 10)
                }
            }
        }
    }
}
