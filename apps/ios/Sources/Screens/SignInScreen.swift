import RutaKit
import SwiftUI

/// Sign-in by one-time code, phone or email. Two steps on one sheet of paper.
struct SignInScreen: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Host(make: { $0.signIn() }, flow: { $0.state }) { model in
            SignInFlow(model: model, close: { dismiss() })
        }
        .paperBackground()
    }
}

private struct SignInFlow: View {
    let model: Screen<SignInViewModel, SignInUiState>
    let close: () -> Void
    @FocusState private var focus: Focus?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private enum Focus { case contact, code }
    private var state: SignInUiState { model.state }
    private var vm: SignInViewModel { model.vm }

    var body: some View {
        // With the keyboard up the page scrolls rather than squeezing its copy.
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // Going back a step is at the leading edge; leaving is at the trailing one.
                HStack {
                    if state.step == .verify { IconButton(symbol: "chevron.left", label: L10n.SignIn.change, glass: true) { vm.editDestination() } }
                    Spacer()
                    if state.step != .verify { IconButton(symbol: "xmark", label: L10n.Common.close, glass: true) { close() } }
                }
                .padding(.top, 10)

                Mark(size: 44).padding(.top, 28).rise(0)

                Group {
                    if state.step == .verify { verify } else { enter }
                }
                .transition(.asymmetric(
                    insertion: .opacity.combined(with: .offset(x: reduceMotion ? 0 : 24)),
                    removal: .opacity.combined(with: .offset(x: reduceMotion ? 0 : -24))
                ))

                Spacer(minLength: 0)
            }
            .padding(.horizontal, Metrics.gutter)
        }
        .scrollBounceBehavior(.basedOnSize)
        .readable(480)
        .animation(Motion.settle, value: state.step)
        .onChange(of: state.step, initial: true) { _, step in
            switch step {
            case .enter: focus = .contact
            case .verify: focus = .code
            case .done: close()
            }
        }
        .sensoryFeedback(.success, trigger: state.step == .done)
        .sensoryFeedback(.error, trigger: state.failures)
    }

    // MARK: Step 1

    private var enter: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(L10n.SignIn.title).type(.display).padding(.top, 22).rise(1)
            Text(L10n.SignIn.lede).type(.body, .ink2).fixedSize(horizontal: false, vertical: true).padding(.top, 8).rise(2)

            HStack(spacing: 4) {
                ForEach(state.methods, id: \.self) { method in
                    let selected = state.method == method
                    Button { vm.selectMethod(method: method) } label: {
                        Label(
                            method == .email ? L10n.SignIn.email : L10n.SignIn.phone,
                            systemImage: method == .email ? "envelope" : "text.bubble"
                        )
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(selected ? Color.ink : Color.ink2)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background {
                            if selected {
                                Capsule().fill(Color.paper)
                                    .shadow(color: .black.opacity(0.1), radius: 2, y: 1)
                            }
                        }
                        .contentShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .disabled(state.busy || !state.isAvailable(method: method))
                    .accessibilityAddTraits(selected ? .isSelected : [])
                }
            }
            .padding(4)
            .background(Color.paper2, in: Capsule())
            .accessibilityElement(children: .contain)
            .accessibilityLabel(L10n.SignIn.methodLabel)
            .padding(.top, 28)
            .rise(3)

            Group {
                if state.method == .phone {
                    PhoneField(placeholder: L10n.SignIn.phonePlaceholder, text: Binding(get: { state.phone }, set: { vm.updatePhone(input: $0) }))
                } else {
                    Field(placeholder: L10n.SignIn.emailPlaceholder, text: Binding(get: { state.email }, set: { vm.updateEmail(input: $0) }))
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
            }
            .focused($focus, equals: .contact)
            .onSubmit { vm.submit() }
            .padding(.top, 12)
            .rise(4)

            // A wait is about the button, not the address: it shows beside the button, which
            // stays off until the wait is over.
            if state.error != .rateLimited { problem }

            Button { vm.submit() } label: { busyLabel(state.hasSentCode ? L10n.SignIn.useSentCode : L10n.SignIn.sendCode) }
                .buttonStyle(.ink)
                .disabled(!state.canSubmit || state.busy || state.resendIn > 0)
                .padding(.top, 16)
                .rise(5)

            if state.resendIn > 0 {
                Label(waitText(Int(state.resendIn)), systemImage: "clock")
                    .type(.callout, .ink2)
                    .monospacedDigit()
                    .contentTransition(.numericText())
                    .frame(maxWidth: .infinity)
                    .padding(.top, 10)
            } else if state.error == .rateLimited {
                problem
            }

            // Copy never truncates to make room for the keyboard; the page scrolls instead.
            Text(L10n.SignIn.terms).type(.caption, .ink3).fixedSize(horizontal: false, vertical: true).padding(.top, 14).rise(6)
        }
    }

    // MARK: Step 2

    private var verify: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(L10n.SignIn.verifyTitle).type(.display).padding(.top, 22)
            Text(L10n.SignIn.verifyLede(destination: state.destination)).type(.body, .ink2).padding(.top, 8)

            CodeBoxes(code: Binding(get: { state.code }, set: { vm.updateCode(input: $0) }), failed: state.error != nil)
                .focused($focus, equals: .code)
                .padding(.top, 28)
                .onChange(of: state.code) { _, code in if code.count == 6, !state.busy { vm.verify() } }

            problem

            Button { vm.verify() } label: { busyLabel(L10n.SignIn.verify) }
                .buttonStyle(.ink)
                .disabled(state.code.count < 6 || state.busy)
                .padding(.top, 16)

            // While the wait runs it is a readable line, not a greyed-out button.
            Group {
                if state.resendIn > 0 {
                    Text(L10n.SignIn.resendIn(seconds: Int(state.resendIn))).type(.callout, .ink3).monospacedDigit().frame(minHeight: 40)
                } else {
                    Button(L10n.SignIn.resend) { vm.resend() }
                        .buttonStyle(.pill(.outline, compact: true, fill: false))
                        .disabled(state.busy)
                }
            }
            .padding(.top, 14)
        }
    }

    @ViewBuilder private var problem: some View {
        if let error = state.error {
            Label(text(error), systemImage: "exclamationmark.circle")
                .type(.callout, .danger)
                .padding(.top, 10)
                .transition(.opacity.combined(with: .offset(y: -4)))
        }
    }

    /// "Puedes pedir otro código en 24 s", or in minutes once the wait is that long.
    private func waitText(_ seconds: Int) -> String {
        seconds < 60 ? L10n.SignIn.waitSeconds(seconds: seconds) : L10n.SignIn.waitMinutes(minutes: String((seconds + 59) / 60))
    }

    private func busyLabel(_ title: String) -> some View {
        HStack(spacing: 10) {
            if state.busy { ProgressView().tint(.onInk) }
            Text(title)
        }
    }

    private func text(_ error: SignInError) -> String {
        switch error {
        case .phoneInvalid: L10n.SignIn.phoneInvalid
        case .emailInvalid: L10n.SignIn.emailInvalid
        case .codeInvalid: L10n.SignIn.codeInvalid
        case .codeExpired: L10n.SignIn.codeExpired
        case .tooManyAttempts: L10n.SignIn.tooManyAttempts
        case .rateLimited: L10n.SignIn.rateLimited
        case .sendFailed: L10n.SignIn.sendFailed
        case .offline: L10n.Common.offline
        }
    }
}

