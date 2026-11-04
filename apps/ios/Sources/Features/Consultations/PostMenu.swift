import Observation
import RutaKit
import SwiftUI

@Observable
final class SafetyModel {
    private(set) var state: SafetyUiState
    @ObservationIgnored private let scope: ScreenScope
    @ObservationIgnored let viewModel: SafetyViewModel

    init(graph: AppGraph) {
        scope = ScreenScope(graph: graph)
        viewModel = scope.safety()
        state = viewModel.state.value
    }

    func observe() async { for await next in viewModel.state { state = next } }
    isolated deinit { scope.close() }
}

/// The post's "…" sheet, Threads-style: grouped actions, Report apart and red,
/// then the reasons as a list. Reporting is anonymous; hiding is silent.
struct PostMenu: View {
    let consultationId: String
    let slug: String
    let title: String
    let hidden: () -> Void
    @Environment(\.graph) private var graph
    @Environment(\.dismiss) private var dismiss
    @State private var model: SafetyModel?
    @State private var path: [Step] = []
    @State private var confirmingHide = false

    enum Step: Hashable { case reasons, details }

    /// Just tall enough for the actions; reporting opens it to full height.
    static let height: CGFloat = 248
    @State private var detent: PresentationDetent = .height(PostMenu.height)

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if let model {
                    actions(model)
                        .navigationDestination(for: Step.self) { step in
                            switch step {
                            case .reasons: ReportReasons(model: model, id: consultationId) { path.append(.details) }
                            case .details: ReportDetails(model: model, id: consultationId)
                            }
                        }
                } else {
                    Color.clear
                }
            }
            .toolbarVisibility(path.isEmpty ? .hidden : .visible, for: .navigationBar)
        }
        .presentationDetents([.height(Self.height), .large], selection: $detent)
        .presentationDragIndicator(.visible)
        .onChange(of: path) { _, steps in
            withAnimation(.snappy) { detent = steps.isEmpty ? .height(Self.height) : .large }
        }
        .task {
            guard let graph else { return }
            let model = self.model ?? SafetyModel(graph: graph)
            self.model = model
            await model.observe()
        }
        .onChange(of: model?.state.hidden) { _, done in
            if done == true {
                hidden()
                dismiss()
            }
        }
        .fullScreenCover(isPresented: Binding(
            get: { model?.state.signInRequested ?? false },
            set: { if !$0 { model?.viewModel.signInHandled() } }
        )) { SignInScreen() }
    }

    private func actions(_ model: SafetyModel) -> some View {
        VStack(spacing: 12) {
            MenuGroup {
                ShareLink(item: shareURL(slug), subject: Text(title)) {
                    MenuRow(title: L10n.Common.share, symbol: "square.and.arrow.up")
                }
            }
            MenuGroup {
                Button { confirmingHide = true } label: {
                    MenuRow(title: L10n.Safety.Block.action, symbol: "eye.slash")
                }
                Divider().padding(.leading, 56)
                Button { path.append(.reasons) } label: {
                    MenuRow(title: L10n.Safety.Report.action, symbol: "exclamationmark.bubble", destructive: true)
                }
            }
            if let code = model.state.errorCode {
                Text(SafetyText.error(code)).font(.footnote).foregroundStyle(.red).padding(.horizontal, 4)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .padding(.top, 28)
        .buttonStyle(.plain)
        .alert(L10n.Safety.Block.title, isPresented: $confirmingHide) {
            Button(L10n.Safety.Block.confirm, role: .destructive) { model.viewModel.hideAuthor(consultationId: consultationId) }
            Button(L10n.Common.cancel, role: .cancel) {}
        } message: {
            Text(L10n.Safety.Block.body)
        }
    }
}

private struct ReportReasons: View {
    let model: SafetyModel
    let id: String
    let needsDetails: () -> Void

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 6) {
                    Text(L10n.Safety.Report.reasonLabel).font(.headline)
                    Text(L10n.Safety.Report.subtitle).font(.subheadline).foregroundStyle(.secondary)
                }
                .padding(.vertical, 4)
            }
            Section {
                ForEach(model.viewModel.reasons, id: \.self) { reason in
                    Button {
                        if reason == .other { needsDetails() } else { model.viewModel.report(consultationId: id, reason: reason, details: nil) }
                    } label: {
                        HStack {
                            Text(SafetyText.reason(reason)).foregroundStyle(Color.primary)
                            Spacer()
                            Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary)
                        }
                        .frame(minHeight: 36)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .disabled(model.state.working)
                }
            }
        }
        .navigationTitle(L10n.Safety.Report.title)
        .navigationBarTitleDisplayMode(.inline)
        .overlay { if model.state.reported { ReportSent() } }
    }
}

private struct ReportDetails: View {
    let model: SafetyModel
    let id: String
    @State private var details = ""

    var body: some View {
        Form {
            Section {
                TextField(L10n.Safety.Report.detailsLabel, text: $details, axis: .vertical)
                    .lineLimit(4...8)
                    .onChange(of: details) { _, v in if v.count > 500 { details = String(v.prefix(500)) } }
            } footer: {
                Text(L10n.Safety.Report.detailsHint)
            }
            Section {
                Button(L10n.Safety.Report.submit) {
                    model.viewModel.report(consultationId: id, reason: .other, details: details)
                }
                .disabled(model.state.working)
            }
        }
        .navigationTitle(L10n.Safety.Reasons.other)
        .navigationBarTitleDisplayMode(.inline)
        .overlay { if model.state.reported { ReportSent() } }
    }
}

/// Sent: thank, explain who looks at it, close.
private struct ReportSent: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "checkmark.circle.fill").font(.system(size: 56)).foregroundStyle(palette.success)
            Text(L10n.Safety.Report.sent).font(.title3.weight(.bold))
            Text(L10n.Safety.Report.sentHint).font(.subheadline).foregroundStyle(palette.textSecondary).multilineTextAlignment(.center)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(palette.background)
        .sensoryFeedback(.success, trigger: true)
        .task {
            try? await Task.sleep(for: .seconds(1.8))
            dismiss()
        }
    }
}

private struct MenuGroup<Content: View>: View {
    @ViewBuilder let content: Content
    @Environment(\.palette) private var palette
    var body: some View {
        // A light tint, not a grey slab: it sits on the sheet's glass.
        VStack(spacing: 0) { content }
            .background(Color.primary.opacity(0.06), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

private struct MenuRow: View {
    let title: String
    let symbol: String
    var destructive = false

    var body: some View {
        // Icon first, as in the system's own menus.
        HStack(spacing: 14) {
            Image(systemName: symbol)
                .font(.system(size: 18, weight: .regular))
                .frame(width: 26)
            Text(title).font(.body)
            Spacer()
        }
        .foregroundStyle(destructive ? Color(.systemRed) : Color.primary)
        .padding(.horizontal, 16)
        .frame(minHeight: 54)
        .contentShape(Rectangle())
    }
}

enum SafetyText {
    static func reason(_ r: SafetyReportInput.Reason) -> String {
        switch r {
        case .abuse: L10n.Safety.Reasons.abuse
        case .personalInformation: L10n.Safety.Reasons.personal_information
        case .unsafe: L10n.Safety.Reasons.unsafe
        case .other: L10n.Safety.Reasons.other
        }
    }

    static func error(_ code: String) -> String {
        switch code {
        case "own_content": L10n.Safety.Errors.own_content
        case "no_author": L10n.Safety.Errors.no_author
        case "not_found": L10n.Safety.Errors.not_found
        default: L10n.Safety.Errors.generic
        }
    }
}
