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
                Button {
                    downloadFailed = false
                    vm.openReport()
                } label: {
                    HStack(spacing: 14) {
                        Image(systemName: "doc.text").font(.system(size: 18, weight: .light)).foregroundStyle(Color.onInk)
                            .frame(width: 44, height: 44).background(Color.action, in: Circle())
                        VStack(alignment: .leading, spacing: 2) {
                            Text(L10n.Gestion.weekly).type(.bodyStrong)
                            Text("\(report.municipalityName) · \(period(report))").type(.callout, .ink3)
                            if state.pdf == .unavailable || downloadFailed { Text(L10n.Gestion.weeklyUnavailable).type(.caption, .danger) }
                        }
                        Spacer(minLength: 8)
                        if state.pdf == .loading { ProgressView() } else {
                            Image(systemName: "arrow.up.right").font(.system(size: 13, weight: .medium)).foregroundStyle(Color.ink3)
                        }
                    }
                    .padding(14)
                    .background(Color.paper2, in: RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
                }
                .buttonStyle(Pressable(scale: 0.99))
                .disabled(state.pdf == .loading)
            }

            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    Chip(title: "\(L10n.Gestion.all) · \(state.total)", selected: state.filter == nil) { vm.select(kind: nil) }
                    ForEach(state.filters, id: \.kind) { entry in
                        Chip(title: "\(catalogue(entry.kind.labelKey)) · \(entry.count)", selected: state.filter == entry.kind) { vm.select(kind: entry.kind) }
                    }
                }
                .padding(.horizontal, Metrics.gutter)
            }
            .scrollIndicators(.hidden)
            .padding(.horizontal, -Metrics.gutter)

            switch state.phase {
            case .loading: LoadingDots().frame(height: 260)
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
        .quickLookPreview($preview)
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

/// One thing to decide: what it is, what it says, and the buttons its state allows.
private struct ReviewCard: View {
    let item: ReviewItem
    let busy: Bool
    let act: (ReviewAction) -> Void

    private var primary: ReviewAction? { item.actions.first { $0.emphasis == .primary } }
    private var secondary: [ReviewAction] { item.actions.filter { $0.emphasis == .secondary } }
    private var photos: [String] {
        if let consultation = item as? ReviewItemConsultation, !consultation.photoUrls.isEmpty { return consultation.photoUrls }
        return item.imageUrl.map { [$0] } ?? []
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: Glyph.symbol(item.kind.icon)).font(.system(size: 12))
                Text("\(catalogue(item.kind.labelKey)) · \(item.municipality) · \(CompactTime.since(item.createdAt.date))")
                Spacer(minLength: 4)
                if let key = item.stateKey { StatusTag(text: catalogue(key), color: .warning) }
            }
            .type(.caption, .ink3)

            Text(item.title).type(.heading)
            if let snippet = item.snippet, !snippet.isEmpty { Text(snippet).type(.body, .ink2).lineSpacing(2) }
            if !photos.isEmpty {
                PhotoStrip(urls: photos, height: 150).padding(.horizontal, -(Metrics.gutter + 16))
            }

            HStack(spacing: 8) {
                Spacer(minLength: 0)
                if busy { ProgressView().padding(.trailing, 6) }
                ForEach(secondary, id: \.labelKey) { action in
                    Button(catalogue(action.labelKey)) { act(action) }.buttonStyle(.pill(.outline, compact: true, fill: false))
                }
                if let primary {
                    Button(catalogue(primary.labelKey)) { act(primary) }.buttonStyle(.pill(.ink, compact: true, fill: false))
                }
            }
            .disabled(busy)
            .padding(.top, 4)
        }
        .padding(16)
        .background(Color.card, in: RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous).strokeBorder(Color.line, lineWidth: 1))
        .opacity(busy ? 0.6 : 1)
    }
}
