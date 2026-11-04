import Observation
import RutaKit

/// Bridges the shared `ConsultationsViewModel` into Observation. All logic is
/// in Kotlin; this only mirrors its state and owns its lifetime.
@Observable
final class ConsultationsModel {
    private(set) var state: ConsultationsUiState

    @ObservationIgnored private let scope: ScreenScope
    @ObservationIgnored let viewModel: ConsultationsViewModel

    init(graph: AppGraph) {
        scope = ScreenScope(graph: graph)
        viewModel = scope.consultations()
        state = viewModel.state.value
    }

    /// Runs for as long as the view's `.task` does.
    func observe() async {
        for await next in viewModel.state {
            state = next
        }
    }

    isolated deinit {
        scope.close()
    }
}
