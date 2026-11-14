import RutaKit
import SwiftUI

extension StepUpState {
    /// Whether the staff verification sheet should be up.
    var active: Bool { if case .none = onEnum(of: self) { false } else { true } }
}

/// Staff actions ask for the authenticator code first: one sentence, six boxes.
struct StepUpSheet: View {
    let state: StepUpState
    let verify: (String) -> Void
    let useRecovery: (Bool) -> Void
    let dismiss: () -> Void
    @State private var code = ""
    @State private var recoveryCode = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SheetBar(title: L10n.Gestion.stepUpTitle, close: dismiss).padding(.horizontal, -8)
            switch onEnum(of: state) {
            case .enrollOnWeb:
                Text(L10n.Gestion.enrollOnWeb).type(.body, .ink2).padding(.top, 12)
            case .asking(let asking):
                entry(recovery: asking.recovery, error: asking.error, busy: false)
            case .verifying(let verifying):
                entry(recovery: verifying.recovery, error: nil, busy: true)
            case .none:
                EmptyView()
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 24)
        .paperBackground()
        .presentationDetents([.height(380)])
        .presentationCornerRadius(Metrics.radiusPanel)
    }

    @ViewBuilder private func entry(recovery: Bool, error: StepUpError?, busy: Bool) -> some View {
        Text(L10n.Gestion.stepUpBody).type(.body, .ink2).padding(.top, 8)
        Group {
            if recovery {
                Field(placeholder: L10n.Gestion.recoveryCode, text: $recoveryCode)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .onSubmit { verify(recoveryCode) }
                Button(L10n.Common.`continue`) { verify(recoveryCode) }
                    .buttonStyle(.ink)
                    .disabled(busy || recoveryCode.count < 6)
                    .padding(.top, 12)
            } else {
                CodeBoxes(code: $code, failed: error != nil)
                    .accessibilityLabel(L10n.Gestion.totpCode)
                    .onChange(of: code) { _, next in if next.count == 6 { verify(next) } }
                    .onChange(of: error != nil) { _, failed in if failed { code = "" } }
            }
        }
        .padding(.top, 20)
        .opacity(busy ? 0.5 : 1)

        if let error {
            Label(error == .offline ? L10n.Common.offlineBody : L10n.Gestion.stepUpInvalid, systemImage: "exclamationmark.circle")
                .type(.callout, .danger)
                .padding(.top, 10)
        }
        Button(recovery ? L10n.Gestion.useAuthenticator : L10n.Gestion.useRecovery) {
            code = ""
            recoveryCode = ""
            useRecovery(!recovery)
        }
        .buttonStyle(.pill(.outline, compact: true, fill: false))
        .disabled(busy)
        .padding(.top, 16)
    }
}
