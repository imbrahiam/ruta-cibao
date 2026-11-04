import Foundation

extension L10n {
    /// A server-sent message by catalogue key with named params (see
    /// `MessageArgs`). Unknown keys fall back to the generic push text, so a
    /// newer server never shows a raw key.
    static func message(key: String, params: [String: String]) -> String {
        guard let order = MessageArgs.order[key] else { return L10n.Notifications.pushGeneric }
        let format = NSLocalizedString(key, comment: "")
        guard format != key else { return L10n.Notifications.pushGeneric }
        let args: [CVarArg] = order.map { params[$0] ?? "" }
        return String(format: format, arguments: args)
    }
}
