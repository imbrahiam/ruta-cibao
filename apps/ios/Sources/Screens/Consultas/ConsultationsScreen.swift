import RutaKit
import SwiftUI

struct ConsultationRoute: Hashable { let slug: String }

/// The public feed of consultations: what neighbours asked and where each one stands.
struct ConsultationsScreen: View {
    @Environment(\.graph) private var graph
    @Environment(DeepLinks.self) private var links
    @State private var path: [ConsultationRoute] = {
        #if DEBUG
        if let slug = DebugHook.value("RUTA_DEBUG_SLUG"), !slug.isEmpty { return [ConsultationRoute(slug: slug)] }
        #endif
        return []
    }()
    @State private var composing = false
    @State private var signingIn = false

    var body: some View {
        NavigationStack(path: $path) {
            Host(make: { $0.consultations() }, flow: { $0.state }) { model in
                Feed(model: model, open: { path.append(ConsultationRoute(slug: $0)) }, compose: compose)
                    .sheet(isPresented: $composing) {
                        NewConsultationScreen { slug in
                            model.vm.refresh()
                            path.append(ConsultationRoute(slug: slug))
                        }
                    }
                    .rootHeader(L10n.Consultations.title) {
                        HeaderFilters {
                            Chip(title: L10n.Consultations.allTab, selected: model.state.status == nil, onBrand: true) { model.vm.selectStatus(status: nil) }
                            ForEach(ConsultationsBrowseInput.Status.allCases, id: \.self) { status in
                                Chip(title: status.label, selected: model.state.status == status, onBrand: true) { model.vm.selectStatus(status: status) }
                            }
                        }
                    }
            }
            .navigationTitle(L10n.Consultations.title)
            .paperBackground()
            .navigationDestination(for: ConsultationRoute.self) { ConsultationDetailScreen(slug: $0.slug) }
        }
        .fullScreenCover(isPresented: $signingIn, onDismiss: {
            if graph?.session.isSignedIn.value == true { composing = true }
        }) { SignInScreen() }
        .onChange(of: links.requestId, initial: true) { _, _ in
            guard case .consultation(let slug) = links.pending else { return }
            links.pending = nil
            path = [ConsultationRoute(slug: slug)]
        }
    }

    private func compose() {
        if graph?.session.isSignedIn.value == true { composing = true } else { signingIn = true }
    }
}

private struct Feed: View {
    let model: Screen<ConsultationsViewModel, ConsultationsUiState>
    let open: (String) -> Void
    let compose: () -> Void
    @State private var menuFor: Consultation?

    private var state: ConsultationsUiState { model.state }

    /// The newest cases that have a picture lead the page, only on the unfiltered feed: under a
    /// state filter they would repeat the list right below.
    private var featured: [Consultation] {
        guard state.status == nil else { return [] }
        return state.items.filter { !($0.photos ?? []).isEmpty }.prefix(6).map { $0 }
    }

    /// The list skips what the carousel already shows.
    private var listed: [Consultation] {
        let shown = Set(featured.map(\.id))
        return state.items.filter { !shown.contains($0.id) }
    }

    private var featuredSkeleton: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionHeader(title: L10n.Explore.highlights)
            ScrollView(.horizontal) {
                Skeleton {
                    HStack(spacing: 14) {
                        ForEach(0..<2) { _ in
                            RoundedRectangle(cornerRadius: FeatureCard.radius)
                                .frame(width: FeatureCard.width, height: FeatureCard.height)
                                .overlay(alignment: .topLeading) {
                                    Capsule().fill(Color.paper2).frame(width: 78, height: 23).padding(12)
                                }
                                .overlay(alignment: .bottomLeading) {
                                    VStack(alignment: .leading, spacing: 4) {
                                        SkeletonLine(150, lineHeight: 25, barHeight: 15, relativeTo: .headline)
                                        SkeletonLine(96, lineHeight: 17, barHeight: 10, relativeTo: .caption)
                                    }
                                    .foregroundStyle(Color.paper2)
                                    .padding(16)
                                }
                        }
                    }
                    .padding(.horizontal, Metrics.gutter)
                }
            }
            .scrollIndicators(.hidden)
        }
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                switch state.phase {
                case .loading:
                    if state.status == nil {
                        featuredSkeleton
                        SectionHeader(title: L10n.Consultations.more)
                    }
                    ConsultationRowSkeleton(count: 4, showsStatus: state.status == nil)
                        .padding(.top, state.status == nil ? 0 : 12)
                case .failed:
                    StateView(error: state.error ?? .unknown) { model.vm.retry() }.frame(height: 360)
                case .empty:
                    StateView(symbol: "bubble.left.and.bubble.right", title: L10n.Consultations.empty, message: L10n.Consultations.emptyBody, actionTitle: L10n.Consultations.new, action: compose)
                        .frame(height: 380)
                case .ready:
                    if !featured.isEmpty {
                        SectionHeader(title: L10n.Explore.highlights)
                        ScrollView(.horizontal) {
                            LazyHStack(alignment: .top, spacing: 14) {
                                ForEach(featured, id: \.id) { item in FeatureCard(item: item) { open(item.slug) } }
                            }
                            .scrollTargetLayout()
                            .padding(.horizontal, Metrics.gutter)
                        }
                        .scrollIndicators(.hidden)
                        .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
                        .scrollTargetBehavior(.viewAligned)
                        .edgeFade()
                    }
                    // Filtered, the chip in the header already names the list.
                    if featured.isEmpty { Color.clear.frame(height: 12) } else { SectionHeader(title: L10n.Consultations.more) }
                    ForEach(Array(listed.enumerated()), id: \.element.id) { index, item in
                        // Filtered by a state, every row has it: saying it again on each is noise.
                        CompactRow(item: item, showsStatus: state.status == nil, open: { open(item.slug) })
                            .contextMenu {
                                ShareLink(item: shareURL(item.slug), subject: Text(item.title)) { Label(L10n.Common.share, systemImage: "square.and.arrow.up") }
                                Button(L10n.Safety.Report.action, systemImage: "flag") { menuFor = item }
                            }
                            .onAppear { if index >= listed.count - 3 { model.vm.loadMore() } }
                    }
                    if state.loadingMore { ConsultationRowSkeleton(count: 1, showsStatus: state.status == nil) }
                }
            }
            .padding(.bottom, 24)
            .readable()
        }
        .refreshable { model.vm.refresh() }
        .sheet(item: $menuFor) { item in
            PostMenu(consultationId: item.id, slug: item.slug, title: item.title) { model.vm.hiddenChanged(consultationId: item.id) }
        }
        .fullScreenCover(isPresented: Binding(get: { state.signInRequested }, set: { if !$0 { model.vm.signInHandled() } })) { SignInScreen() }
    }
}

