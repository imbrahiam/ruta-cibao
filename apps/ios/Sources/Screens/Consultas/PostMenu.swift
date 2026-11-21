import RutaKit
import SwiftUI

/// The overflow of a post: share it, stop seeing its author, or report it.
struct PostMenu: View {
    let consultationId: String
    let slug: String
    let title: String
    let hidden: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Host(make: { $0.safety() }, flow: { $0.state }) { model in
            Sheet(model: model, consultationId: consultationId, slug: slug, title: title, close: { dismiss() })
                .onChange(of: model.state.hidden) { _, done in if done { hidden(); dismiss() } }
                .fullScreenCover(isPresented: Binding(get: { model.state.signInRequested }, set: { if !$0 { model.vm.signInHandled() } })) { SignInScreen() }
        }
        .paperBackground()
        .presentationDetents([.height(240), .large])
        .presentationCornerRadius(Metrics.radiusPanel)
    }
}

private struct Sheet: View {
    let model: Screen<SafetyViewModel, SafetyUiState>
    let consultationId: String
    let slug: String
    let title: String
    let close: () -> Void
    @State private var step = Step.menu
    @State private var details = ""
    @State private var confirmingHide = false

    private enum Step { case menu, reasons, details }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SheetBar(title: step == .menu ? "" : L10n.Safety.Report.title, close: close)
            if model.state.reported {
                StateView(symbol: "checkmark.circle", title: L10n.Safety.Report.sent, message: L10n.Safety.Report.sentHint, actionTitle: L10n.Common.done, action: close)
            } else {
                switch step {
                case .menu: menu
                case .reasons: reasons
                case .details: detailsForm
                }
            }
            Spacer(minLength: 0)
        }
        .animation(Motion.settle, value: step)
        .animation(Motion.settle, value: model.state.reported)
        .sensoryFeedback(.success, trigger: model.state.reported)
        .alert(L10n.Safety.Block.title, isPresented: $confirmingHide) {
            Button(L10n.Safety.Block.confirm, role: .destructive) { model.vm.hideAuthor(consultationId: consultationId) }
            Button(L10n.Common.cancel, role: .cancel) {}
        } message: { Text(L10n.Safety.Block.body) }
    }

    private var menu: some View {
        VStack(spacing: 0) {
            ShareLink(item: shareURL(slug), subject: Text(title)) { MenuRow(title: L10n.Common.share, symbol: "square.and.arrow.up") }
                .buttonStyle(RowPress())
            Button { confirmingHide = true } label: { MenuRow(title: L10n.Safety.Block.action, symbol: "eye.slash") }.buttonStyle(RowPress())
            Button { step = .reasons } label: { MenuRow(title: L10n.Safety.Report.action, symbol: "flag", danger: true) }.buttonStyle(RowPress())
            if let code = model.state.errorCode {
                Label(errorText(code), systemImage: "exclamationmark.circle").type(.callout, .danger).padding(20)
            }
        }
    }

    private var reasons: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(L10n.Safety.Report.subtitle).type(.callout, .ink3).padding(.horizontal, 20).padding(.bottom, 8)
            ForEach(model.vm.reasons, id: \.self) { reason in
                Button {
                    if reason == .other { step = .details } else { model.vm.report(consultationId: consultationId, reason: reason, details: nil) }
                } label: {
                    HStack {
                        Text(reason.label).type(.body)
                        Spacer()
                        Image(systemName: "chevron.right").font(.system(size: 12, weight: .medium)).foregroundStyle(Color.ink4)
                    }
                    .padding(.horizontal, 20)
                    .frame(minHeight: 54)
                }
                .buttonStyle(RowPress())
                .disabled(model.state.working)
            }
        }
    }

    private var detailsForm: some View {
        VStack(alignment: .leading, spacing: 12) {
            Field(placeholder: L10n.Safety.Report.detailsLabel, text: $details, lines: 3...6)
            Text(L10n.Safety.Report.detailsHint).type(.caption, .ink3)
            Button(L10n.Safety.Report.submit) { model.vm.report(consultationId: consultationId, reason: .other, details: details) }
                .buttonStyle(.ink)
                .disabled(model.state.working || details.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
        .padding(.horizontal, 20)
    }

    private func errorText(_ code: String) -> String {
        switch code {
        case "own_content": L10n.Safety.Errors.own_content
        case "no_author": L10n.Safety.Errors.no_author
        case "not_found": L10n.Safety.Errors.not_found
        default: L10n.Safety.Errors.generic
        }
    }
}

private struct MenuRow: View {
    let title: String
    let symbol: String
    var danger = false

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: symbol).font(.system(size: 17)).frame(width: 26)
            Text(title).type(.body, danger ? .danger : .ink)
            Spacer()
        }
        .foregroundStyle(danger ? Color.danger : Color.ink)
        .padding(.horizontal, 20)
        .frame(minHeight: 56)
    }
}
