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
        if let cookie = DebugHook.value("RUTA_DEBUG_SESSION"), cookie.contains("=") {
            store.write(key: "rutacibao.session.cookies", value: cookie)
        }
        // `SIMCTL_CHILD_RUTA_DEBUG_OFFLINE=1` starts with every API call failing like a dropped connection.
        if DebugHook.value("RUTA_DEBUG_OFFLINE") == "1" { DebugNetwork.shared.offline = true }
        #endif
        graph = createAppGraph(config: AppConfig.current, secureStore: store)
    }

    var body: some Scene {
        WindowGroup {
            Shell()
                .launchVeil()
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
                    var launching = true
                    for await signedIn in graph.session.isSignedIn {
                        // Ask at the moment of signing in, when there is something to be
                        // notified about; never over the first screen of a launch.
                        let justSignedIn = !launching
                        launching = false
                        guard signedIn.boolValue else { continue }
                        await PushPermission.registerIfAllowed(ask: justSignedIn)
                        _ = try? await graph.push.resync()
                    }
                }
        }
    }
}

/// The launch screen's mark, kept on screen for a beat and then lifted away,
/// so the app opens from its own logo instead of cutting to the map.
private struct LaunchVeil: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var lifted = false
    @State private var gone = false

    func body(content: Content) -> some View {
        content.overlay {
            if !gone {
            ZStack {
                Color("LaunchBackground")
                Image("LaunchMark")
                    .scaleEffect(lifted && !reduceMotion ? 1.35 : 1)
            }
            .ignoresSafeArea()
            .opacity(lifted ? 0 : 1)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
            .task {
                try? await Task.sleep(for: .milliseconds(350))
                withAnimation(.easeOut(duration: 0.4)) { lifted = true }
                // Out of the tree once lifted, so it costs nothing and VoiceOver never meets it.
                try? await Task.sleep(for: .milliseconds(450))
                gone = true
            }
            }
        }
    }
}

private extension View {
    func launchVeil() -> some View { modifier(LaunchVeil()) }
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
