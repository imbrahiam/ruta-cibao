import CoreLocation
import SwiftUI
import UserNotifications

/// First run: one welcome sheet in the system's style (the mark, what the
/// app does in three lines, Continuar). Continuar asks for location, the one
/// permission the map needs. Notifications are asked at sign-in, when there
/// is something to be notified about.
@MainActor @Observable
final class PermissionsPrimer: NSObject, CLLocationManagerDelegate {
    private static let seenKey = "ruta.welcomed"

    private(set) var welcoming = false

    @ObservationIgnored private let manager = CLLocationManager()
    @ObservationIgnored private var waiting: CheckedContinuation<Void, Never>?

    func prepare() async {
        #if DEBUG
        // Screenshot runs open a tab directly; they ask for the welcome explicitly.
        if DebugHook.value("RUTA_DEBUG_COMPOSE") == "primer" { welcoming = true; return }
        if DebugHook.value("RUTA_DEBUG_TAB") != nil { return }
        #endif
        guard !UserDefaults.standard.bool(forKey: Self.seenKey) else { return }
        // The map draws first; the welcome rises over it.
        try? await Task.sleep(for: .milliseconds(900))
        welcoming = true
    }

    /// Continuar: the system's location prompt, then the map.
    func proceed() async {
        if manager.authorizationStatus == .notDetermined {
            manager.delegate = self
            await withCheckedContinuation { continuation in
                waiting = continuation
                manager.requestWhenInUseAuthorization()
            }
        }
        dismiss()
    }

    func dismiss() {
        UserDefaults.standard.set(true, forKey: Self.seenKey)
        welcoming = false
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

/// The welcome sheet, laid out as the system's own ("Te damos la bienvenida
/// a Mapas"): the mark, a bold title, three features, one button.
struct PermissionsSheet: View {
    let primer: PermissionsPrimer
    @Environment(\.palette) private var palette
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var busy = false
    @State private var shown = false

    private var features: [(symbol: String, color: Color, title: String, body: String)] {
        [
            ("map.fill", .green, L10n.Onboarding.exploreTitle, L10n.Onboarding.exploreBody),
            ("bubble.left.and.bubble.right.fill", .blue, L10n.Onboarding.askTitle, L10n.Onboarding.askBody),
            ("plus.circle.fill", .orange, L10n.Onboarding.contributeTitle, L10n.Onboarding.contributeBody),
        ]
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(spacing: 36) {
                    VStack(spacing: 20) {
                        BrandMark(size: 76)
                        Text(L10n.Onboarding.welcomeTitle)
                            .font(.title.weight(.bold))
                            .multilineTextAlignment(.center)
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityAddTraits(.isHeader)
                    }
                    VStack(alignment: .leading, spacing: 26) {
                        ForEach(Array(features.enumerated()), id: \.offset) { index, feature in
                            HStack(spacing: 16) {
                                Image(systemName: feature.symbol)
                                    .font(.system(size: 30))
                                    .foregroundStyle(feature.color.gradient)
                                    .frame(width: 44)
                                    .accessibilityHidden(true)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(feature.title).font(.headline)
                                    Text(feature.body)
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }
                            .accessibilityElement(children: .combine)
                            // Each line settles in after the one above it.
                            .opacity(shown ? 1 : 0)
                            .offset(y: shown ? 0 : 12)
                            .animation(reduceMotion ? nil : .spring(duration: 0.5).delay(0.25 + Double(index) * 0.09), value: shown)
                        }
                    }
                    .frame(maxWidth: 340, alignment: .leading)
                }
                .padding(.top, 56)
                .padding(.horizontal, 32)
                .frame(maxWidth: .infinity)
            }
            .scrollBounceBehavior(.basedOnSize)

            Button {
                busy = true
                Task {
                    await primer.proceed()
                    busy = false
                }
            } label: {
                Text(L10n.Common.`continue`)
                    .font(.headline)
                    .frame(maxWidth: 420, minHeight: 54)
            }
            .buttonStyle(RutaProminentStyle())
            .disabled(busy)
            .padding(.horizontal, 24)
            .padding(.bottom, 12)
        }
        .onAppear { shown = true }
        .interactiveDismissDisabled(busy)
    }
}