extension ConsultationsBrowseOutput.Item: @retroactive Identifiable {}

/// A case with a picture, as a large card in the opening carousel.
private struct FeatureCard: View {
    static let width: CGFloat = 264
    static let height: CGFloat = 248
    static let radius: CGFloat = 22

    let item: Consultation
    let open: () -> Void

    var body: some View {
        Button(action: open) {
            // The picture carries the card; its words sit on a scrim at the foot so they read
            // over any photo.
            RemoteImage(url: item.photos?.first?.url ?? "")
                .frame(width: Self.width, height: Self.height)
                .overlay {
                    LinearGradient(stops: [.init(color: .clear, location: 0.42), .init(color: .black.opacity(0.78), location: 1)], startPoint: .top, endPoint: .bottom)
                }
                .overlay(alignment: .bottomLeading) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(item.title).font(.system(size: 19, weight: .semibold)).tracking(-0.3).foregroundStyle(.white).lineLimit(3).multilineTextAlignment(.leading)
                        Text("\(item.categoryName) · \(item.createdAt.relativeText)").font(.system(size: 13.5)).foregroundStyle(.white.opacity(0.86))
                    }
                    .padding(16)
                }
                .overlay(alignment: .topLeading) { StatusBadge(status: item.statusValue, solid: true).padding(12) }
                .clipShape(RoundedRectangle(cornerRadius: Self.radius, style: .continuous))
        }
        .buttonStyle(Pressable(scale: 0.98))
    }
}

/// A case in the list: its picture or category beside its title, where and when, and where it
/// stands. Support is counted on the case itself, not here.
private struct ConsultationRowSkeleton: View {
    let count: Int
    let showsStatus: Bool

    var body: some View {
        Skeleton {
            VStack(spacing: 0) {
                ForEach(0..<count, id: \.self) { _ in
                    HStack(alignment: .top, spacing: 14) {
                        RoundedRectangle(cornerRadius: CompactRow.imageRadius)
                            .frame(width: CompactRow.imageSize, height: CompactRow.imageSize)
                        VStack(alignment: .leading, spacing: 4) {
                            SkeletonLine(178)
                            SkeletonLine(148, lineHeight: 18, barHeight: 11, relativeTo: .callout)
                            if showsStatus { Capsule().frame(width: 72, height: 20).padding(.top, 2) }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(.horizontal, Metrics.gutter)
                    .padding(.vertical, 9)
                }
            }
        }
    }
}

private struct CompactRow: View {
    static let imageSize: CGFloat = 76
    static let imageRadius: CGFloat = 12
    let item: Consultation
    var showsStatus = true
    let open: () -> Void

    var body: some View {
        Button(action: open) {
            HStack(alignment: .top, spacing: 14) {
                Group {
                    if let url = item.photos?.first?.url {
                        RemoteImage(url: url)
                    } else {
                        Color.paper2.overlay {
                            CategoryArtwork(icon: item.categoryIcon, size: 34).foregroundStyle(Color.ink2)
                        }
                    }
                }
                .frame(width: Self.imageSize, height: Self.imageSize)
                .clipShape(RoundedRectangle(cornerRadius: Self.imageRadius, style: .continuous))
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.title).type(.bodyStrong).lineLimit(2).multilineTextAlignment(.leading)
                    // Which ayuntamiento it was raised with matters as much as the topic.
                    Text("\(item.categoryName) · \(item.municipalityName) · \(item.createdAt.relativeText)").type(.callout, .ink3).lineLimit(2)
                    if showsStatus { StatusBadge(status: item.statusValue).padding(.top, 2) }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, Metrics.gutter)
            .padding(.vertical, 9)
            .contentShape(Rectangle())
        }
        .buttonStyle(Pressable(scale: 1))
    }
}

/// A case's standing: a glyph for the step it is at, in that step's colour, beside its word.
struct StatusBadge: View {
    let status: ConsultationsBrowseInput.Status
    var solid = false

