import RutaKit

extension RelativeTime {
    /// "ahora mismo", "hace 3 horas"… The unit is decided in Kotlin.
    var text: String {
        switch unit {
        case .now: L10n.Time.now
        case .minutes: L10n.Time.minutes(count: Int(value))
        case .hours: L10n.Time.hours(count: Int(value))
        case .days: L10n.Time.days(count: Int(value))
        }
    }
}
