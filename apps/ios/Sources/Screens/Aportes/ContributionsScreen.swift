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

    var tint: Tint {
        switch self {
        case .consultation: .lavender
        case .traffic: .butter
        case .place: .mint
        }
    }

    var symbol: String {
        switch self {
        case .consultation: "bubble.left"
        case .traffic: "exclamationmark.triangle"
        case .place: "mappin.and.ellipse"
        }
    }
}

/// Where a resident adds to the map: three ways to contribute, then what they sent and what came back.
struct ContributionsScreen: View {
    @Environment(\.graph) private var graph
    @Environment(DeepLinks.self) private var links
    @State private var path: [ConsultationRoute] = []
    @State private var action: ContributeAction? = DebugHook.value("RUTA_DEBUG_COMPOSE").flatMap(ContributeAction.init(rawValue:))
    @State private var wanted: ContributeAction?
    @State private var signingIn = false
    @State private var section: Section = DebugHook.value("RUTA_DEBUG_COMPOSE") == "inbox" ? .inbox : .mine

    enum Section { case mine, inbox }

    var body: some View {
        NavigationStack(path: $path) {
            Host(make: { $0.contributions() }, flow: { $0.state }) { mine in
                Host(make: { $0.inbox() }, flow: { $0.state }) { inbox in
                    page(mine, inbox)
                        .fullScreenCover(item: $action, onDismiss: { mine.vm.refresh() }) { action in
                            switch action {
                            case .consultation:
                                NewConsultationScreen { slug in mine.vm.refresh(); path.append(ConsultationRoute(slug: slug)) }
                            case .traffic: TrafficReportScreen()
                            case .place: SuggestPlaceScreen()
                            }
                        }
                        .onChange(of: links.requestId, initial: true) { _, _ in
                            guard links.pending == .contributions else { return }
                            links.pending = nil
                            section = .inbox
                            inbox.vm.refresh()
                        }
                }
            }
            .navigationTitle(L10n.Contributions.title)
            .navigationBarTitleDisplayMode(.inline)
            .paperBackground()
            .navigationDestination(for: ConsultationRoute.self) { ConsultationDetailScreen(slug: $0.slug) }
        }
        .fullScreenCover(isPresented: $signingIn, onDismiss: {
            if graph?.session.isSignedIn.value == true { action = wanted }
            wanted = nil
        }) { SignInScreen() }
    }

    private func start(_ next: ContributeAction) {
        if graph?.session.isSignedIn.value == true { action = next } else { wanted = next; signingIn = true }
    }

    private func page(_ mine: Screen<ContributionsViewModel, ContributionsUiState>, _ inbox: Screen<InboxViewModel, InboxUiState>) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                VStack(spacing: 0) {
                    ForEach(Array(ContributeAction.allCases.enumerated()), id: \.element) { index, item in
                        Button { start(item) } label: {
                            HStack(spacing: 14) {
                                GlyphDisc(symbol: item.symbol, size: 44, tint: item.tint)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item.title).type(.bodyStrong)
                                    Text(item.detail).type(.callout, .ink3).lineLimit(2).multilineTextAlignment(.leading)
                                }
                                Spacer(minLength: 8)
                                Image(systemName: "arrow.up.right").font(.system(size: 13, weight: .medium)).foregroundStyle(Color.ink3)
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 14)
                        }
                        .buttonStyle(RowPress())
                        .rise(index)
                        if index < ContributeAction.allCases.count - 1 { Hairline(inset: 74) }
                    }
                }
                .background(Color.card, in: RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous).strokeBorder(Color.line, lineWidth: 1))
                .clipShape(RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
                .padding(.horizontal, Metrics.gutter)

                if mine.state.signedIn {
                    HStack(spacing: 8) {
                        Chip(title: L10n.Contributions.mine, selected: section == .mine) { withAnimation(Motion.quick) { section = .mine } }
                        Chip(title: inbox.state.unread > 0 ? L10n.Contributions.inboxCount(count: String(inbox.state.unread)) : L10n.Contributions.inbox, selected: section == .inbox) {
                            withAnimation(Motion.quick) { section = .inbox }
                        }
                        Spacer()
                        if section == .inbox, inbox.state.unread > 0 {
                            IconButton(symbol: "checkmark", label: L10n.Notifications.markAllRead) { inbox.vm.markRead(id: nil) }
                                .transition(.scale.combined(with: .opacity))
                        }
                    }
                    .padding(.horizontal, Metrics.gutter)
                    .padding(.top, 26)
                    .padding(.bottom, 8)

                    switch section {
                    case .mine: MineList(model: mine, open: { path.append(ConsultationRoute(slug: $0)) })
                    case .inbox: InboxList(model: inbox, open: { path.append(ConsultationRoute(slug: $0)) })
                    }
                } else {
                    StateView(title: L10n.Contributions.signedOutTitle, message: L10n.Contributions.signedOutBody, actionTitle: L10n.Contributions.signIn) { signingIn = true }
                        .frame(height: 300)
                }
            }
            .readable()
        }
        .refreshable { mine.vm.refresh(); inbox.vm.refresh() }
    }
}

