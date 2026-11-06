import RutaKit
import SwiftUI

/// Passwordless sign-in, presented full screen. Destination → code → done.
struct SignInScreen: View {
    @Environment(\.graph) private var graph
    @Environment(\.dismiss) private var dismiss
    @State private var model: SignInModel?

    var body: some View {
        Group {
            if let model {
                SignInFlow(model: model, close: { dismiss() })
            } else {
                Color.clear
            }
        }
        .task {
            guard let graph else { return }
            let model = self.model ?? SignInModel(graph: graph)
            self.model = model
            await model.observe()
        }
    }
}

private struct SignInFlow: View {
    let model: SignInModel
    let close: () -> Void
    @Environment(\.palette) private var palette
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var state: SignInUiState { model.state }
    private var vm: SignInViewModel { model.viewModel }

    var body: some View {
        ZStack {
            palette.background.ignoresSafeArea()
            switch state.step {
            case .enter:
                EnterStep(model: model, close: close).transition(stepTransition(forward: false))
            case .verify:
                VerifyStep(model: model).transition(stepTransition(forward: true))
            case .done:
                DoneStep(close: close).transition(.opacity)
            }
        }
        .animation(reduceMotion ? .easeInOut(duration: 0.2) : .spring(duration: 0.45, bounce: 0.12), value: state.step)
        .sensoryFeedback(.success, trigger: state.step == .done)
    }

    private func stepTransition(forward: Bool) -> AnyTransition {
        guard !reduceMotion else { return .opacity }
        return .asymmetric(
            insertion: .move(edge: forward ? .trailing : .leading).combined(with: .opacity),
            removal: .move(edge: forward ? .leading : .trailing).combined(with: .opacity)
        )
    }
}

// MARK: - Destination

private struct EnterStep: View {
    let model: SignInModel
    let close: () -> Void
    @Environment(\.palette) private var palette
    @FocusState private var focused: Bool
    /// Local text so the field always shows the formatted value, even when
    /// formatting leaves the model unchanged (a rejected character).
    @State private var text = ""

    private var state: SignInUiState { model.state }
    private var isPhone: Bool { state.method == .phone }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                VStack(alignment: .leading, spacing: 10) {
                    Text(L10n.SignIn.title)
                        .font(.system(size: 34, weight: .bold))
                        .tracking(-0.6)
                        .accessibilityAddTraits(.isHeader)
                    Text(L10n.SignIn.lede)
                        .font(.body)
                        .foregroundStyle(palette.textSecondary)
                }
                Picker(L10n.SignIn.methodLabel, selection: Binding(
                    get: { state.method },
                    set: { model.viewModel.selectMethod(method: $0); focused = true }
                )) {
                    Text(L10n.SignIn.phone).tag(SignInUiState.Method.phone)
                    Text(L10n.SignIn.email).tag(SignInUiState.Method.email)
                }
                .pickerStyle(.segmented)
                .controlSize(.large)

                field
            }
            .padding(.horizontal, 24)
        }
        .scrollDismissesKeyboard(.interactively)
        .safeAreaInset(edge: .top) {
            ZStack {
                BrandMark(size: 36)
                HStack {
                    CloseButton(label: L10n.SignIn.close, action: close)
                        .padding(.leading, -7)
                    Spacer()
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 8)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            footer.background(palette.background)
        }
        .onAppear { focused = true }
    }

    private var field: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(isPhone ? L10n.SignIn.phoneLabel : L10n.SignIn.emailLabel)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(palette.textSecondary)
            HStack(spacing: 12) {
                if isPhone {
                    Text(verbatim: "🇩🇴 +1")
                        .font(.title3.weight(.semibold).monospacedDigit())
                        .padding(.horizontal, 12)
                        .frame(height: 44)
                        .background(palette.inset, in: Capsule())
                        .accessibilityHidden(true)
                }
                TextField(
                    isPhone ? L10n.SignIn.phonePlaceholder : L10n.SignIn.emailPlaceholder,
                    text: $text
                )
                .onChange(of: text) { _, raw in
                    if isPhone {
                        let formatted = Phone.shared.formatInput(input: raw)
                        if formatted != raw { text = formatted }
                        model.viewModel.updatePhone(input: formatted)
                    } else {
                        model.viewModel.updateEmail(input: raw)
                    }
                }
                .onChange(of: state.method) { text = isPhone ? state.phone : state.email }
                .onAppear { text = isPhone ? state.phone : state.email }
                .font(.system(size: 28, weight: .semibold).monospacedDigit())
                .keyboardType(isPhone ? .phonePad : .emailAddress)
                .textContentType(isPhone ? .telephoneNumber : .emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.send)
                .onSubmit { model.viewModel.submit() }
                .focused($focused)
                .accessibilityLabel(isPhone ? L10n.SignIn.phoneLabel : L10n.SignIn.emailLabel)
            }
            .padding(.vertical, 6)
            Rectangle()
                .fill(state.error != nil ? palette.danger : (focused ? palette.text : palette.separator))
                .frame(height: focused ? 2 : 1)
                .animation(.easeOut(duration: 0.15), value: focused)
            if let error = state.error {
                Label(error.message, systemImage: "exclamationmark.circle.fill")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(palette.dangerInk)
            } else if isPhone {
                Text(L10n.SignIn.phoneHelper)
                    .font(.footnote)
                    .foregroundStyle(palette.textTertiary)
            }
        }
    }

    private var footer: some View {
        VStack(spacing: 12) {
            Button {
                model.viewModel.submit()
            } label: {
                ZStack {
                    Text(L10n.SignIn.sendCode).opacity(state.busy ? 0 : 1)
                    if state.busy { ProgressView().tint(palette.onAccent) }
                }
                .font(.headline)
                .frame(maxWidth: .infinity, minHeight: 52)
            }
            .buttonStyle(RutaProminentStyle())
            .disabled(!state.canSubmit)
            Text(L10n.SignIn.terms)
                .font(.caption)
                .foregroundStyle(palette.textTertiary)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 24)
        .padding(.top, 12)
        .padding(.bottom, 8)
    }
}

