import CoreLocation
import SwiftUI
import UserNotifications

/// First run, before the map: what this is, then the two permissions, each asked on its own
/// page with one line of why. Nothing is asked twice.
@MainActor @Observable
final class Welcome: NSObject, CLLocationManagerDelegate {
    private static let seenKey = "ruta.welcomed"
    enum Step: Int, CaseIterable { case hello, location, notifications }

    private(set) var showing: Bool
    private(set) var step = Step.hello

    @ObservationIgnored private let manager = CLLocationManager()
    @ObservationIgnored private var waiting: CheckedContinuation<Void, Never>?

    override init() {
        var show = !UserDefaults.standard.bool(forKey: Self.seenKey)
        #if DEBUG
        // Screenshot runs open a screen directly; they ask for the welcome explicitly.
        if DebugHook.value("RUTA_DEBUG_COMPOSE") == "primer" { show = true }
        else if DebugHook.value("RUTA_DEBUG_TAB") != nil || DebugHook.value("RUTA_DEBUG_COMPOSE") != nil { show = false }
        #endif
        showing = show
    }

    func next() {
        guard let following = Step(rawValue: step.rawValue + 1) else { return finish() }
        withAnimation(Motion.settle) { step = following }
    }

    func allowLocation() async {
        if manager.authorizationStatus == .notDetermined {
            manager.delegate = self
            await withCheckedContinuation { continuation in
                waiting = continuation
                manager.requestWhenInUseAuthorization()
            }
        }
        next()
    }

    func allowNotifications() async {
        await PushPermission.registerIfAllowed(ask: true)
        finish()
    }

    func finish() {
        UserDefaults.standard.set(true, forKey: Self.seenKey)
        withAnimation(.easeOut(duration: 0.35)) { showing = false }
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

/// The landing's voice on first launch: one figure, one large line, one short reason, one pill.
struct Onboarding: View {
    let welcome: Welcome
    @State private var working = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) {
                ForEach(Welcome.Step.allCases, id: \.self) { step in
                    Capsule().fill(step == welcome.step ? Color.action : Color.line).frame(width: step == welcome.step ? 22 : 6, height: 6)
                }
            }
            .animation(Motion.settle, value: welcome.step)
            .padding(.top, 18)
            .accessibilityHidden(true)

            Spacer(minLength: 24)

            Group {
                switch welcome.step {
                case .hello: page(figure: AnyView(Mark(size: 84)), title: L10n.Onboarding.welcomeTitle, body: L10n.Onboarding.exploreBody)
                case .location: page(figure: AnyView(Beacon()), title: L10n.Onboarding.locationTitle, body: L10n.Onboarding.locationBody)
                case .notifications: page(figure: AnyView(Bell()), title: L10n.Onboarding.notificationsTitle, body: L10n.Onboarding.notificationsBody)
                }
            }
            .id(welcome.step)
            .transition(.asymmetric(insertion: .opacity.combined(with: .offset(x: reduceMotion ? 0 : 28)), removal: .opacity.combined(with: .offset(x: reduceMotion ? 0 : -28))))

            Spacer(minLength: 24)

            VStack(spacing: 6) {
                Button(primaryTitle) {
                    switch welcome.step {
                    case .hello: welcome.next()
                    case .location: working = true; Task { await welcome.allowLocation(); working = false }
                    case .notifications: working = true; Task { await welcome.allowNotifications(); working = false }
                    }
                }
                .buttonStyle(.ink)
                .disabled(working)

                Button(L10n.Onboarding.notNow) { welcome.next() }
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(Color.ink2)
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .opacity(welcome.step == .hello ? 0 : 1)
                    .disabled(welcome.step == .hello || working)
            }
            .padding(.bottom, 8)
        }
        .padding(.horizontal, Metrics.gutter)
        .readable(520)
        .paperBackground()
        .darkStatusBar()
        .sensoryFeedback(.selection, trigger: welcome.step)
    }

    private var primaryTitle: String {
        switch welcome.step {
        case .hello: L10n.Common.`continue`
        case .location: L10n.Onboarding.allowLocation
        case .notifications: L10n.Onboarding.enableNotifications
        }
    }

    private func page(figure: AnyView, title: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            figure.frame(height: 150, alignment: .bottomLeading).rise(0)
            Text(title).font(.system(size: 40, weight: .regular)).tracking(-1.4).foregroundStyle(Color.ink).fixedSize(horizontal: false, vertical: true).padding(.top, 36).rise(1)
            Text(body).type(.body, .ink2).font(.system(size: 18)).fixedSize(horizontal: false, vertical: true).padding(.top, 12).rise(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// The landing's pin with rings going out from where it stands.
private struct Beacon: View {
    @State private var out = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack(alignment: .bottom) {
            ForEach(0..<3, id: \.self) { ring in
                Ellipse().strokeBorder(Color.pin.opacity(0.35), lineWidth: 1.5)
                    .frame(width: 60 + CGFloat(ring) * 44, height: 20 + CGFloat(ring) * 15)
                    .scaleEffect(out ? 1.12 : 0.86)
                    .opacity(out ? 0.15 : 0.9)
                    .animation(reduceMotion ? nil : .easeInOut(duration: 1.8).repeatForever(autoreverses: true).delay(Double(ring) * 0.22), value: out)
                    .offset(y: 8 + CGFloat(ring) * 7)
            }
            TeardropPin(height: 86)
        }
        .frame(width: 150, alignment: .bottom)
        .padding(.bottom, 24)
        .onAppear { out = true }
    }
}

/// A bell on the brand's soft green, with one unread dot.
private struct Bell: View {
    @State private var rung = false

    var body: some View {
        Image(systemName: "bell.fill")
            .font(.system(size: 40))
            .foregroundStyle(Color.brand)
            .symbolEffect(.bounce, value: rung)
            .frame(width: 96, height: 96)
            .background(Color.paper2, in: Circle())
            .overlay(alignment: .topTrailing) { Circle().fill(Color.pin).frame(width: 20, height: 20).overlay(Circle().strokeBorder(Color.paper, lineWidth: 3)).offset(x: -6, y: 6) }
            .task { try? await Task.sleep(for: .milliseconds(500)); rung = true }
    }
}
