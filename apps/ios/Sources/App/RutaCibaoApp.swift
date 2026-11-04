import UIKit
import RutaKit
import SwiftUI

@main
struct RutaCibaoApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    /// Built once at launch; every screen reads it from the environment.
    private let graph: AppGraph

    init() {
        let store = KeychainSecureStore()
        #if DEBUG
        // Test hook for simulator runs: `SIMCTL_CHILD_RUTA_DEBUG_SESSION="better-auth.session_token=…"`
        // seeds the session the dev server issued. Compiled out of Release builds.
        if let cookie = ProcessInfo.processInfo.environment["RUTA_DEBUG_SESSION"], cookie.contains("=") {
            store.write(key: "rutacibao.session.cookies", value: cookie)
        }
        // `SIMCTL_CHILD_RUTA_DEBUG_OFFLINE=1` starts with every API call failing like a dropped connection.
        if ProcessInfo.processInfo.environment["RUTA_DEBUG_OFFLINE"] == "1" { DebugNetwork.shared.offline = true }
        #endif
        graph = createAppGraph(config: AppConfig.current, secureStore: store)
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(\.graph, graph)
                .environment(delegate.links)
                // Custom-scheme and universal links share the notification router.
                .onOpenURL { url in
                    #if DEBUG
                    // Simulator has no way to cut the network: `rutacibao-dev://debug/offline|online|download|sync`.
                    if url.host == "debug" {
                        switch url.lastPathComponent {
                        case "offline": DebugNetwork.shared.offline = true
                        case "online": DebugNetwork.shared.offline = false
                        case "download": graph.offline.download()
                        case "sync": graph.offline.flush()
                        default: break
                        }
                        return
                    }
                    #endif
                    delegate.links.open(url.absoluteString)
                }
                .task {
                    delegate.graph = graph
                    // Signed in: make sure this phone gets the account's notices.
                    for await signedIn in graph.session.isSignedIn {
                        guard signedIn.boolValue else { continue }
                        await PushPermission.registerIfAllowed(ask: false)
                        _ = try? await graph.push.resync()
                    }
                }
        }
    }
}

extension AppConfig {
    /// The running build's configuration, for resolving server-relative URLs.
    static let current = fromBundle()

    /// A server-relative path (`/demo/…`) or absolute URL, as a URL.
    static func url(_ raw: String) -> URL? { URL(string: current.absolute(path: raw)) }

    /// Public, per-configuration values baked into Info.plist by project.yml.
    static func fromBundle(_ bundle: Bundle = .main) -> AppConfig {
        func value(_ key: String) -> String {
            guard let value = bundle.object(forInfoDictionaryKey: key) as? String, !value.isEmpty else {
                fatalError("Missing \(key) in Info.plist")
            }
            return value
        }
        let variant: AppConfig.Variant = switch value("RutaVariant") {
        case "Production": .production
        case "Preview": .preview
        default: .development
        }
        return AppConfig(
            apiOrigin: value("RutaApiOrigin"),
            appScheme: value("RutaAppScheme"),
            variant: variant,
            platform: .ios
        )
    }
}
