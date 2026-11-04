import BackgroundTasks
import RutaKit

/// iOS chooses execution time; foreground sync remains immediate when coverage returns.
@MainActor
final class OfflineScheduler {
    static let shared = OfflineScheduler()
    private let identifier = "do.rutacibao.offline-sync"
    private var graph: AppGraph?

    func register(graph: AppGraph) {
        self.graph = graph
        BGTaskScheduler.shared.register(forTaskWithIdentifier: identifier, using: .main) { [weak self] task in
            Task { @MainActor in self?.run(task) }
        }
        schedule()
    }

    func schedule() {
        let request = BGProcessingTaskRequest(identifier: identifier)
        request.requiresNetworkConnectivity = true
        request.requiresExternalPower = false
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
        do { try BGTaskScheduler.shared.submit(request) }
        catch { /* System may deny background work; the durable queue is retried on foreground. */ }
    }

    private func run(_ task: BGTask) {
        schedule()
        guard let graph else { task.setTaskCompleted(success: false); return }
        // The Kotlin repository is thread-safe; Swift can't see that.
        nonisolated(unsafe) let offline = graph.offline
        let work = Task { @MainActor in
            do {
                try await offline.sync()
                task.setTaskCompleted(success: !Task.isCancelled)
            } catch { task.setTaskCompleted(success: false) }
        }
        task.expirationHandler = { work.cancel() }
    }
}
