import ActivityKit
import Foundation

/// Turn-by-turn on the Lock Screen and in the Dynamic Island. Shared by the
/// app (which starts and updates it) and the widget extension (which draws it).
/// Every string arrives localized from the app: the extension has no catalogue.
nonisolated struct NavigationAttributes: ActivityAttributes, Sendable {
    nonisolated struct ContentState: Codable, Hashable, Sendable {
        /// SF Symbol for the next maneuver.
        var symbol: String
        /// "300 m": distance to the next maneuver.
        var stepDistance: String
        var instruction: String
        /// "12 min · 4,2 km".
        var remaining: String
        /// "Llegada 10:55".
        var arrival: String
        var arrived: Bool
    }

    var destination: String
    var walking: Bool
}
