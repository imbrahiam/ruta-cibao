import RutaKit
import SwiftUI

enum AppTab: String, CaseIterable {
    case map, consultations, contributions, account

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
        case .map: "map.fill"
        case .consultations: "bubble.left.fill"
        case .contributions: "plus.circle.fill"
        case .account: "person.fill"
        }
    }
}

/// What a screen can ask of the shell.
@Observable
final class AppChrome {
    var tab: AppTab = AppChrome.startTab

    private static var startTab: AppTab {
        DebugHook.value("RUTA_DEBUG_TAB").flatMap { AppTab(rawValue: $0 == "gestion" ? "account" : $0) } ?? .map
    }
}

extension View {
    /// Hides the tab bar while this view is on screen (a thread's reply field, turn-by-turn).
    func hidesTabBar() -> some View { toolbarVisibility(.hidden, for: .tabBar) }
}

/// The four places of the app under the system tab bar, which shrinks out of the way on scroll.
struct Shell: View {
    @State private var chrome = AppChrome()
    @State private var welcome = Welcome()
    @Environment(DeepLinks.self) private var links

    var body: some View {
        TabView(selection: Bindable(chrome).tab) {
            ForEach(AppTab.allCases, id: \.self) { tab in
                Tab(tab.title, systemImage: tab.symbol, value: tab) { screen(tab) }
            }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
        // Wide windows get the system sidebar (glass, collapsible); a phone keeps the tab bar.
        .tabViewStyle(.sidebarAdaptable)
        // The brand iris marks where you are and what is tappable; text stays ink.
        .tint(.irisDeep)
        .environment(chrome)
        // First run: the welcome stands in front of the app until it is done, then lifts away.
        .overlay { if welcome.showing { Onboarding(welcome: welcome).transition(.opacity) } }
        .onChange(of: links.requestId, initial: true) { _, _ in
            switch links.pending {
            case .consultation: chrome.tab = .consultations
            case .place, .route, .traffic: chrome.tab = .map
            case .contributions: chrome.tab = .contributions
            case .report: chrome.tab = .account
            case nil: break
            }
        }
    }

    @ViewBuilder private func screen(_ tab: AppTab) -> some View {
        switch tab {
        case .map: MapScreen()
        case .consultations: ConsultationsScreen()
        case .contributions: ContributionsScreen()
        case .account: AccountScreen()
        }
    }
}
