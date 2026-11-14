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
    @State private var composing = false
    @State private var signingIn = false

    /// Debug-only: `SIMCTL_CHILD_RUTA_DEBUG_SLUG=<slug>` opens a post (screenshot runs).
    private static var debugPath: [ConsultationRoute] {
        #if DEBUG
        if let slug = DebugHook.value("RUTA_DEBUG_SLUG"), !slug.isEmpty { return [ConsultationRoute(slug: slug)] }
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
            .navigationTitle(L10n.Consultations.title)
            .toolbar {
                if let model {
                    ToolbarItem(placement: .topBarTrailing) { StatusFilter(selected: model.state.status) { model.viewModel.selectStatus(status: $0) } }
                    ToolbarSpacer(.fixed, placement: .topBarTrailing)
                    ToolbarItem(placement: .topBarTrailing) {
                        Button(L10n.Consultations.new, systemImage: "square.and.pencil") {
                            if graph?.session.isSignedIn.value == true { composing = true } else { signingIn = true }
                        }
                    }
                }
            }
            .sheet(isPresented: $composing) {
                NewConsultationScreen { slug in
                    model?.viewModel.refresh()
                    path.append(ConsultationRoute(slug: slug))
                }
            }
            .fullScreenCover(isPresented: $signingIn, onDismiss: {
                if graph?.session.isSignedIn.value == true { composing = true }
            }) { SignInScreen() }
            .navigationDestination(for: ConsultationRoute.self) { route in
                ConsultationDetailScreen(slug: route.slug)
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
                content
            }
        }
        .readableWidth()
        .defaultScrollAnchor(DebugFlags.scrollToBottom ? .bottom : .top)
        // The tab bar clearance is the safe area; 16 more so the last card ends above it.
        .contentMargins(.bottom, 16, for: .scrollContent)
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
            SkeletonFeed()
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
                SkeletonFeed(count: 1)
            }
        }
    }
}

// MARK: - Filter

/// The system's filter menu in the bar, as in Mail: one glyph, the options
/// with a tick on the current one. The glyph fills while a filter is on.
private struct StatusFilter: View {
    let selected: ConsultationsBrowseInput.Status?
    let select: (ConsultationsBrowseInput.Status?) -> Void

    var body: some View {
        Menu {
            Picker(L10n.Consultations.filterStatus, selection: Binding(get: { selected }, set: { select($0) })) {
                Text(L10n.Consultations.allTab).tag(ConsultationsBrowseInput.Status?.none)
                ForEach(ConsultationsBrowseInput.Status.allCases, id: \.self) { status in
                    Text(ConsultationStatusText.label(status)).tag(Optional(status))
                }
            }
        } label: {
            Image(systemName: "line.3.horizontal.decrease")
                .symbolVariant(selected == nil ? .none : .circle.fill)
        }
        .accessibilityLabel(L10n.Consultations.filterStatus)
        .accessibilityValue(selected.map(ConsultationStatusText.label) ?? L10n.Consultations.allTab)
        .sensoryFeedback(.selection, trigger: selected)
    }
}

// MARK: - Post

/// One case as a feed card: category, status and "…" on the first row, the
/// title across the full width, optional media, then the action row.
private struct ConsultationPost: View {
    let item: ConsultationsBrowseOutput.Item
    let open: () -> Void
    let more: () -> Void
    let support: () -> Void
    @Environment(\.palette) private var palette

    var body: some View {
        let photos = (item.photos ?? []).map(PostPhoto.init)
        let glyph = CategoryGlyph.style(item.categoryIcon, hex: item.categoryColor)
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 6) {
                    Image(systemName: glyph.symbol)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(glyph.color)
                        .frame(width: 20, height: 20)
                        .accessibilityHidden(true)
                    Text(item.categoryName)
                        .font(.footnote)
                        .foregroundStyle(palette.textSecondary)
                        .lineLimit(1)
                    Text(verbatim: "·").font(.footnote).foregroundStyle(palette.textTertiary)
                    Text(CompactTime.since(item.createdAt.date))
                        .font(.footnote)
                        .foregroundStyle(palette.textSecondary)
                        .lineLimit(1)
                        .layoutPriority(1)
                    Spacer(minLength: 8)
                    StatusPill(status: item.statusValue, neutral: true)
                        .layoutPriority(2)
                    MoreButton(action: more)
                }
                .padding(.trailing, -10)
                Text(item.title)
                    .font(.headline)
                    .lineSpacing(2)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 2)
            }
            .padding(.horizontal, PostMetrics.inset)
            .contentShape(Rectangle())
            .onTapGesture(perform: open)
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isButton)
            .accessibilityAction(.default, open)

            if !photos.isEmpty {
                PostMedia(photos: photos, leadingInset: PostMetrics.inset)
                    .padding(.top, 10)
            }

            PostActions(supported: item.supported, support: support, reply: open, shareURL: shareURL(item.slug), shareTitle: item.title, supportCount: Int(item.supportCount))
                .padding(.horizontal, PostMetrics.inset - 11)
                .padding(.top, 4)
        }
        .padding(.top, 8)
        .padding(.bottom, 6)
        .overlay(alignment: .bottom) {
            Rectangle().fill(palette.hairline).frame(height: 0.5)
        }
    }
}