private struct MineList: View {
    let model: Screen<ContributionsViewModel, ContributionsUiState>
    let open: (String) -> Void
    @Environment(DeepLinks.self) private var links

    var body: some View {
        switch model.state.phase {
        case .loading: LoadingDots().frame(height: 200)
        case .failed: StateView(error: model.state.error ?? .unknown) { model.vm.retry() }.frame(height: 280)
        case .empty: StateView(title: L10n.Contributions.empty, message: L10n.Contributions.emptyBody).frame(height: 280)
        case .ready:
            ForEach(model.state.items, id: \.id) { item in
                Button {
                    if let slug = model.state.slugFor(item: item) { open(slug) } else if let href = item.href { links.open(href) }
                } label: {
                    HStack(spacing: 14) {
                        GlyphDisc(icon: item.categoryIcon, tint: .of(hex: item.categoryColor))
                        VStack(alignment: .leading, spacing: 3) {
                            Text(item.name).type(.bodyStrong).lineLimit(1)
                            HStack(spacing: 6) {
                                Text("\(kind(item)) · \(CompactTime.since(item.createdAt.date))").type(.callout, .ink3)
                                Circle().fill(color(item)).frame(width: 6, height: 6).padding(.leading, 2)
                                Text(status(item)).type(.callout, .ink2)
                            }
                        }
                        Spacer(minLength: 8)
                        Image(systemName: "chevron.right").font(.system(size: 12, weight: .medium)).foregroundStyle(Color.ink4)
                    }
                    .padding(.horizontal, Metrics.gutter)
                    .padding(.vertical, 13)
                }
                .buttonStyle(RowPress())
                .disabled(model.state.slugFor(item: item) == nil && item.href == nil)
                Hairline(inset: Metrics.gutter + 54)
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

    private func color(_ item: PlacesContributionsItem) -> Color {
        switch item.status {
        case .published, .resolved, .answered, .approved, .active: .success
        case .pending, .inReview, .draft: .warning
        case .rejected, .removed: .danger
        default: .ink4
        }
    }
}

private struct InboxList: View {
    let model: Screen<InboxViewModel, InboxUiState>
    let open: (String) -> Void
    @Environment(DeepLinks.self) private var links

    var body: some View {
        switch model.state.phase {
        case .loading: LoadingDots().frame(height: 200)
        case .failed: StateView(error: model.state.error ?? .unknown) { model.vm.refresh() }.frame(height: 280)
        case .empty: StateView(symbol: "tray", title: L10n.Contributions.inboxEmpty, message: L10n.Contributions.inboxEmptyBody).frame(height: 280)
        case .ready:
            ForEach(model.state.items, id: \.id) { notice in
                Button {
                    model.vm.markRead(id: notice.id)
                    if let slug = notice.consultationSlug { open(slug) } else if let href = notice.href { links.open(href) }
                } label: {
                    HStack(alignment: .top, spacing: 14) {
                        GlyphDisc(icon: notice.categoryIcon ?? "bell", tint: notice.categoryColor.map(Tint.of(hex:)) ?? .lavender)
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
                    .padding(.vertical, 13)
                }
                .buttonStyle(RowPress())
                .accessibilityValue(notice.unread ? L10n.Notifications.unread : "")
                Hairline(inset: Metrics.gutter + 54)
            }
        }
    }
}
