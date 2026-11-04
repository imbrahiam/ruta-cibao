import RutaKit
import SwiftUI

/// Pushed when a post is opened.
struct ConsultationRoute: Hashable {
    let slug: String
}

struct ConsultationsScreen: View {
    @Environment(\.graph) private var graph
    @State private var model: ConsultationsModel?
    @State private var path: [ConsultationRoute] = Self.debugPath
    @Environment(DeepLinks.self) private var links

    /// Debug-only: `SIMCTL_CHILD_RUTA_DEBUG_SLUG=<slug>` opens a post (screenshot runs).
    private static var debugPath: [ConsultationRoute] {
        #if DEBUG
        if let slug = ProcessInfo.processInfo.environment["RUTA_DEBUG_SLUG"], !slug.isEmpty { return [ConsultationRoute(slug: slug)] }
        #endif
        return []
    }

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if let model {
                    ConsultationsFeed(model: model) { path.append(ConsultationRoute(slug: $0)) }
                } else {
                    SkeletonFeed()
                }
            }
            .tabBarClearance()
            .navigationTitle(L10n.Consultations.title)
            // The tab bar already says where you are; the feed opens on content.
            .toolbarVisibility(.hidden, for: .navigationBar)
            .navigationDestination(for: ConsultationRoute.self) { route in
                ConsultationDetailScreen(slug: route.slug).tabBarClearance()
            }
        }
        .onChange(of: links.pending, initial: true) { _, target in
            guard case .consultation(let slug) = target else { return }
            path = [ConsultationRoute(slug: slug)]
            links.pending = nil
        }
        .task {
            guard let graph else { return }
            let model = self.model ?? ConsultationsModel(graph: graph)
            self.model = model
            await model.observe()
        }
    }
}

private struct ConsultationsFeed: View {
    let model: ConsultationsModel
    let open: (String) -> Void
    @Environment(\.graph) private var graph
    @State private var menuFor: ConsultationsBrowseOutput.Item?
    private var state: ConsultationsUiState { model.state }
    private var vm: ConsultationsViewModel { model.viewModel }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 0, pinnedViews: []) {
                StatusFilter(selected: state.status) { vm.selectStatus(status: $0) }
                content
            }
        }
        .defaultScrollAnchor(DebugFlags.scrollToBottom ? .bottom : .top)
        // The system pull-to-refresh: its spinner, its haptic, its timing.
        .refreshable {
            vm.refresh()
            try? await Task.sleep(for: .milliseconds(150))
            while model.state.refreshing { try? await Task.sleep(for: .milliseconds(100)) }
        }
        .accessibilityLabel(L10n.Consultations.title)
        .sheet(item: $menuFor) { item in
            PostMenu(consultationId: item.id, slug: item.slug, title: item.title) {
                vm.hiddenChanged(consultationId: item.id)
            }
        }
        .fullScreenCover(isPresented: Binding(
            get: { state.signInRequested },
            set: { if !$0 { vm.signInHandled() } }
        )) {
            SignInScreen()
        }
    }

    @ViewBuilder private var content: some View {
        switch state.phase {
        case .loading:
            ProgressView()
                .controlSize(.large)
                .frame(maxWidth: .infinity)
                .padding(.top, 140)
        case .failed:
            ErrorStateView(error: state.error ?? .unknown) { vm.retry() }
                .padding(.top, 80)
        case .empty:
            EmptyState(art: .mailbox, title: L10n.Consultations.empty, message: L10n.Consultations.emptyBody)
                .padding(.top, 60)
        case .ready:
            ForEach(state.items, id: \.id) { item in
                ConsultationPost(item: item, open: { open(item.slug) }, more: { menuFor = item }) { vm.toggleSupport(id: item.id) }
                    .onAppear {
                        if item.id == state.items.last?.id { vm.loadMore() }
                    }
            }
            if state.loadingMore {
                ProgressView().frame(maxWidth: .infinity).padding(24)
            }
        }
    }
}

// MARK: - Filter

private struct StatusFilter: View {
    let selected: ConsultationsBrowseInput.Status?
    let select: (ConsultationsBrowseInput.Status?) -> Void

    var body: some View {
        CenterWheel(
            options: [nil] + ConsultationsBrowseInput.Status.allCases,
            selected: selected,
            title: { $0.map(ConsultationStatusText.label) ?? L10n.Consultations.allTab },
            select: select
        )
        .padding(.vertical, 4)
    }
}

// MARK: - Post

/// One case as a Threads post: avatar, name and time on one line, the text,
/// optional media, bare action icons, then the counts in one quiet line.
private struct ConsultationPost: View {
    let item: ConsultationsBrowseOutput.Item
    let open: () -> Void
    let more: () -> Void
    let support: () -> Void
    @Environment(\.palette) private var palette

