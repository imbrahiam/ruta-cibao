import CoreLocation
import SwiftUI
import UserNotifications

/// First run: one sheet asks for what the app needs, each in context and one
/// at a time (Apple Maps' pattern). Location first, then notifications; a
/// step already answered is skipped. The system prompt only appears after
/// the person taps "allow", so "Ahora no" never burns the one-time prompt.
@MainActor @Observable
final class PermissionsPrimer: NSObject, CLLocationManagerDelegate {
    enum Step { case location, notifications }

    private(set) var steps: [Step] = []
    var current: Step? { steps.first }

    @ObservationIgnored private let manager = CLLocationManager()
    @ObservationIgnored private var waiting: CheckedContinuation<Void, Never>?

    func prepare() async {
        #if DEBUG
        // Screenshot runs open a tab directly; they ask for the primer explicitly.
        let env = ProcessInfo.processInfo.environment
        if env["RUTA_DEBUG_TAB"] != nil, env["RUTA_DEBUG_COMPOSE"] != "primer" { return }
        #endif
        var needed: [Step] = []
        if manager.authorizationStatus == .notDetermined { needed.append(.location) }
        if await UNUserNotificationCenter.current().notificationSettings().authorizationStatus == .notDetermined {
            needed.append(.notifications)
        }
        steps = needed
    }

    func allowLocation() async {
        manager.delegate = self
        await withCheckedContinuation { continuation in
            waiting = continuation
            manager.requestWhenInUseAuthorization()
        }
        advance()
    }

    func allowNotifications() async {
        await PushPermission.registerIfAllowed(ask: true)
        advance()
    }

    func skip() { advance() }

    func dismiss() { steps = [] }

    private func advance() {
        if !steps.isEmpty { steps.removeFirst() }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in
            guard status != .notDetermined else { return }
            self.waiting?.resume()
            self.waiting = nil
        }
    }
}

/// The primer's sheet: illustration, a bold line, one quiet paragraph, a
/// full-width primary button and a glass "Ahora no" under it.
struct PermissionsSheet: View {
    let primer: PermissionsPrimer
    @Environment(\.palette) private var palette
    @State private var busy = false

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 24)
            Group {
                switch primer.current {
                case .location:
                    content(art: .colmado, title: L10n.Onboarding.locationTitle, body: L10n.Onboarding.locationBody)
                case .notifications:
                    content(art: .mailbox, title: L10n.Onboarding.notificationsTitle, body: L10n.Onboarding.notificationsBody)
                case nil:
                    Color.clear
                }
            }
            .id(primer.current)
            .transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity), removal: .move(edge: .leading).combined(with: .opacity)))
            Spacer(minLength: 24)
            VStack(spacing: 12) {
                Button {
                    busy = true
                    Task {
                        if primer.current == .location { await primer.allowLocation() } else { await primer.allowNotifications() }
                        busy = false
                    }
                } label: {
                    Text(primer.current == .location ? L10n.Onboarding.allowLocation : L10n.Onboarding.enableNotifications)
                        .font(.headline)
                        .frame(maxWidth: .infinity, minHeight: 54)
                }
                .buttonStyle(RutaProminentStyle())
                .disabled(busy)

                Button { primer.skip() } label: {
                    Text(L10n.Onboarding.notNow)
                        .font(.headline)
                        .frame(maxWidth: .infinity, minHeight: 54)
                }
                .buttonStyle(.glass)
                .disabled(busy)
            }
        }
        .padding(.horizontal, 24)
        .padding(.bottom, 12)
        .animation(.snappy(duration: 0.35), value: primer.current)
        .interactiveDismissDisabled(busy)
    }

    private func content(art: Art, title: String, body: String) -> some View {
        VStack(spacing: 14) {
            Illustration(art: art, size: 230)
            Text(title)
                .font(.system(size: 28, weight: .bold))
                .tracking(-0.4)
                .multilineTextAlignment(.center)
            Text(body)
                .font(.body)
                .foregroundStyle(palette.textSecondary)
                .multilineTextAlignment(.center)
        }
        .accessibilityElement(children: .combine)
    }
}
