import QuickLook
import RutaKit
import SwiftUI

/// Staff triage away from a desk: the latest weekly report, then one mixed
/// queue of cards, each with two equal buttons. Full admin stays on the web.
struct GestionScreen: View {
    @Environment(\.graph) private var graph
    @State private var model: GestionModel?

    var body: some View {
        Group {
            if let model { Content(model: model) } else { Color.clear }
        }
        .task {
            guard let graph else { return }
            let model = self.model ?? GestionModel(graph: graph)
            self.model = model
            await model.observe()
        }
    }
}

private struct Content: View {
    let model: GestionModel
    @Environment(\.palette) private var palette
    @State private var note = ""
    @State private var preview: URL?
    @State private var downloadFailed = false

    private var state: GestionUiState { model.state }
    private var vm: GestionViewModel { model.viewModel }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                Text(L10n.Gestion.title)
                    .font(.largeTitle.bold())
                    .accessibilityAddTraits(.isHeader)
                    .padding(.horizontal, GestionMetrics.inset)
                    .padding(.top, 12)
                    .padding(.bottom, 16)
                if let report = state.latestReport {
                    ReportRow(report: report, loading: state.pdf == .loading, unavailable: state.pdf == .unavailable || downloadFailed) {
                        downloadFailed = false
                        vm.openReport()
                    }
                    .padding(.horizontal, GestionMetrics.inset)
                    .padding(.bottom, 12)
                }
                switch state.phase {
                case .loading:
                    LoadingStateView().frame(height: 240)
                case .failed:
                    ErrorStateView(error: state.error ?? .unknown) { vm.retry() }
                case .empty:
                    EmptyState(symbol: "checkmark.circle", title: L10n.Gestion.empty).padding(.top, 48)
                case .ready:
                    chips
                    cards
                }
            }
            .padding(.bottom, 16)
        }
        .refreshable {
            vm.refresh()
            try? await Task.sleep(for: .milliseconds(150))
            while model.state.refreshing { try? await Task.sleep(for: .milliseconds(100)) }
        }
        .quickLookPreview($preview)
        .task(id: state.pdfUrl) {
            guard let raw = state.pdfUrl, let url = URL(string: raw) else { return }
            do { preview = try await ReportFile.download(url, name: state.latestReport) } catch { downloadFailed = true }
            vm.pdfHandled()
        }
        .sheet(isPresented: Binding(get: { state.noteFor != nil }, set: { if !$0 { vm.dismissNote() } })) {
            if let request = state.noteFor {
                NoteSheet(request: request, note: $note) { vm.submitNote(note: note); note = "" } cancel: { vm.dismissNote(); note = "" }
            }
        }
        .sheet(isPresented: Binding(
            get: { if case .none = onEnum(of: model.stepUp) { false } else { true } },
            set: { if !$0 { model.debugStepUp = nil; vm.dismissStepUp() } }
        )) {
            StepUpSheet(
                state: model.stepUp,
                verify: { code in
                    if model.debugStepUp != nil { return }
                    vm.verifyStepUp(code: code)
                },
                useRecovery: { recovery in
                    if model.debugStepUp != nil { model.debugStepUp = StepUpStateAsking(recovery: recovery, error: nil) }
                    vm.useRecoveryCode(recovery: recovery)
                },
                dismiss: { model.debugStepUp = nil; vm.dismissStepUp() }
            )
        }
        .alert(L10n.Common.errorTitle, isPresented: Binding(get: { state.error != nil && state.phase != .failed }, set: { if !$0 { vm.errorHandled() } })) {
            Button(L10n.Common.close, role: .cancel) {}
        } message: {
            Text(state.error == .offline ? L10n.Common.offlineBody : L10n.Common.errorBody)
        }
        .sensoryFeedback(.success, trigger: state.total) { old, new in new < old }
        .task { debugDrive() }
    }

    private var chips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                FilterChip(symbol: "square.stack.3d.up", tint: .primary, title: "\(L10n.Gestion.all) \(state.total)", selected: state.filter == nil) {
                    vm.select(kind: nil)
                }
                ForEach(state.filters, id: \.kind) { entry in
                    FilterChip(symbol: entry.kind.symbol, tint: .primary, title: "\(entry.kind.title) \(entry.count)", selected: state.filter == entry.kind) {
                        vm.select(kind: entry.kind)
                    }
                }
            }
            .padding(.horizontal, GestionMetrics.inset)
        }
        .padding(.bottom, 8)
    }

    private var cards: some View {
        LazyVStack(spacing: 12) {
            ForEach(state.visibleItems, id: \.id) { item in
                ReviewCard(item: item, busy: state.inFlight.contains(item.id)) { verdict in
                    vm.decide(item: item, verdict: verdict)
                }
            }
        }
        .padding(.horizontal, GestionMetrics.inset)
    }

    /// Debug-only: `SIMCTL_CHILD_RUTA_DEBUG_GESTION=approve|reject` decides the first card of
    /// `RUTA_DEBUG_GESTION_KIND` (a `ReviewKind` name); `report` opens the weekly PDF. Decides the first card of that kind once the list loads; a reject adds a fixed note.
    private func debugDrive() {
        #if DEBUG
        Task {
            let env = ProcessInfo.processInfo.environment
            if env["RUTA_DEBUG_GESTION"] == "report" {
                for _ in 0..<50 where model.state.latestReport == nil { try? await Task.sleep(for: .milliseconds(200)) }
                vm.openReport()
                return
            }
            guard let action = env["RUTA_DEBUG_GESTION"], let kindName = env["RUTA_DEBUG_GESTION_KIND"] else { return }
            for _ in 0..<50 where model.state.items.isEmpty { try? await Task.sleep(for: .milliseconds(200)) }
            guard let item = model.state.items.first(where: { "\($0.kind)".lowercased() == kindName.lowercased() }) else { return }
            if action == "approve" { vm.decide(item: item, verdict: .approve) } else {
                vm.decide(item: item, verdict: .reject)
                try? await Task.sleep(for: .milliseconds(600))
                if let text = env["RUTA_DEBUG_GESTION_NOTE"] { note = text }
                try? await Task.sleep(for: .milliseconds(1500))
                if env["RUTA_DEBUG_GESTION_SEND"] == "1" { vm.submitNote(note: note); note = "" }
            }
        }
        #endif
    }
}