    var body: some View {
        let photos = (item.photos ?? []).map(PostPhoto.init)
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: PostMetrics.gap) {
                CategoryPinBadge(icon: item.categoryIcon, hex: item.categoryColor, size: PostMetrics.avatar)
                VStack(alignment: .leading, spacing: 3) {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(item.categoryName)
                            .font(PostMetrics.name)
                            .lineLimit(1)
                        Spacer(minLength: 8)
                        Text(CompactTime.since(item.createdAt.date))
                            .font(PostMetrics.text)
                            .foregroundStyle(palette.textTertiary)
                            .layoutPriority(1)
                        MoreButton(action: more)
                    }
                    Text(item.title)
                        .font(PostMetrics.text)
                        .lineSpacing(2)
                        .lineLimit(6)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.horizontal, PostMetrics.inset)
            .contentShape(Rectangle())
            .onTapGesture(perform: open)
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isButton)
            .accessibilityAction(.default, open)

            if !photos.isEmpty {
                PostMedia(photos: photos, leadingInset: PostMetrics.column)
                    .padding(.top, 10)
            }

            PostActions(supported: item.supported, support: support, reply: open, shareURL: shareURL(item.slug), shareTitle: item.title)
                .padding(.leading, PostMetrics.column - 11)
                .padding(.top, 4)

            HStack(alignment: .center, spacing: 0) {
                // Who replied, Threads-style: the ayuntamiento's mark under the thread line.
                // Centred under the post avatar (avatar centre = inset + avatar / 2).
                ZStack(alignment: .leading) {
                    if item.responseCount > 0 { ReplierAvatar() }
                }
                .padding(.leading, PostMetrics.inset + PostMetrics.avatar / 2 - 10)
                .frame(width: PostMetrics.column, alignment: .leading)
                PostCounts(status: item.statusValue, responses: Int(item.responseCount), supports: Int(item.supportCount))
                    .padding(.trailing, PostMetrics.inset)
                Spacer(minLength: 0)
            }
        }
        .padding(.top, 14)
        .padding(.bottom, 14)
        .background(alignment: .topLeading) {
            // The thread line runs from under the avatar to the counts when
            // the ayuntamiento has replied, as in Threads.
            if item.responseCount > 0 {
                Capsule()
                    .fill(palette.hairline)
                    .frame(width: 2)
                    .padding(.top, 14 + PostMetrics.avatar + 6)
                    .padding(.bottom, 14 + 22)
                    .padding(.leading, PostMetrics.inset + PostMetrics.avatar / 2 - 1)
            }
        }
        .overlay(alignment: .bottom) {
            Rectangle().fill(palette.hairline).frame(height: 0.5)
        }
    }
}

/// One type size for the whole post (Threads uses 15pt throughout), weight
/// carries the hierarchy. Column math in one place.
enum PostMetrics {
    static let inset: CGFloat = 16
    static let avatar: CGFloat = 36
    static let gap: CGFloat = 12
    static var column: CGFloat { inset + avatar + gap }
    static let name = Font.subheadline.weight(.semibold)
    static let text = Font.subheadline
}

func shareURL(_ slug: String) -> URL {
    URL(string: "https://rutacibao.do/consultas/\(slug)")!
}

/// "…" at the end of the byline, as in Threads.
struct MoreButton: View {
    let action: () -> Void
    @Environment(\.palette) private var palette

    var body: some View {
        Button(action: action) {
            Image(systemName: "ellipsis")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(palette.text)
                .frame(width: 32, height: 24)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(.leading, 4)
        .accessibilityLabel(L10n.SafetyUi.menuLabel)
    }
}

/// The small avatar for who replied: always the ayuntamiento here.
struct ReplierAvatar: View {
    @Environment(\.palette) private var palette

    var body: some View {
        GlyphDisc(symbol: "building.columns", size: 20)
            .overlay { Circle().strokeBorder(palette.background, lineWidth: 1.5) }
            .accessibilityHidden(true)
    }
}

/// The action row: thin outline SF Symbols. Support is a heart, filled in
/// the app colour once you've given it.
struct PostActions: View {
    let supported: Bool
    let support: () -> Void
    let reply: () -> Void
    let shareURL: URL
    let shareTitle: String
    var showsReply = true
    @Environment(\.palette) private var palette

    var body: some View {
        HStack(spacing: 0) {
            Button(action: support) {
                Image(systemName: supported ? "heart.fill" : "heart")
                    .foregroundStyle(supported ? RutaHighlight.support : palette.text)
                    .symbolEffect(.bounce, value: supported)
                    .contentTransition(.symbolEffect(.replace))
                    .postIcon()
            }
            .sensoryFeedback(.impact(weight: .light), trigger: supported)
            .accessibilityLabel(supported ? L10n.Consultations.supported : L10n.Consultations.support)
            .accessibilityAddTraits(supported ? .isSelected : [])

            if showsReply {
                Button(action: reply) {
                    Image(systemName: "bubble").postIcon()
                }
                .accessibilityLabel(L10n.Consultations.timeline)
            }

            ShareLink(item: shareURL, subject: Text(shareTitle)) {
                Image(systemName: "paperplane").postIcon()
            }
            .accessibilityLabel(L10n.Common.share)
        }
        .buttonStyle(.plain)
        .foregroundStyle(palette.text)
    }
}

private extension View {
    func postIcon() -> some View {
        font(.system(size: 19, weight: .light))
            .frame(width: 40, height: 36)
            .contentShape(Rectangle())
    }
}

/// "En revisión · 1 respuesta · 9 apoyos", showing only what says something:
/// counts above zero, and the status once it has moved past "Recibida".
/// The status is its word and its colour, never colour alone.
struct PostCounts: View {
    let status: ConsultationsBrowseInput.Status
    let responses: Int
    let supports: Int
    @Environment(\.palette) private var palette

