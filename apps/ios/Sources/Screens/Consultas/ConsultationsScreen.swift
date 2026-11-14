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
            }
            .navigationTitle(L10n.Consultations.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button(L10n.Consultations.new, systemImage: "square.and.pencil", action: compose) } }
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

    /// The newest cases that have a picture lead the page.
    private var featured: [Consultation] { state.items.filter { !($0.photos ?? []).isEmpty }.prefix(6).map { $0 } }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                filters
                switch state.phase {
                case .loading:
                    LoadingDots().frame(height: 320)
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
                        .scrollTargetBehavior(.viewAligned)
                    }
                    SectionHeader(title: state.status?.label ?? L10n.Consultations.allTab)
                    ForEach(Array(state.items.enumerated()), id: \.element.id) { index, item in
                        CompactRow(item: item, open: { open(item.slug) }, support: { model.vm.toggleSupport(id: item.id) })
                            .contextMenu {
                                ShareLink(item: shareURL(item.slug), subject: Text(item.title)) { Label(L10n.Common.share, systemImage: "square.and.arrow.up") }
                                Button(L10n.Safety.Report.action, systemImage: "flag") { menuFor = item }
                            }
                            .onAppear { if index >= state.items.count - 3 { model.vm.loadMore() } }
                        Hairline(inset: Metrics.gutter + 86)
                    }
                    if state.loadingMore { LoadingDots().frame(height: 64) }
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

    private var filters: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                Chip(title: L10n.Consultations.allTab, selected: state.status == nil) { model.vm.selectStatus(status: nil) }
                ForEach(ConsultationsBrowseInput.Status.allCases, id: \.self) { status in
                    Chip(title: status.label, selected: state.status == status) { model.vm.selectStatus(status: status) }
                }
            }
            .padding(.horizontal, Metrics.gutter)
        }
        .scrollIndicators(.hidden)
        .padding(.top, 6)
    }
}

extension ConsultationsBrowseOutput.Item: @retroactive Identifiable {}

/// A case with a picture, as a large card in the opening carousel.
private struct FeatureCard: View {
    let item: Consultation
    let open: () -> Void

    var body: some View {
        Button(action: open) {
            VStack(alignment: .leading, spacing: 10) {
                RemoteImage(url: item.photos?.first?.url ?? "")
                    .frame(width: 290, height: 200)
                    .clipShape(RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
                    .overlay(alignment: .topLeading) { StatusBadge(status: item.statusValue).padding(10) }
                VStack(alignment: .leading, spacing: 3) {
                    Text(item.title).type(.heading).lineLimit(2).multilineTextAlignment(.leading)
                    Text("\(item.categoryName) · \(CompactTime.since(item.createdAt.date))").type(.callout, .ink3)
                }
            }
            .frame(width: 290, alignment: .leading)
        }
        .buttonStyle(Pressable(scale: 0.98))
    }
}

/// A case in the list: its picture or category, what it says, where it stands, and support.
private struct CompactRow: View {
    let item: Consultation
    let open: () -> Void
    let support: () -> Void

    var body: some View {
        HStack(spacing: 14) {
            Button(action: open) {
                HStack(spacing: 14) {
                    Group {
                        if let url = item.photos?.first?.url {
                            RemoteImage(url: url)
                        } else {
                            Tint.of(hex: item.categoryColor).fill.overlay {
                                Image(systemName: Glyph.symbol(item.categoryIcon)).font(.system(size: 24, weight: .light)).foregroundStyle(Tint.of(hex: item.categoryColor).ink)
                            }
                        }
                    }
                    .frame(width: 72, height: 72)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    VStack(alignment: .leading, spacing: 4) {
                        Text(item.title).type(.bodyStrong).lineLimit(2).multilineTextAlignment(.leading)
                        Text("\(item.categoryName) · \(CompactTime.since(item.createdAt.date))").type(.callout, .ink3).lineLimit(1)
                        HStack(spacing: 6) {
                            Circle().fill(StatusBadge.color(item.statusValue)).frame(width: 6, height: 6)
                            Text(item.statusValue.label).type(.caption, .ink2)
                        }
                    }
                    Spacer(minLength: 0)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(Pressable(scale: 1))

            Button(action: support) {
                VStack(spacing: 2) {
                    Image(systemName: item.supported ? "heart.fill" : "heart")
                        .font(.system(size: 18))
                        .foregroundStyle(item.supported ? Color.danger : Color.ink3)
                        .symbolEffect(.bounce, value: item.supported)
                    Text("\(item.supportCount)").type(.caption, .ink3).contentTransition(.numericText())
                }
                .frame(width: 44, height: 52)
                .contentShape(Rectangle())
            }
            .buttonStyle(Pressable(scale: 0.9))
            .accessibilityLabel(item.supported ? L10n.Consultations.supported : L10n.Consultations.support)
            .sensoryFeedback(.impact(weight: .light), trigger: item.supported)
        }
        .padding(.horizontal, Metrics.gutter)
        .padding(.vertical, 12)
    }
}

/// A case's standing: a dot in the status colour beside its word.
struct StatusBadge: View {
    let status: ConsultationsBrowseInput.Status

    var body: some View {
        StatusTag(text: status.label, color: Self.color(status))
    }

    static func color(_ status: ConsultationsBrowseInput.Status) -> Color {
        switch status {
        case .open: .ink4
        case .inReview: .warning
        case .answered, .resolved: .success
        case .rejected: .danger
        }
    }
}

/// Photos side by side, each a rounded frame; one photo takes the width.
struct PhotoStrip: View {
    let urls: [String]
    var height: CGFloat = 210
    var open: (() -> Void)?

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(urls, id: \.self) { url in
                    RemoteImage(url: url)
                        .frame(width: urls.count == 1 ? nil : height * 1.25, height: height)
                        .containerRelativeFrame(.horizontal) { length, _ in urls.count == 1 ? length - Metrics.gutter * 2 : height * 1.25 }
                        .clipShape(RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
                        .onTapGesture { open?() }
                }
            }
            .padding(.horizontal, Metrics.gutter)
        }
        .scrollIndicators(.hidden)
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
                } else if phase.error != nil {
                    Image(systemName: "photo").font(.system(size: 20, weight: .light)).foregroundStyle(Color.ink4)
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
                        .foregroundStyle(supported ? Color.danger : Color.ink3)
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
