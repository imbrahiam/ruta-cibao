import Observation
import RutaKit
import SwiftUI

/// Mirrors the shared `GestionViewModel`. Every rule, the review table and the
/// second-factor replay live in Kotlin; this only mirrors state and owns lifetime.
@Observable
final class GestionModel {
    private(set) var state: GestionUiState
    /// Debug-only: `SIMCTL_CHILD_RUTA_DEBUG_STEPUP=1` shows the second-factor sheet (the local
    /// demo staff skip it on the server, so it never opens by itself there).
    var debugStepUp: StepUpState?
    @ObservationIgnored private let scope: ScreenScope
    @ObservationIgnored let viewModel: GestionViewModel

    init(graph: AppGraph) {
        scope = ScreenScope(graph: graph)
        viewModel = scope.gestion()
        state = viewModel.state.value
        #if DEBUG
        if ProcessInfo.processInfo.environment["RUTA_DEBUG_STEPUP"] == "1" {
            debugStepUp = StepUpStateAsking(recovery: false, error: nil)
        }
        #endif
    }

    var stepUp: StepUpState { debugStepUp ?? state.stepUp }

    func observe() async {
        for await next in viewModel.state { state = next }
    }

    isolated deinit { scope.close() }
}

extension ReviewKind {
    /// Catalogue strings are looked up by the key the shared table names.
    var title: String { catalogue(labelKey) }
    var symbol: String { CategoryGlyph.symbol(icon) }
}

extension VerdictSpec {
    var title: String { catalogue(labelKey) }
}

func catalogue(_ key: String) -> String { NSLocalizedString(key, comment: "") }
