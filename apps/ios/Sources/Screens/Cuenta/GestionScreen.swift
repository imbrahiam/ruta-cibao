import QuickLook
import RutaKit
import SwiftUI

func catalogue(_ key: String) -> String { NSLocalizedString(key, comment: "") }

/// The staff desk in a pocket: this week's report, then everything waiting for a decision.
struct GestionScreen: View {
    let openConsultation: (String) -> Void

    var body: some View {
        Host(make: { $0.gestion() }, flow: { $0.state }) { model in
            Desk(model: model, openConsultation: openConsultation)
        }
        .paperBackground()
    }
}

private struct Desk: View {
    let model: Screen<GestionViewModel, GestionUiState>
    let openConsultation: (String) -> Void
    @State private var preview: URL?
    @State private var downloadFailed = false
    @State private var note = ""

    private var state: GestionUiState { model.state }
    private var vm: GestionViewModel { model.vm }

    var body: some View {
        Page(title: L10n.Gestion.title) {
            if let report = state.latestReport {
                NavigationLink {
                    WeeklyReportPage(report: report, preparing: state.pdf == .loading, unavailable: state.pdf == .unavailable || downloadFailed) {
                        downloadFailed = false
                        vm.openReport()
                    }
                    // The PDF opens over the report, where it was asked for.
                    .quickLookPreview($preview)
                } label: {
                    HStack(spacing: 14) {
                        Image(systemName: "chart.bar.doc.horizontal").font(.system(size: 18, weight: .light)).foregroundStyle(Color.onInk)
                            .frame(width: 44, height: 44).background(Color.action, in: Circle())
                        VStack(alignment: .leading, spacing: 2) {
                            Text(L10n.Gestion.weekly).type(.bodyStrong)
                            Text("\(report.municipalityName) · \(period(report))").type(.callout, .ink3)
                        }
                        Spacer(minLength: 8)
                        Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Color.ink4)
                    }
                    .padding(14)
                    .background(Color.paper2, in: RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
                }
                .buttonStyle(Pressable(scale: 0.99))
            }

            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    Chip(title: L10n.Gestion.all, selected: state.filter == nil, badge: Int(state.total)) { vm.select(kind: nil) }
                    ForEach(state.filters, id: \.kind) { entry in
                        Chip(title: catalogue(entry.kind.labelKey), selected: state.filter == entry.kind, badge: Int(entry.count)) { vm.select(kind: entry.kind) }
                    }
                }
                .padding(.horizontal, Metrics.gutter)
            }
            .scrollIndicators(.hidden)
            .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
            .edgeFade()
            .padding(.horizontal, -Metrics.gutter)

            switch state.phase {
            case .loading:
                Skeleton {
                    VStack(spacing: 14) {
                        ForEach(0..<3) { _ in
                            VStack(alignment: .leading, spacing: 10) {
                                HStack {
                                    SkeletonLine(97, lineHeight: 16, barHeight: 10, relativeTo: .caption)
                                    Spacer()
                                    SkeletonLine(34, lineHeight: 16, barHeight: 10, relativeTo: .caption)
                                }
                                VStack(alignment: .leading, spacing: 4) {
                                    SkeletonLine(216, lineHeight: 25, barHeight: 15, relativeTo: .headline)
                                    SkeletonLine(174, lineHeight: 18, barHeight: 11, relativeTo: .callout)
                                }
                                HStack {
                                    SkeletonLine(86, lineHeight: 16, barHeight: 10, relativeTo: .caption)
                                    Spacer()
                                    Capsule().frame(width: 82, height: 34)
                                }
                                .frame(minHeight: 44)
                            }
                            .padding(16)
                            .background(Color.paper2, in: RoundedRectangle(cornerRadius: Metrics.radiusCard))
                        }
                    }
                }
            case .failed: StateView(error: state.error ?? .unknown) { vm.retry() }.frame(height: 320)
            case .empty: StateView(symbol: "checkmark.circle", title: L10n.Gestion.empty).frame(height: 320)
            case .ready:
                ForEach(state.visibleItems, id: \.id) { item in
                    ReviewCard(item: item, busy: state.inFlight.contains(item.id)) { action in
                        switch onEnum(of: action) {
                        case .decide(let decide): vm.decide(item: item, action: decide)
                        case .openThread(let thread): openConsultation(thread.slug)
                        }
                    }
                    .transition(.asymmetric(insertion: .opacity, removal: .opacity.combined(with: .scale(scale: 0.96))))
                }
            }
        }
        .animation(Motion.settle, value: state.visibleItems.map(\.id))
        .refreshable { vm.refresh() }
        .task(id: state.pdfUrl) {
            guard let raw = state.pdfUrl, let url = URL(string: raw) else { return }
            do { preview = try await download(url, report: state.latestReport) } catch { downloadFailed = true }
            vm.pdfHandled()
        }
        .sheet(isPresented: Binding(get: { state.noteFor != nil }, set: { if !$0 { vm.dismissNote() } })) {
            if let request = state.noteFor {
                VStack(alignment: .leading, spacing: 14) {
                    SheetBar(title: L10n.Gestion.noteTitle) { vm.dismissNote() }.padding(.horizontal, -8)
                    Text(request.item.title).type(.callout, .ink3)
                    Field(placeholder: L10n.Gestion.noteHint, text: $note, lines: 3...6)
                    if request.tooShort { Text(L10n.Gestion.noteTooShort).type(.caption, .danger) }
                    Button(catalogue(request.action.labelKey)) { vm.submitNote(note: note) }.buttonStyle(.ink)
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 24)
                .paperBackground()
                .presentationDetents([.height(360)])
                .presentationCornerRadius(Metrics.radiusPanel)
                .onDisappear { note = "" }
            }
        }
        .sheet(isPresented: Binding(get: { state.stepUp.active }, set: { if !$0 { vm.dismissStepUp() } })) {
            StepUpSheet(state: state.stepUp, verify: { vm.verifyStepUp(code: $0) }, useRecovery: { vm.useRecoveryCode(recovery: $0) }, dismiss: { vm.dismissStepUp() })
        }
        .alert(L10n.Common.errorTitle, isPresented: Binding(get: { state.phase == .ready && state.error != nil }, set: { if !$0 { vm.errorHandled() } })) {
            Button(L10n.Common.done) { vm.errorHandled() }
        }
        .sensoryFeedback(.success, trigger: state.total)
    }

    private func period(_ report: ReportsListItem) -> String {
        (report.periodStart.date..<report.periodEnd.date).formatted(.interval.day().month(.abbreviated).locale(Locale(identifier: "es_DO")))
    }

    /// The signed PDF as a named temp file, so QuickLook titles and shares it properly.
    private func download(_ url: URL, report: ReportsListItem?) async throws -> URL {
        let (temp, _) = try await URLSession.shared.download(from: url)
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("informes", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let label = report.map { "\(L10n.Gestion.weekly) \($0.municipalityName)" } ?? L10n.Gestion.weekly
        let target = folder.appendingPathComponent("\(label).pdf")
        try? FileManager.default.removeItem(at: target)
        try FileManager.default.moveItem(at: temp, to: target)
        return target
    }
}

