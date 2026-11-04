import Foundation
import RutaKit
import Security

/// Kotlin's `SecureStore`, backed by the Keychain. Items are readable after
/// first unlock (background refresh needs the session) and never leave this
/// device, so a restored backup starts signed out.
/// `nonisolated`: Kotlin reads it from coroutine threads (push, session), and
/// the Keychain API is thread-safe, so it must not be pinned to the main actor.
nonisolated final class KeychainSecureStore: NSObject, SecureStore, @unchecked Sendable {
    private let service = Bundle.main.bundleIdentifier ?? "do.rutacibao.app"

    func read(key: String) -> String? {
        var query = base(key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func write(key: String, value: String) {
        let data = Data(value.utf8)
        let status = SecItemUpdate(base(key) as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        guard status == errSecItemNotFound else { return }
        var item = base(key)
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(item as CFDictionary, nil)
    }

    func delete(key: String) {
        SecItemDelete(base(key) as CFDictionary)
    }

    private func base(_ key: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
    }
}
