import Observation
import RutaKit

/// Mirrors the shared `SignInViewModel`; every rule lives in Kotlin.
@Observable
final class SignInModel {
    private(set) var state: SignInUiState
    @ObservationIgnored private let scope: ScreenScope
    @ObservationIgnored let viewModel: SignInViewModel

    init(graph: AppGraph) {
        scope = ScreenScope(graph: graph)
        viewModel = scope.signIn()
        state = viewModel.state.value
    }

    func observe() async {
        for await next in viewModel.state { state = next }
    }

    isolated deinit { scope.close() }
}

extension SignInError {
    var message: String {
        switch self {
        case .phoneInvalid: L10n.SignIn.phoneInvalid
        case .emailInvalid: L10n.SignIn.emailInvalid
        case .codeInvalid: L10n.SignIn.codeInvalid
        case .codeExpired: L10n.SignIn.codeExpired
        case .tooManyAttempts: L10n.SignIn.tooManyAttempts
        case .rateLimited: L10n.SignIn.rateLimited
        case .sendFailed: L10n.SignIn.sendFailed
        case .offline: L10n.Common.offlineBody
        }
    }
}