    var body: some View {
        let parts: [Text] = [
            status == .open ? nil : Text(ConsultationStatusText.label(status)).foregroundStyle(statusInk),
            responses > 0 ? Text(L10n.Consultations.responses(count: responses)) : nil,
            supports > 0 ? Text(L10n.Consultations.supports(count: supports)) : nil,
        ].compactMap { $0 }
        if let first = parts.first {
            parts.dropFirst().reduce(first) { $0 + Text(verbatim: " · ") + $1 }
                .font(PostMetrics.text)
                .foregroundStyle(palette.textTertiary)
                .lineLimit(1)
                .contentTransition(.numericText())
                .animation(.snappy, value: supports)
                .padding(.top, 2)
        }
    }

    private var statusInk: Color {
        switch status {
        case .open: palette.textTertiary
        case .inReview: palette.warningInk
        case .answered, .resolved: palette.successInk
        case .rejected: palette.dangerInk
        }
    }
}

/// Threads' terse age ("5 min", "3 h", "2 sem"), in the system's locale.
enum CompactTime {
    private static let formatter: DateComponentsFormatter = {
        let f = DateComponentsFormatter()
        f.unitsStyle = .abbreviated
        f.maximumUnitCount = 1
        f.allowedUnits = [.minute, .hour, .day, .weekOfMonth, .year]
        return f
    }()

    static func since(_ date: Date) -> String {
        let seconds = max(60, Date.now.timeIntervalSince(date))
        return formatter.string(from: seconds) ?? ""
    }
}

extension KotlinInstant {
    var date: Date { Date(timeIntervalSince1970: TimeInterval(toEpochMilliseconds()) / 1000) }
}

struct StatusPill: View {
    let status: ConsultationsBrowseInput.Status
    @Environment(\.palette) private var palette

    var body: some View {
        let (ink, symbol) = style
        HStack(spacing: 4) {
            Image(systemName: symbol).font(.caption2.weight(.bold))
            Text(ConsultationStatusText.label(status))
        }
        .font(.caption.weight(.semibold))
        .foregroundStyle(ink)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(ink.opacity(0.1), in: Capsule())
        .fixedSize()
    }

    /// Each status has its own symbol, so colour is never the only signal.
    private var style: (Color, String) {
        switch status {
        case .open: (palette.textSecondary, "circle")
        case .inReview: (palette.warningInk, "clock")
        case .answered: (palette.successInk, "text.bubble.fill")
        case .resolved: (palette.successInk, "checkmark.circle.fill")
        case .rejected: (palette.dangerInk, "xmark.circle.fill")
        }
    }
}

// MARK: - Skeleton

struct SkeletonFeed: View {
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(spacing: 0) {
            ForEach(0..<5, id: \.self) { _ in
                HStack(alignment: .top, spacing: 12) {
                    Circle().frame(width: 40, height: 40)
                    VStack(alignment: .leading, spacing: 8) {
                        Capsule().frame(width: 180, height: 12)
                        Capsule().frame(height: 12)
                        Capsule().frame(width: 220, height: 12)
                        Capsule().frame(width: 120, height: 12).padding(.top, 6)
                    }
                }
                .foregroundStyle(palette.inset)
                .padding(16)
            }
        }
        .shimmering()
        .accessibilityLabel(L10n.Common.loading)
    }
}

enum ConsultationStatusText {
    static func label(_ status: ConsultationsBrowseInput.Status) -> String {
        switch status {
        case .open: L10n.Consultations.StatusLabel.open
        case .inReview: L10n.Consultations.StatusLabel.in_review
        case .answered: L10n.Consultations.StatusLabel.answered
        case .resolved: L10n.Consultations.StatusLabel.resolved
        case .rejected: L10n.Consultations.StatusLabel.rejected
        }
    }
}

/// Debug-only screenshot switches, read from the launch environment.
enum DebugFlags {
    /// `SIMCTL_CHILD_RUTA_DEBUG_SCROLL=bottom`: feeds open at their end, to check the tab bar clears it.
    static var scrollToBottom: Bool {
        #if DEBUG
        ProcessInfo.processInfo.environment["RUTA_DEBUG_SCROLL"] == "bottom"
        #else
        false
        #endif
    }
}