// MARK: - Code

private struct VerifyStep: View {
    let model: SignInModel
    @Environment(\.palette) private var palette
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shake: CGFloat = 0

    private var state: SignInUiState { model.state }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                VStack(alignment: .leading, spacing: 10) {
                    Text(L10n.SignIn.verifyTitle)
                        .font(.system(size: 34, weight: .bold))
                        .tracking(-0.6)
                        .accessibilityAddTraits(.isHeader)
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(L10n.SignIn.verifyLede(destination: state.destination))
                            .foregroundStyle(palette.textSecondary)
                        Button(L10n.SignIn.change) { model.viewModel.editDestination() }
                            .font(.body.weight(.semibold))
                            .frame(minHeight: 44)
                    }
                }
                .padding(.top, 72)

                CodeField(
                    code: Binding(get: { state.code }, set: { model.viewModel.updateCode(input: $0) }),
                    isError: state.error != nil,
                    isBusy: state.busy
                )
                .modifier(Shake(animatableData: shake))

                if let error = state.error {
                    Label(error.message, systemImage: "exclamationmark.circle.fill")
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(palette.dangerInk)
                }

                resend
            }
            .padding(.horizontal, 24)
        }
        .sensoryFeedback(.error, trigger: state.failures)
        .onChange(of: state.failures) {
            guard !reduceMotion else { return }
            shake = 0
            withAnimation(.linear(duration: 0.4)) { shake = 1 }
        }
    }

    @ViewBuilder private var resend: some View {
        if state.resendIn > 0 {
            Text(L10n.SignIn.resendIn(seconds: Int(state.resendIn)))
                .font(.subheadline.monospacedDigit())
                .foregroundStyle(palette.textTertiary)
                .contentTransition(.numericText(countsDown: true))
        } else {
            Button(L10n.SignIn.resend) { model.viewModel.resend() }
                .font(.subheadline.weight(.semibold))
                .frame(minHeight: 44)
        }
    }
}

/// Six cells over one hidden field, so iOS can autofill the code from Messages.
struct CodeField: View {
    @Binding var code: String
    var isError: Bool
    var isBusy: Bool
    var length = 6

    @Environment(\.palette) private var palette
    @FocusState private var focused: Bool

    var body: some View {
        ZStack {
            TextField("", text: $code)
                .keyboardType(.numberPad)
                .textContentType(.oneTimeCode)
                .focused($focused)
                .opacity(0.02)
                .accessibilityLabel(L10n.SignIn.codeLabel)
            HStack(spacing: 8) {
                ForEach(0..<length, id: \.self) { index in
                    cell(index)
                }
            }
            .allowsHitTesting(false)
            .accessibilityHidden(true)
        }
        .contentShape(Rectangle())
        .onTapGesture { focused = true }
        .onAppear { focused = true }
        .opacity(isBusy ? 0.5 : 1)
    }

    private func cell(_ index: Int) -> some View {
        let chars = Array(code)
        let digit = index < chars.count ? String(chars[index]) : nil
        let active = focused && index == min(chars.count, length - 1) && digit == nil
        return RoundedRectangle(cornerRadius: 14, style: .continuous)
            .fill(palette.inset)
            .overlay {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(isError ? palette.danger : (active ? palette.text : .clear), lineWidth: 2)
            }
            .overlay {
                if let digit {
                    Text(digit)
                        .font(.system(size: 28, weight: .semibold).monospacedDigit())
                        .transition(.scale(scale: 0.6).combined(with: .opacity))
                } else if active {
                    Caret()
                }
            }
            .frame(height: 60)
            .frame(maxWidth: .infinity)
            .animation(.spring(duration: 0.22, bounce: 0.3), value: digit)
    }
}

private struct Caret: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var visible = true

    var body: some View {
        RoundedRectangle(cornerRadius: 1)
            .frame(width: 2, height: 26)
            .opacity(visible ? 1 : 0)
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.easeInOut(duration: 0.55).repeatForever()) { visible = false }
            }
    }
}

// MARK: - Done

private struct DoneStep: View {
    let close: () -> Void
    @Environment(\.palette) private var palette
    @State private var shown = false

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 72, weight: .semibold))
                .foregroundStyle(palette.success)
                .symbolEffect(.bounce, value: shown)
            Text(L10n.SignIn.welcome)
                .font(.title2.weight(.bold))
        }
        .accessibilityElement(children: .combine)
        .task {
            shown = true
            try? await Task.sleep(for: .milliseconds(900))
            close()
        }
    }
}
