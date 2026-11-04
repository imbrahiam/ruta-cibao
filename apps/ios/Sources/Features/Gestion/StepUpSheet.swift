import RutaKit
import SwiftUI

/// The second-factor prompt for staff actions. Six digits auto-submit; a
/// recovery code has its own field and button. The shared gate replays the
/// action that was held back once the code is accepted.
struct StepUpSheet: View {
    let state: StepUpState
    let verify: (String) -> Void
    let useRecovery: (Bool) -> Void
    let dismiss: () -> Void

    @Environment(\.palette) private var palette
    @State private var code = ""
    @FocusState private var recoveryFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(alignment: .top) {
                Text(L10n.Gestion.stepUpTitle)
                    .font(.title2.bold())
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                CloseButton(action: dismiss)
            }
            switch onEnum(of: state) {
            case .enrollOnWeb:
                Text(L10n.Gestion.enrollOnWeb).foregroundStyle(palette.textSecondary)
            case .asking(let asking):
                entry(recovery: asking.recovery, error: asking.error, busy: false)
            case .verifying(let verifying):
                entry(recovery: verifying.recovery, error: nil, busy: true)
            case .none:
                EmptyView()
            }
            Spacer(minLength: 0)
        }
        .padding(24)
        .presentationDetents([.medium])
        .presentationDragIndicator(.hidden)
        .onChange(of: errorKey) { code = "" }
    }

    private var errorKey: String {
        if case .asking(let asking) = onEnum(of: state), let error = asking.error { return "\(error)" }
        return ""
    }

    @ViewBuilder private func entry(recovery: Bool, error: StepUpError?, busy: Bool) -> some View {
        Text(L10n.Gestion.stepUpBody).foregroundStyle(palette.textSecondary)
        if recovery {
            TextField(L10n.Gestion.recoveryCode, text: $code)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .focused($recoveryFocused)
                .padding(.horizontal, 16)
                .frame(minHeight: 56)
                .background(palette.inset, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .onAppear { recoveryFocused = true }
                .onSubmit { verify(code) }
            Button { verify(code) } label: {
                Text(L10n.Common.continue).font(.headline).frame(maxWidth: .infinity, minHeight: 52)
            }
            .buttonStyle(RutaProminentStyle())
            .disabled(busy || code.count < 6)
        } else {
            CodeField(code: $code, isError: error != nil, isBusy: busy)
                .accessibilityLabel(L10n.Gestion.totpCode)
                .onChange(of: code) { _, next in
                    if next.count == 6 { verify(next) }
                }
        }
        if let error {
            Label(error == .offline ? L10n.Common.offlineBody : L10n.Gestion.stepUpInvalid, systemImage: "exclamationmark.circle.fill")
                .font(.footnote.weight(.medium))
                .foregroundStyle(palette.dangerInk)
        }
        Button(recovery ? L10n.Gestion.useAuthenticator : L10n.Gestion.useRecovery) {
            code = ""
            useRecovery(!recovery)
        }
        .font(.subheadline.weight(.semibold))
        .frame(minHeight: 44)
        .disabled(busy)
    }
}
