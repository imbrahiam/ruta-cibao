import SwiftUI
import UIKit

/// Top-level tabs, in the same order as Android's navigation bar. Icon and
/// label always visible, so the app is usable without training. Threads-style
/// emphasis: only the selected tab in ink (filled symbol), the rest mid-grey
/// (outlined). The system Liquid Glass bar renders every item filled in the
/// label colour, so the bar is our own over a glass background; the
/// TabView stays underneath so each tab keeps its navigation state.
struct RootView: View {
    enum Tab: Hashable, CaseIterable { case map, consultations, contributions, account }

    @State private var selection: Tab = Self.initialTab
    @State private var chrome = AppChrome()
    @State private var primer = PermissionsPrimer()
    @Environment(DeepLinks.self) private var links

    /// Debug-only: `SIMCTL_CHILD_RUTA_DEBUG_TAB=contributions` opens on a tab (screenshot runs).
    private static var initialTab: Tab {
        #if DEBUG
        switch ProcessInfo.processInfo.environment["RUTA_DEBUG_TAB"] {
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
            SwiftUI.Tab(value: Tab.map) { MapScreen().tabBarClearance().tabChrome() } label: { Text(Tab.map.title) }
            SwiftUI.Tab(value: Tab.consultations) { ConsultationsScreen().tabChrome() } label: { Text(Tab.consultations.title) }
            SwiftUI.Tab(value: Tab.contributions) { ContributionsScreen().tabChrome() } label: { Text(Tab.contributions.title) }
            SwiftUI.Tab(value: Tab.account) { AccountScreen().tabChrome() } label: { Text(Tab.account.title) }
        }
        // The bar floats over content (glass), and every tab reserves its
        // height so scroll views end above it, not under it.
        .overlay(alignment: .bottom) {
            if !chrome.immersive {
                RutaTabBar(selection: $selection).transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.snappy, value: chrome.immersive)
        .environment(chrome)
        .task { await primer.prepare() }
        .sheet(isPresented: Binding(get: { primer.current != nil }, set: { if !$0 { primer.dismiss() } })) {
            PermissionsSheet(primer: primer)
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
        .rutaTheme()
    }
}

/// The tab bar's room, dropped while the screen is immersive (navigation),
/// so its bottom card sits at the bottom edge.
private struct TabBarClearance: ViewModifier {
    @Environment(AppChrome.self) private var chrome

    func body(content: Content) -> some View {
        content.safeAreaPadding(.bottom, chrome.immersive ? 0 : RutaTabBar.height)
    }
}

/// App-wide chrome state a screen can ask for: `immersive` hides the tab bar
/// (turn-by-turn navigation takes the whole screen).
@Observable
final class AppChrome {
    var immersive = false
}

private extension View {
    /// Hides the system bar for this tab; `RutaTabBar` replaces it.
    func tabChrome() -> some View { toolbarVisibility(.hidden, for: .tabBar) }
}

extension View {
    /// Room for the floating tab bar, so the last row scrolls clear of it.
    /// Apply inside each tab's NavigationStack (root and every destination):
    /// UIKit resets the safe area at the navigation container, so padding
    /// outside the stack never reaches its scroll views.
    func tabBarClearance() -> some View { modifier(TabBarClearance()) }
}

/// The app's tab bar, drawn like iOS 26's: every tab in the primary label
/// colour (no greyed-out items), the selected one tinted, filled and set on a
/// selection pill that slides between tabs. Glass capsule, like the system bar.
struct RutaTabBar: View {
    /// Taller than the system bar, and lower: it sits into the home-indicator
    /// zone (16pt), as iOS 26's own floating bar does.
    static let barHeight: CGFloat = 64
    static let sink: CGFloat = 16
    /// What every tab reserves so its last row clears the bar.
    static let height: CGFloat = barHeight - sink + 12

    @Binding var selection: RootView.Tab
    @Namespace private var pill
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: 0) {
            ForEach(RootView.Tab.allCases, id: \.self) { tab in
                let selected = tab == selection
                Button {
                    withAnimation(reduceMotion ? nil : .snappy(duration: 0.3)) { selection = tab }
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: tab.symbol)
                            .symbolVariant(selected ? .fill : .none)
                            .font(.system(size: 22, weight: .regular))
                            .symbolEffect(.bounce.down, value: selected)
                            .frame(height: 28)
                        Text(tab.title)
                            .font(.system(size: 11, weight: selected ? .semibold : .medium))
                    }
                    // Semantic styles, not fixed colours: on Liquid Glass they
                    // adapt to what's behind the bar, as Apple recommends.
                    .foregroundStyle(selected ? RutaHighlight.selection : AnyShapeStyle(.primary))
                    .frame(maxWidth: .infinity, minHeight: Self.barHeight - 8)
                    .background {
                        if selected {
                            Capsule()
                                .fill(.primary.opacity(0.1))
                                .matchedGeometryEffect(id: "pill", in: pill)
                        }
                    }
                    .padding(.vertical, 4)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selected ? [.isSelected, .isButton] : .isButton)
                .sensoryFeedback(.selection, trigger: selected) { _, now in now }
            }
        }
        .padding(.horizontal, 4)
        .glassEffect(.regular, in: Capsule())
        .padding(.horizontal, 16)
        .padding(.bottom, -Self.sink)
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
        case .consultations: "text.bubble"
        case .contributions: "plus.square"
        case .account: "person"
        }
    }
}

