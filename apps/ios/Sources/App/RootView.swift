import SwiftUI
import UIKit

/// Top-level tabs, in the same order as Android's navigation bar. The bar is
/// the system's: Liquid Glass, icon and label always visible, the selected tab
/// filled and tinted. Each tab keeps its own navigation state.
struct RootView: View {
    enum Tab: Hashable, CaseIterable { case map, consultations, contributions, account }

    @State private var selection: Tab = Self.initialTab
    @State private var chrome = AppChrome()
    @State private var primer = PermissionsPrimer()
    @Environment(DeepLinks.self) private var links
    @Environment(\.colorScheme) private var scheme

    /// Debug-only: `SIMCTL_CHILD_RUTA_DEBUG_TAB=contributions` opens on a tab (screenshot runs).
    private static var initialTab: Tab {
        #if DEBUG
        switch DebugHook.value("RUTA_DEBUG_TAB") {
        case "consultations": return .consultations
        case "contributions": return .contributions
        case "account", "gestion": return .account
        default: return .map
        }
        #else
        return .map
        #endif
    }

    var body: some View {
        TabView(selection: $selection) {
            ForEach(Tab.allCases, id: \.self) { tab in
                SwiftUI.Tab(tab.title, systemImage: tab.symbol, value: tab) {
                    screen(tab)
                        .rutaTheme()
                        // Turn-by-turn navigation takes the whole screen.
                        .toolbarVisibility(chrome.immersive || chrome.conversation ? .hidden : .automatic, for: .tabBar)
                }
            }
        }
        // The current tab carries the brand green; everything inside a tab is ink.
        .tint(RutaPalette.palette(.clasico, scheme).accentInk)
        .sensoryFeedback(.selection, trigger: selection)
        .animation(.snappy, value: chrome.immersive)
        .animation(.snappy, value: chrome.conversation)
        .environment(chrome)
        .task { await primer.prepare() }
        .sheet(isPresented: Binding(get: { primer.welcoming }, set: { if !$0 { primer.dismiss() } })) {
            PermissionsSheet(primer: primer)
                .rutaTheme()
                .presentationDetents([.large])
                .presentationDragIndicator(.hidden)
        }
        // A notification or link picks the tab; the tab's screen opens the item.
        .onChange(of: links.pending, initial: true) { _, target in
            switch target {
            case .consultation: selection = .consultations
            case .place, .route, .traffic: selection = .map
            case .report: selection = .account
            case .contributions: selection = .contributions
            case nil: break
            }
        }
        .environment(\.palette, RutaPalette.palette(.clasico, scheme))
    }

    @ViewBuilder private func screen(_ tab: Tab) -> some View {
        switch tab {
        case .map: MapScreen()
        case .consultations: ConsultationsScreen()
        case .contributions: ContributionsScreen()
        case .account: AccountScreen()
        }
    }
}

/// App-wide chrome state a screen can ask for: `immersive` hides the tab bar
/// (turn-by-turn navigation takes the whole screen).
@Observable
final class AppChrome {
    var immersive = false
    /// A thread with a reply field is open: the field takes the tab bar's place.
    var conversation = false
}

/// Test hooks for simulator runs, inert in Release. A value comes from the
/// environment (`SIMCTL_CHILD_RUTA_DEBUG_TAB=map`) or from a launch argument
/// (`-RUTA_DEBUG_TAB map`), which UI drivers can pass.
enum DebugHook {
    static func value(_ key: String) -> String? {
        #if DEBUG
        ProcessInfo.processInfo.environment[key] ?? UserDefaults.standard.string(forKey: key)
        #else
        nil
        #endif
    }
}

extension RootView.Tab {
    var title: String {
        switch self {
        case .map: L10n.Tabs.map
        case .consultations: L10n.Tabs.consultations
        case .contributions: L10n.Tabs.contributions
        case .account: L10n.Tabs.account
        }
    }

    var symbol: String {
        switch self {
        case .map: "map"
        case .consultations: "bubble.left.and.bubble.right"
        case .contributions: "plus.circle"
        case .account: "person"
        }
    }
}