enum GestionMetrics { static let inset: CGFloat = 20 }

// MARK: - Weekly report

private struct ReportRow: View {
    let report: ReportsListItem
    let loading: Bool
    let unavailable: Bool
    let open: () -> Void
    @Environment(\.palette) private var palette
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Button(action: open) {
                HStack(spacing: 12) {
                    Image(systemName: "doc.richtext")
                        .font(.system(size: 20))
                        .frame(width: 30)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(L10n.Gestion.weekly).font(.subheadline.weight(.semibold))
                        Text("\(report.municipalityName) · \(period)")
                            .font(.footnote)
                            .foregroundStyle(palette.textSecondary)
                    }
                    Spacer(minLength: 8)
                    if loading { ProgressView() } else {
                        Image(systemName: "arrow.up.right.square")
                            .foregroundStyle(palette.textTertiary)
                            .accessibilityHidden(true)
                    }
                }
                .padding(.horizontal, 16)
                .frame(minHeight: 56)
                .background(palette.raised(scheme), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(loading)
            if unavailable {
                Text(L10n.Gestion.weeklyUnavailable).font(.footnote).foregroundStyle(palette.dangerInk)
            }
        }
    }

    private var period: String {
        (report.periodStart.date..<report.periodEnd.date).formatted(.interval.day().month(.abbreviated).locale(Locale(identifier: "es_DO")))
    }
}

/// Downloads the signed PDF to a named temp file so QuickLook titles and shares it properly.
private enum ReportFile {
    static func download(_ url: URL, name report: ReportsListItem?) async throws -> URL {
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

// MARK: - Cards

private struct ReviewCard: View {
    let item: ReviewItem
    let busy: Bool
    let decide: (Verdict) -> Void
    @Environment(\.palette) private var palette
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label(item.kind.title, systemImage: item.kind.symbol)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(palette.textSecondary)
            VStack(alignment: .leading, spacing: 3) {
                Text(item.title).font(.headline)
                Text("\(item.municipality) · \(CompactTime.since(item.createdAt.date))")
                    .font(.footnote)
                    .foregroundStyle(palette.textSecondary)
            }
            if let image = item.imageUrl.flatMap(URL.init(string:)) {
                AsyncImage(url: image) { phase in
                    switch phase {
                    case .success(let picture): picture.resizable().aspectRatio(contentMode: .fill)
                    default: Rectangle().fill(palette.inset)
                    }
                }
                .frame(height: 140)
                .frame(maxWidth: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .accessibilityHidden(true)
            }
            if let snippet = item.snippet, !snippet.isEmpty {
                Text(snippet).font(.subheadline).lineLimit(3)
            }
            HStack(spacing: 12) {
                Button { decide(.reject) } label: {
                    Text(item.kind.reject.title).font(.subheadline.weight(.semibold)).frame(maxWidth: .infinity, minHeight: 48)
                }
                .buttonStyle(.glass)
                Button { decide(.approve) } label: {
                    Text(item.kind.approve.title).font(.subheadline.weight(.semibold)).frame(maxWidth: .infinity, minHeight: 48)
                }
                .buttonStyle(RutaProminentStyle())
            }
            .disabled(busy)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(palette.raised(scheme), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .accessibilityElement(children: .contain)
    }
}

// MARK: - Reason sheet

private struct NoteSheet: View {
    let request: NoteRequest
    @Binding var note: String
    let send: () -> Void
    let cancel: () -> Void
    @Environment(\.palette) private var palette
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top) {
                Text(L10n.Gestion.noteTitle).font(.title2.bold()).accessibilityAddTraits(.isHeader)
                Spacer()
                CloseButton(action: cancel)
            }
            Text(request.item.title).font(.subheadline).foregroundStyle(palette.textSecondary).lineLimit(2)
            TextField(L10n.Gestion.noteHint, text: $note, axis: .vertical)
                .lineLimit(3...6)
                .focused($focused)
                .padding(16)
                .background(palette.inset, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            if request.tooShort {
                Label(L10n.Gestion.noteTooShort, systemImage: "exclamationmark.circle.fill")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(palette.dangerInk)
            }
            Button(action: send) {
                Text(request.item.kind.spec(verdict: request.verdict).title).font(.headline).frame(maxWidth: .infinity, minHeight: 52)
            }
            .buttonStyle(RutaProminentStyle())
            Spacer(minLength: 0)
        }
        .padding(24)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.hidden)
        .onAppear { focused = true }
    }
}