    var body: some View {
        StatusTag(text: status.label, color: Self.color(status), symbol: Self.symbol(status), solid: solid)
    }

    static func color(_ status: ConsultationsBrowseInput.Status) -> Color {
        switch status {
        case .open: .ink3
        case .inReview: .warning
        case .answered, .resolved: .success
        case .rejected: .danger
        }
    }

    static func symbol(_ status: ConsultationsBrowseInput.Status) -> String {
        switch status {
        case .open: "tray.and.arrow.down.fill"
        case .inReview: "eye.fill"
        case .answered: "bubble.left.fill"
        case .resolved: "checkmark.circle.fill"
        case .rejected: "xmark.circle.fill"
        }
    }
}

/// Photos side by side, each a rounded frame. One photo takes the width and two share it, so
/// the strip keeps the same margin at both ends; more than two scroll and fade at the edges.
struct PhotoStrip: View {
    let urls: [String]
    var height: CGFloat = 210
    /// The room at each end of the strip: the page's gutter, or a card's padding.
    var inset: CGFloat = Metrics.gutter
    var corner: CGFloat = Metrics.radiusCard
    private let spacing: CGFloat = 8

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: spacing) {
                ForEach(Array(urls.enumerated()), id: \.offset) { index, url in
                    RemoteImage(url: url)
                        .frame(height: height)
                        .containerRelativeFrame(.horizontal) { length, _ in width(in: length) }
                        .clipShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
                        .opensPhotos(urls, at: index)
                }
            }
            .padding(.horizontal, inset)
        }
        .scrollIndicators(.hidden)
        .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
        .scrollDisabled(urls.count <= 2)
        .edgeFade(inset)
    }

    private func width(in length: CGFloat) -> CGFloat {
        switch urls.count {
        case 1: length - inset * 2
        case 2: (length - inset * 2 - spacing) / 2
        default: height * 1.25
        }
    }
}

/// A server image that fades in over paper; a quiet tile while it loads or if it fails.
struct RemoteImage: View {
    let url: String

    var body: some View {
        Color.paper3.overlay {
            AsyncImage(url: AppConfig.url(url), transaction: Transaction(animation: .easeOut(duration: 0.3))) { phase in
                if let image = phase.image {
                    image.resizable().scaledToFill().transition(.opacity)
                } else if phase.error != nil || url.isEmpty {
                    Image(systemName: "photo").font(.system(size: 20, weight: .light)).foregroundStyle(Color.ink4)
                } else {
                    Skeleton { Rectangle() }
                }
            }
        }
        .clipped()
        .accessibilityHidden(true)
    }
}

/// Support, replies, share and the overflow: quiet ink until you act.
struct PostActions: View {
    let supported: Bool
    let supportCount: Int
    let replies: Int
    let slug: String
    let title: String
    let support: () -> Void
    let reply: () -> Void
    var more: (() -> Void)?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: 4) {
            Button(action: support) {
                HStack(spacing: 6) {
                    Image(systemName: supported ? "heart.fill" : "heart")
                        .foregroundStyle(supported ? Color.heart : Color.ink3)
                        .symbolEffect(.bounce, value: supported)
                    if supportCount > 0 {
                        Text("\(supportCount)").contentTransition(.numericText(value: Double(supportCount)))
                    }
                }
                .actionCell()
            }
            .accessibilityLabel(supported ? L10n.Consultations.supported : L10n.Consultations.support)
            .accessibilityValue("\(supportCount)")
            .sensoryFeedback(.impact(weight: .light), trigger: supported)

            Button(action: reply) {
                HStack(spacing: 6) {
                    Image(systemName: "bubble.left")
                    if replies > 0 { Text("\(replies)") }
                }
                .actionCell()
            }
            .accessibilityLabel(L10n.Consultations.responses(count: replies))

            Spacer(minLength: 0)

            ShareLink(item: shareURL(slug), subject: Text(title)) {
                Image(systemName: "square.and.arrow.up").actionCell()
            }
            .accessibilityLabel(L10n.Common.share)

            if let more {
                Button(action: more) { Image(systemName: "ellipsis").actionCell() }
                    .accessibilityLabel(L10n.SafetyUi.menuLabel)
            }
        }
        .font(.system(size: 16, weight: .regular))
        .foregroundStyle(Color.ink3)
        .buttonStyle(Pressable(scale: 0.9))
        .animation(reduceMotion ? nil : Motion.quick, value: supportCount)
    }
}

private extension View {
    func actionCell() -> some View {
        self.type(.callout, .ink3).frame(minWidth: 44, minHeight: 44).contentShape(Rectangle())
    }
}
