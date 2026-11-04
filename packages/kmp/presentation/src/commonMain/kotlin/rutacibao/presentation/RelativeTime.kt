package rutacibao.presentation

import kotlin.time.Clock
import kotlin.time.Instant

/**
 * "hace 3 horas", decided once here; each platform only picks the catalogue
 * string for [unit] (`time.now`, `time.minutes`, `time.hours`, `time.days`).
 */
public data class RelativeTime(val unit: Unit, val value: Int) {
    public enum class Unit { Now, Minutes, Hours, Days }

    public companion object {
        /** Relative to now; the overload Swift calls (no default arguments over ObjC). */
        public fun since(instant: Instant): RelativeTime = of(instant, Clock.System.now())

        public fun of(instant: Instant, now: Instant = Clock.System.now()): RelativeTime {
            val minutes = ((now - instant).inWholeMinutes).coerceAtLeast(0)
            return when {
                minutes < 1 -> RelativeTime(Unit.Now, 0)
                minutes < 60 -> RelativeTime(Unit.Minutes, minutes.toInt())
                minutes < 60 * 24 -> RelativeTime(Unit.Hours, (minutes / 60).toInt())
                else -> RelativeTime(Unit.Days, (minutes / (60 * 24)).toInt())
            }
        }
    }
}
