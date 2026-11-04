package rutacibao.android.ui

import android.icu.text.MeasureFormat
import android.icu.util.Measure
import android.icu.util.MeasureUnit
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.res.stringResource
import java.util.Locale
import kotlin.time.Clock
import kotlin.time.Instant
import rutacibao.android.R

private val AppLocale = Locale.forLanguageTag("es-DO")

/** Threads-style compact age ("5 min", "2 h", "3 sem"): the largest single unit, no "hace". */
@Composable
fun relativeTimeText(instant: Instant): String {
    val now = stringResource(R.string.time_now)
    // The app is Spanish (es-DO) only, whatever the device language.
    return remember(instant, now) { compactAge(instant, Clock.System.now(), AppLocale, now) }
}

internal fun compactAge(instant: Instant, now: Instant, locale: Locale, nowLabel: String): String {
    val seconds = (now - instant).inWholeSeconds.coerceAtLeast(0)
    val (value, unit) = when {
        seconds < 60 -> return nowLabel
        seconds < 3_600 -> seconds / 60 to MeasureUnit.MINUTE
        seconds < 86_400 -> seconds / 3_600 to MeasureUnit.HOUR
        seconds < 7 * 86_400 -> seconds / 86_400 to MeasureUnit.DAY
        seconds < 30 * 86_400 -> seconds / (7 * 86_400) to MeasureUnit.WEEK
        seconds < 365 * 86_400 -> seconds / (30 * 86_400) to MeasureUnit.MONTH
        else -> seconds / (365 * 86_400) to MeasureUnit.YEAR
    }
    return MeasureFormat.getInstance(locale, MeasureFormat.FormatWidth.SHORT).format(Measure(value, unit)).trimEnd('.').replace(" sems", " sem")
}
