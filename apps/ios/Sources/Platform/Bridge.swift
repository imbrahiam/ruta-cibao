import Observation
import RutaKit
import SwiftUI

/// Mirrors one shared Kotlin view model into Observation and owns its lifetime.
/// All logic stays in Kotlin; a screen reads `state` and calls `vm`.
@Observable
final class Screen<VM: AnyObject, State> {
    private(set) var state: State

    @ObservationIgnored let vm: VM
    @ObservationIgnored private let scope: ScreenScope
    @ObservationIgnored private let flow: SkieSwiftStateFlow<State>

    init(_ graph: AppGraph, make: (ScreenScope) -> VM, flow: (VM) -> SkieSwiftStateFlow<State>) {
        scope = ScreenScope(graph: graph)
        vm = make(scope)
        self.flow = flow(vm)
        state = self.flow.value
    }

    /// Runs for as long as the view's `.task` does.
    func observe() async {
        for await next in flow { state = next }
    }

    isolated deinit { scope.close() }
}

/// Creates a `Screen` once the graph is in the environment and keeps it observed.
struct Host<VM: AnyObject, State, Content: View>: View {
    let make: (ScreenScope) -> VM
    let flow: (VM) -> SkieSwiftStateFlow<State>
    var setup: (VM) -> Void = { _ in }
    @ViewBuilder let content: (Screen<VM, State>) -> Content

    @Environment(\.graph) private var graph
    @State private var model: Screen<VM, State>?

    var body: some View {
        ZStack {
            if let model { content(model) } else { Color.clear }
        }
        .task {
            if model == nil, let graph {
                let created = Screen(graph, make: make, flow: flow)
                setup(created.vm)
                model = created
            }
            await model?.observe()
        }
    }
}
