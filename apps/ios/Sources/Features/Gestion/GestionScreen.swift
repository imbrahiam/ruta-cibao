import QuickLook
import RutaKit
import SwiftUI

/// Staff triage away from a desk: the latest weekly report, then one mixed
/// queue of cards whose buttons come from each item's state. Full admin stays on the web.
struct GestionScreen: View {
    var linkedReportId: String? = nil
    var openConsultation: (String) -> Void = { _ in }
    @Environment(\.graph) private var graph
    @State private var model: GestionModel?

    var body: some View {
        Group {
            if let model { Content(model: model, openConsultation: openConsultation) } else { Color.clear }
        }
        .task {
            guard let graph else { return }
            let model = self.model ?? GestionModel(graph: graph)
            self.model = model
            if let linkedReportId { model.viewModel.openLinkedReport(reportId: linkedReportId) }
            await model.observe()
        }
    }
}

private struct Content: View {
    let model: GestionModel
    let openConsultation: (String) -> Void
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
                ReviewCard(item: item, busy: state.inFlight.contains(item.id)) { action in
                    switch onEnum(of: action) {
                    case .decide(let decide): vm.decide(item: item, action: decide)
                    case .openThread(let thread): openConsultation(thread.slug)
                    }
                }
            }
        }
        .padding(.horizontal, GestionMetrics.inset)
    }

    /// Debug-only: `SIMCTL_CHILD_RUTA_DEBUG_GESTION=approve|reject|remove|respond` acts on the first card of
    /// `RUTA_DEBUG_GESTION_KIND` (a `ReviewKind` name) once the list loads; a decision that needs a note adds a
    /// fixed one. `respond` triggers the open-thread action; `report` opens the weekly PDF.
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
            let wanted: Verdict? = switch action { case "approve": .approve; case "reject": .reject; case "remove": .remove; default: nil }
            if action == "respond" {
                if let thread = item.actions.compactMap({ $0 as? ReviewActionOpenThread }).first { openConsultation(thread.slug) }
                return
            }
            guard let wanted, let decide = item.actions.compactMap({ $0 as? ReviewActionDecide }).first(where: { $0.verdict == wanted }) else { return }
            vm.decide(item: item, action: decide)
            if decide.needsNote {
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
    let act: (ReviewAction) -> Void
    @Environment(\.palette) private var palette
    @Environment(\.colorScheme) private var scheme

    private var primary: ReviewAction? { item.actions.first { $0.emphasis == .primary } }
    private var secondary: [ReviewAction] { item.actions.filter { $0.emphasis == .secondary } }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Label(item.kind.title, systemImage: item.kind.symbol)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(palette.textSecondary)
                Spacer(minLength: 8)
                if let key = item.stateKey {
                    Text(catalogue(key))
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(palette.textSecondary)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(palette.inset, in: Capsule())
                }
            }
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
            if let consultation = item as? ReviewItemConsultation {
                ForEach(Array(consultation.photoUrls.enumerated()), id: \.offset) { index, value in
                    AsyncImage(url: URL(string: value)) { phase in
                        switch phase {
                        case .success(let picture): picture.resizable().aspectRatio(contentMode: .fit)
                        default: Rectangle().fill(palette.inset)
                        }
                    }
                    .frame(height: 240)
                    .frame(maxWidth: .infinity)
                    .accessibilityLabel(L10n.Contribute.Photos.photoLabel(n: index + 1))
                }
            }
            if let snippet = item.snippet, !snippet.isEmpty {
                Text(snippet).font(.subheadline).lineLimit(3)
            }
            actions.disabled(busy)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(palette.raised(scheme), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .accessibilityElement(children: .contain)
    }

    /// One secondary sits beside the primary. More than one drops under it, so the primary stays dominant.
    @ViewBuilder private var actions: some View {
        if secondary.count <= 1 {
            HStack(spacing: 12) {
                ForEach(secondary, id: \.labelKey) { button($0, prominent: false) }
                if let primary { button(primary, prominent: true) }
            }
        } else {
            VStack(spacing: 8) {
                if let primary { button(primary, prominent: true) }
                HStack(spacing: 8) {
                    ForEach(secondary, id: \.labelKey) { button($0, prominent: false) }
                }
            }
        }
    }

    @ViewBuilder private func button(_ action: ReviewAction, prominent: Bool) -> some View {
        let label = Text(catalogue(action.labelKey)).font(.subheadline.weight(.semibold)).frame(maxWidth: .infinity, minHeight: 48)
        if prominent {
            Button { act(action) } label: { label }.buttonStyle(RutaProminentStyle())
        } else {
            Button { act(action) } label: { label }.buttonStyle(.glass)
        }
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
                Text(catalogue(request.action.labelKey)).font(.headline).frame(maxWidth: .infinity, minHeight: 52)
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
