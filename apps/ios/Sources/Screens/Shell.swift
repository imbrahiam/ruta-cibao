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

    /// The outline; the tab you are on fills it in.
    var symbol: String {
        switch self {
        case .map: "map"
        case .consultations: "bubble.left"
        case .contributions: "rectangle.stack"
        case .account: "person.crop.circle"
        }
    }
}

/// What a screen can ask of the shell.
@Observable
final class AppChrome {
    var tab: AppTab = AppChrome.startTab
    /// The three ways to add something, opened from any header.
    var contributing = false
    /// A way to add something asked for from inside a screen (search's "Sugerir un lugar"),
    /// started like a choice from the add sheet.
    var requested: ContributeAction?
    /// Counts what was sent from the add button, so the list of contributions can refresh.
    var sent = 0
    /// Screens on show that asked for the tab bar to step aside.
    var covers = 0

    private static var startTab: AppTab {
        DebugHook.value("RUTA_DEBUG_TAB").flatMap { AppTab(rawValue: $0 == "gestion" ? "account" : $0) } ?? .map
    }
}

private struct HidesTabBar: ViewModifier {
    @Environment(AppChrome.self) private var chrome: AppChrome?

    func body(content: Content) -> some View {
        content
            .onAppear { chrome?.covers += 1 }
            .onDisappear { chrome?.covers -= 1 }
    }
}

extension View {
    /// Hides the tab bar while this view is on screen (a thread's reply field, a route, turn-by-turn).
    func hidesTabBar() -> some View { modifier(HidesTabBar()) }
}

/// The app's four places over its own tab bar. Adding something lives in every header, so it
/// is one tap away without taking a tab.
struct Shell: View {
    @State private var chrome = AppChrome()
    @State private var welcome = Welcome()
    @State private var typing = false
    @State private var action: ContributeAction? = DebugHook.value("RUTA_DEBUG_COMPOSE").flatMap(ContributeAction.init(rawValue:))
    @State private var wanted: ContributeAction?
    @State private var signingIn = false
    @Environment(\.graph) private var graph
    @Environment(DeepLinks.self) private var links
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(spacing: 0) {
            // The system keeps each tab's state; its own bar stays out of sight.
            TabView(selection: Bindable(chrome).tab) {
                ForEach(AppTab.allCases, id: \.self) { tab in
                    Tab(value: tab) { screen(tab).toolbarVisibility(.hidden, for: .tabBar) }
                }
            }
            if chrome.covers == 0, !typing {
                TabBar(tab: Bindable(chrome).tab)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(reduceMotion ? nil : Motion.quick, value: chrome.covers == 0)
        // The keyboard takes the bar's place instead of lifting it.
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in typing = true }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in typing = false }
        // System controls (dialogs, menus, back chevrons) read in ink: green stays for the
        // main action and the selected state, never for text.
        .tint(.ink)
        .environment(chrome)
        .background(StatusBar.Anchor())
        // The choice opens once its sheet has left, so two presentations never overlap.
        .sheet(isPresented: Bindable(chrome).contributing, onDismiss: begin) {
            ContributeSheet { choice in
                wanted = choice
                chrome.contributing = false
            }
        }
        .fullScreenCover(isPresented: $signingIn, onDismiss: begin) { SignInScreen() }
        .fullScreenCover(item: $action, onDismiss: { chrome.sent += 1 }) { action in
            switch action {
            case .consultation: NewConsultationScreen { slug in links.go(.consultation(slug: slug)) }
            case .traffic: TrafficReportScreen()
            case .place: SuggestPlaceScreen()
            }
        }
        // First run: the welcome stands in front of the app until it is done, then lifts away.
        .overlay { if welcome.showing { Onboarding(welcome: welcome).transition(.opacity) } }
        .onChange(of: chrome.requested) { _, request in
            guard let request else { return }
            chrome.requested = nil
            wanted = request
            begin()
        }
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

    /// Starts what was chosen in the sheet: the form when signed in, signing in first otherwise.
    private func begin() {
        guard let next = wanted else { return }
        if graph?.session.isSignedIn.value == true {
            wanted = nil
            action = next
        } else if signingIn {
            // Came back from signing in without an account: drop the request.
            wanted = nil
        } else {
            signingIn = true
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

/// The app's own tab bar: flat on white under a hairline, an icon and its name for each place,
/// grey until you are there. Where you are is the brand green, filled in and heavier, so it
/// never rests on colour alone.
struct TabBar: View {
    @Binding var tab: AppTab

    var body: some View {
        HStack(spacing: 0) {
            ForEach(AppTab.allCases, id: \.self) { item in
                let on = item == tab
                Button { tab = item } label: {
                    VStack(spacing: 3) {
                        Image(systemName: on ? item.symbol + ".fill" : item.symbol).font(.system(size: 21)).frame(height: 26).accessibilityHidden(true)
                        Text(item.title).font(.system(size: 11, weight: on ? .semibold : .medium)).lineLimit(1).minimumScaleFactor(0.8)
                    }
                    .foregroundStyle(on ? Color.brand : Color.ink3)
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .contentShape(Rectangle())
                }
                .buttonStyle(Pressable(scale: 0.94))
                .accessibilityAddTraits(on ? .isSelected : [])
                // The bar keeps its size at large text sizes; a long press shows the tab large.
                .accessibilityShowsLargeContentViewer { Label(item.title, systemImage: item.symbol) }
            }
        }
        .padding(.top, 6)
        .frame(maxWidth: 560)
        .frame(maxWidth: .infinity)
        .background(Color.paper.ignoresSafeArea(edges: .bottom))
        .overlay(alignment: .top) { Hairline() }
        .sensoryFeedback(.selection, trigger: tab)
    }
}
