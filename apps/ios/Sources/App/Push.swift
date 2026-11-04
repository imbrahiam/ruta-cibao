import RutaKit
import SwiftUI
import UIKit
import UserNotifications

/// Where a link, a notification or a share points (`packages/shared/src/app-target.ts`):
/// `/s/<kind>/<ref>` or `/contributions`. Screens read `pending` and clear it.
@MainActor @Observable
final class DeepLinks {
    enum Target: Equatable {
        case consultation(slug: String)
        case place(slug: String)
        case route(id: String)
        case map
        case contributions
    }

    var pending: Target?

    func open(_ href: String) {
        pending = Self.parse(href)
    }

    static func parse(_ href: String) -> Target? {
        // Accept `/s/…`, `https://host/s/…` and `scheme://s/…` alike.
        var path = href
        if let url = URL(string: href), url.scheme != nil {
            path = url.host().map { url.scheme == "http" || url.scheme == "https" ? url.path() : "/\($0)\(url.path())" } ?? url.path()
        }
        path = path.components(separatedBy: CharacterSet(charactersIn: "?#")).first ?? path
        if path == "/contributions" { return .contributions }
        let parts = path.split(separator: "/").map { String($0).removingPercentEncoding ?? String($0) }
        guard parts.count == 3, parts[0] == "s" else { return nil }
        switch parts[1] {
        case "consultation": return .consultation(slug: parts[2])
        case "place": return .place(slug: parts[2])
        case "route": return .route(id: parts[2])
        case "traffic": return .map
        case "report": return .contributions
        default: return nil
        }
    }
}

/// APNs plumbing. The token goes to the account through the shared
/// `PushRepository`; a tap routes through `DeepLinks`; a push that arrives
/// in the foreground shows as a banner and refreshes Avisos.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    @MainActor var graph: AppGraph?
    @MainActor let links = DeepLinks()

    /// Posted when a push arrives, so Avisos can refresh without a pull.
    static let pushReceived = Notification.Name("RutaPushReceived")

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        Task { @MainActor in
            _ = try? await graph?.push.register(platform: .ios, token: token)
        }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        // No token (no entitlement, simulator without APNs, airplane mode): the
        // in-app inbox still carries every notice.
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        NotificationCenter.default.post(name: Self.pushReceived, object: nil)
        return [.banner, .list, .sound]
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let href = response.notification.request.content.userInfo["href"] as? String
        await MainActor.run { links.open(href ?? "/contributions") }
    }
}

enum PushPermission {
    /// Ask once, in context (right after signing in); afterwards just refresh
    /// the token, as Apple recommends doing on every launch.
    @MainActor static func registerIfAllowed(ask: Bool) async {
        let center = UNUserNotificationCenter.current()
        var status = await center.notificationSettings().authorizationStatus
        if status == .notDetermined, ask {
            _ = try? await center.requestAuthorization(options: [.alert, .sound, .badge])
            status = await center.notificationSettings().authorizationStatus
        }
        if status == .authorized || status == .provisional || status == .ephemeral {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }
}

/// Kotlin objects aren't Sendable to Swift; `PushRepository` is safe to call
/// from any context (its suspend functions run on Kotlin's own dispatchers).
extension PushRepository: @unchecked @retroactive Sendable {}