/// An icon and its words with little room between them, for metadata lines.
private struct Tight: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 5) { configuration.icon.font(.system(size: 12)); configuration.title }
    }
}

/// One thing to decide: what it is, what it says, and the buttons its state allows.
private struct ReviewCard: View {
    let item: ReviewItem
    let busy: Bool
    let act: (ReviewAction) -> Void

    private var kindSymbol: String { item.kind == .placeReport ? "pencil.and.list.clipboard" : Glyph.symbol(item.kind.icon) }
    private var primary: ReviewAction? { item.actions.first { $0.emphasis == .primary } }
    private var secondary: [ReviewAction] { item.actions.filter { $0.emphasis == .secondary } }
    private var photos: [String] {
        if let consultation = item as? ReviewItemConsultation, !consultation.photoUrls.isEmpty { return consultation.photoUrls }
        return item.imageUrl.map { [$0] } ?? []
    }

    /// Read in corners: what it is and when across the top, the case in the middle, where it is
    /// and what to do with it across the foot.
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Label(catalogue(item.kind.labelKey), systemImage: kindSymbol)
                    .labelStyle(Tight())
                    .type(.caption, .ink2)
                if let key = item.stateKey { StatusTag(text: catalogue(key), color: .warning, solid: true) }
                Spacer(minLength: 8)
                Text(CompactTime.since(item.createdAt.date)).type(.caption, .ink3)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(item.title).type(.heading).fixedSize(horizontal: false, vertical: true)
                if let snippet = item.snippet, !snippet.isEmpty { Text(snippet).type(.body, .ink2).lineSpacing(2) }
            }
            if !photos.isEmpty {
                // The strip runs to the card's edges and keeps the card's padding at both ends.
                PhotoStrip(urls: photos, height: 132, inset: 16, corner: 12).padding(.horizontal, -16)
            }

            HStack(spacing: 8) {
                Label(item.municipality, systemImage: Glyph.location).labelStyle(Tight()).type(.caption, .ink3).lineLimit(1)
                Spacer(minLength: 8)
                if busy { ProgressView().padding(.trailing, 6) }
                // The way out is quiet text; the one main decision keeps the filled pill.
                ForEach(secondary, id: \.labelKey) { action in
                    Button(catalogue(action.labelKey)) { act(action) }
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.ink2)
                        .padding(.horizontal, 10)
                        .frame(minHeight: 44)
                        .contentShape(Rectangle())
                        .buttonStyle(Pressable())
                }
                if let primary {
                    Button(catalogue(primary.labelKey)) { act(primary) }.buttonStyle(.pill(.ink, compact: true, fill: false))
                }
            }
            .disabled(busy)
        }
        .padding(16)
        .background(Color.paper2, in: RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
        .clipShape(RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
        .opacity(busy ? 0.6 : 1)
    }
}
