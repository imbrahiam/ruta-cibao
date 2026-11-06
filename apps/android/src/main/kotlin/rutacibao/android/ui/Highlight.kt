package rutacibao.android.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ButtonColors
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SwitchColors
import androidx.compose.material3.SwitchDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.toArgb
import rutacibao.android.generated.RutaPalette

/** The app chrome is neutral ink (black on light, white on dark); switches are green and the support heart red. */
object RutaHighlight {
    /** Selected tab or segment: the ink colour. */
    @Composable
    fun selection(): Color = LocalPalette.current.text

    /** A support you gave: red, the same as iOS `systemRed`. */
    @Composable
    fun support(): Color = if (isSystemInDarkTheme()) Color(0xFFFF453A) else Color(0xFFFF3B30)
}

@Composable
fun rutaButtonColors(): ButtonColors = ButtonDefaults.buttonColors(
    containerColor = LocalPalette.current.accent,
    contentColor = LocalPalette.current.onAccent,
    disabledContainerColor = LocalPalette.current.fill,
    disabledContentColor = LocalPalette.current.textSecondary,
)

/** Green when on, like iOS; the knob stays white. */
@Composable
fun rutaSwitchColors(): SwitchColors {
    val green = if (isSystemInDarkTheme()) Color(0xFF30D158) else Color(0xFF34C759)
    return SwitchDefaults.colors(checkedTrackColor = green, checkedThumbColor = Color.White, checkedBorderColor = green)
}

/** A neutral fill that lifts off the page in both schemes (iOS `raised`). */
fun RutaPalette.raised(dark: Boolean): Color = if (dark) fill else inset

/** [color], darkened in steps of the same hue until white text on it reaches 4.5:1. */
fun darkenForWhite(color: Color): Color {
    val hsv = FloatArray(3)
    android.graphics.Color.colorToHSV(color.toArgb(), hsv)
    var c = color
    while (1.05f / (c.luminance() + 0.05f) < 4.5f && hsv[2] > 0.05f) {
        hsv[2] -= 0.02f
        c = Color(android.graphics.Color.HSVToColor(hsv))
    }
    return c
}
