import RutaKit
import SwiftUI
import UIKit
import UserNotifications

/// Every accepted opening gets its own serial, including the same URL twice.
@MainActor @Observable
final class DeepLinks {
    enum Target: Equatable {
        case consultation(slug: String)
        case place(slug: String)
        case route(id: String)
        case traffic(id: String)
        case report(id: String)
        case contributions
    }

    var pending: Target?
    private(set) var requestId: UInt64 = 0

    func open(_ href: String) {
        guard let target = Self.parse(href) else { return }
        pending = target
        requestId &+= 1
    }

    /// Sends the app somewhere it already knows, without an address to parse.
    func go(_ target: Target) {
        pending = target
        requestId &+= 1
    }

    static func parse(_ href: String) -> Target? {
        guard let target = AppTarget.companion.parse(href: href, apiOrigin: AppConfig.current.apiOrigin, appScheme: AppConfig.current.appScheme) else { return nil }
        switch target.kind {
        case "consultation": return target.ref.map { .consultation(slug: $0) }
        case "place": return target.ref.map { .place(slug: $0) }
        case "route": return target.ref.map { .route(id: $0) }
        case "traffic": return target.ref.map { .traffic(id: $0) }
        case "report": return target.ref.map { .report(id: $0) }
        case "contributions": return .contributions
        default: return nil
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    @MainActor var graph: AppGraph? {
        didSet {
            guard let graph, let token else { return }
            Task { _ = try? await graph.push.register(platform: .ios, token: token) }
        }
    }
    @MainActor private var token: String?
    @MainActor let links = DeepLinks()
    static let pushReceived = Notification.Name("RutaPushReceived")

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let value = deviceToken.map { String(format: "%02x", $0) }.joined()
        token = value
        Task { _ = try? await graph?.push.register(platform: .ios, token: value) }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        // No entitlement/provider connectivity: the durable in-app inbox remains available.
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        NotificationCenter.default.post(name: Self.pushReceived, object: nil)
        return [.banner, .list, .sound]
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let href = response.notification.request.content.userInfo["href"] as? String
        await MainActor.run {
            NotificationCenter.default.post(name: Self.pushReceived, object: nil)
            links.open(href ?? "/contributions")
        }
    }
}

enum PushPermission {
    /// Ask after sign-in; refresh authorization and the provider token on foreground.
    @MainActor @discardableResult static func registerIfAllowed(ask: Bool) async -> Bool {
        let center = UNUserNotificationCenter.current()
        var status = await center.notificationSettings().authorizationStatus
        if status == .notDetermined, ask {
            _ = try? await center.requestAuthorization(options: [.alert, .sound, .badge])
            status = await center.notificationSettings().authorizationStatus
        }
        let allowed = status == .authorized || status == .provisional || status == .ephemeral
        if allowed { UIApplication.shared.registerForRemoteNotifications() }
        return allowed
    }
}

extension PushRepository: @unchecked @retroactive Sendable {}