/// Six cells over one hidden field: each digit lands in its own box, and the row shakes on a wrong code.
struct CodeBoxes: View {
    @Binding var code: String
    let failed: Bool
    @FocusState private var focused: Bool
    @State private var shake = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            TextField("", text: Binding(get: { code }, set: { code = String($0.filter(\.isNumber).prefix(6)) }))
                .keyboardType(.numberPad)
                .textContentType(.oneTimeCode)
                .focused($focused)
                .opacity(0.01)
                .accessibilityLabel(L10n.SignIn.codeLabel)

            HStack(spacing: 8) {
                ForEach(0..<6, id: \.self) { index in
                    let digit = index < code.count ? String(Array(code)[index]) : ""
                    Text(digit)
                        .font(.system(size: 26, weight: .regular).monospacedDigit())
                        .foregroundStyle(Color.ink)
                        .frame(maxWidth: .infinity, minHeight: 60)
                        // The box you are typing into is white with the green outline; the rest rest on the quiet fill.
                        .background(focused && index == min(code.count, 5) ? Color.paper : Color.paper2, in: RoundedRectangle(cornerRadius: Metrics.radiusField, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: Metrics.radiusField, style: .continuous)
                                .strokeBorder(failed ? Color.danger : Color.brand, lineWidth: focused && index == min(code.count, 5) ? 1.5 : 0)
                        }
                        .contentTransition(.numericText())
                        .animation(Motion.quick, value: digit)
                }
            }
            .allowsHitTesting(false)
            .accessibilityHidden(true)
        }
        .contentShape(Rectangle())
        .onTapGesture { focused = true }
        .modifier(Shake(travel: reduceMotion ? 0 : 8, step: CGFloat(shake)))
        .onChange(of: failed) { _, now in if now { withAnimation(.linear(duration: 0.4)) { shake += 1 } } }
    }
}

private struct Shake: GeometryEffect {
    var travel: CGFloat
    var step: CGFloat
    var animatableData: CGFloat {
        get { step }
        set { step = newValue }
    }

    func effectValue(size: CGSize) -> ProjectionTransform {
        ProjectionTransform(CGAffineTransform(translationX: travel * sin(step * .pi * 4), y: 0))
    }
}
