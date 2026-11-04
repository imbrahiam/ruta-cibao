package rutacibao.android.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ButtonColors
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.SwitchColors
import androidx.compose.material3.SwitchDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import rutacibao.android.generated.RutaPalette

/**
 * The app colour ("iris"), mirrored from iOS `RutaHighlight`: the one primary action on a
 * screen, where you are (selected tab, segment), what is on (switches). Not on filters, tiles
 * or the location arrow. Primary buttons use [solid] in both modes so white text keeps its contrast.
 */
object RutaHighlight {
    val solid = Color(0xFF7860A8)
    private val lifted = Color(0xFFA58ED8)
    val onSolid = Color.White

    /** Selected tab or segment: lifted in dark mode so it keeps its contrast on black. */
    @Composable
    fun selection(): Color = if (isSystemInDarkTheme()) lifted else solid
}

@Composable
fun rutaButtonColors(): ButtonColors = ButtonDefaults.buttonColors(
    containerColor = RutaHighlight.solid,
    contentColor = RutaHighlight.onSolid,
    disabledContainerColor = RutaHighlight.solid.copy(alpha = 0.35f),
    disabledContentColor = RutaHighlight.onSolid.copy(alpha = 0.8f),
)

@Composable
fun rutaSwitchColors(): SwitchColors = SwitchDefaults.colors(
    checkedTrackColor = RutaHighlight.solid,
    checkedThumbColor = Color.White,
    checkedBorderColor = RutaHighlight.solid,
)

/** A neutral fill that lifts off the page in both schemes (iOS `raised`). */
fun RutaPalette.raised(dark: Boolean): Color = if (dark) fill else inset

/** Black or white, whichever has the higher contrast against [background] (WCAG). */
fun inkOn(background: Color): Color {
    val l = background.luminance()
    val onWhite = 1.05f / (l + 0.05f)
    val onBlack = (l + 0.05f) / 0.05f
    return if (onWhite >= onBlack) Color.White else Color.Black
}