/// One type size for the whole post (Threads uses 15pt throughout), weight
/// carries the hierarchy. Column math in one place.
enum PostMetrics {
    static let inset: CGFloat = 16
    static let avatar: CGFloat = 40
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
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(.leading, 4)
        .accessibilityLabel(L10n.SafetyUi.menuLabel)
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
    /// Shown beside the heart when above zero; also its accessibility label.
    var supportCount = 0
    /// Shown beside the bubble when above zero, as Threads does.
    var replyCount = 0
    var replyLabel: String = L10n.Consultations.timeline
    /// The feed pushes share to the far edge; the detail keeps it beside reply.
    var spreads = true
    @Environment(\.palette) private var palette
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: 0) {
            Button(action: support) {
                HStack(spacing: 2) {
                    Image(systemName: supported ? "heart.fill" : "heart")
                        .foregroundStyle(supported ? RutaHighlight.support : palette.textSecondary)
                        .symbolEffect(.bounce, value: reduceMotion ? false : supported)
                        .contentTransition(reduceMotion ? .identity : .symbolEffect(.replace))
                        .font(.system(size: 19, weight: .regular))
                    if supportCount > 0 {
                        Text(verbatim: "\(supportCount)")
                            .font(.subheadline)
                            .foregroundStyle(palette.textSecondary)
                            .contentTransition(reduceMotion ? .identity : .numericText())
                            .animation(reduceMotion ? nil : .snappy, value: supportCount)
                    }
                }
                .frame(minWidth: 44, minHeight: 44)
                .padding(.trailing, supportCount > 0 ? 8 : 0)
                .contentShape(Rectangle())
            }
            .sensoryFeedback(.impact(weight: .light), trigger: supported)
            .accessibilityLabel(supportCount > 0 ? L10n.Consultations.supports(count: supportCount) : (supported ? L10n.Consultations.supported : L10n.Consultations.support))
            .accessibilityAddTraits(supported ? .isSelected : [])

            if showsReply {
                Button(action: reply) {
                    HStack(spacing: 2) {
                        Image(systemName: "bubble")
                            .font(.system(size: 19, weight: .regular))
                        if replyCount > 0 {
                            Text(verbatim: "\(replyCount)")
                                .font(.subheadline)
                                .contentTransition(reduceMotion ? .identity : .numericText())
                                .animation(reduceMotion ? nil : .snappy, value: replyCount)
                        }
                    }
                    .frame(minWidth: 44, minHeight: 44)
                    .padding(.trailing, replyCount > 0 ? 8 : 0)
                    .contentShape(Rectangle())
                }
                .accessibilityLabel(replyLabel)
                .accessibilityValue(replyCount > 0 ? "\(replyCount)" : "")
            }

            if showsReply && spreads { Spacer(minLength: 0) }
            ShareLink(item: shareURL, subject: Text(shareTitle)) {
                Image(systemName: "paperplane").postIcon()
            }
            .accessibilityLabel(L10n.Common.share)
        }
        .buttonStyle(.plain)
        .foregroundStyle(palette.textSecondary)
    }
}

private extension View {
    func postIcon() -> some View {
        font(.system(size: 19, weight: .regular))
            .frame(width: 44, height: 44)
            .contentShape(Rectangle())
    }
}

/// Threads' terse age ("5 min", "3 h", "2 sem"), in the system's locale.
enum CompactTime {
    private static let formatter: DateComponentsFormatter = {
        let f = DateComponentsFormatter()
        f.unitsStyle = .short
        f.maximumUnitCount = 1
        f.allowedUnits = [.minute, .hour, .day, .weekOfMonth, .month, .year]
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
    /// Neutral tonal fill and label colour; the icon and word still carry the state.
    var neutral = false
    @Environment(\.palette) private var palette

    var body: some View {
        let (ink, symbol) = style
        HStack(spacing: 4) {
            Image(systemName: symbol).font(.caption2.weight(.bold))
            Text(ConsultationStatusText.label(status))
        }
        .font((neutral ? Font.footnote : .caption).weight(.semibold))
        .foregroundStyle(neutral ? palette.text : ink)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(neutral ? palette.raised : ink.opacity(0.1), in: Capsule())
        .fixedSize(horizontal: false, vertical: true)
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

/// Threads' loading rows: a 40 pt circle and three soft bars shaped like the
/// content that's coming, instead of a spinner.
struct SkeletonFeed: View {
    var count = 5
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(spacing: 0) {
            ForEach(0..<count, id: \.self) { _ in
                HStack(alignment: .top, spacing: 12) {
                    Circle().frame(width: 40, height: 40)
                    VStack(alignment: .leading, spacing: 10) {
                        RoundedRectangle(cornerRadius: 6).frame(width: 120, height: 14)
                        RoundedRectangle(cornerRadius: 6).frame(maxWidth: .infinity).frame(height: 14)
                        RoundedRectangle(cornerRadius: 6).frame(width: 200, height: 14)
                    }
                    .padding(.top, 2)
                }
                .foregroundStyle(palette.inset)
                .padding(.horizontal, 16)
                .padding(.vertical, 18)
            }
        }
        .frame(maxWidth: .infinity, alignment: .top)
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
        DebugHook.value("RUTA_DEBUG_SCROLL") == "bottom"
        #else
        false
        #endif
    }
}
