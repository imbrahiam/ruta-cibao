package rutacibao.android.design

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.viewmodel.compose.viewModel
import rutacibao.shared.AppGraph

val LocalAppGraph = staticCompositionLocalOf<AppGraph> { error("AppGraph not provided") }

/** The activity's store, for view models several screens share. */
val LocalRootOwner = staticCompositionLocalOf<ViewModelStoreOwner> { error("Root owner not provided") }

@Composable
inline fun <reified VM : ViewModel> rootViewModel(key: String, noinline create: () -> VM): VM =
    viewModel(viewModelStoreOwner = LocalRootOwner.current, key = key, initializer = { create() })

/**
 * Paper and ink, taken from the landing page (`apps/web/src/app/globals.css`): warm paper
 * surfaces, near-black ink, and colour kept for meaning only. Dark follows the system.
 */
@Immutable
data class Palette(
    val ink: Color, val ink2: Color, val ink3: Color, val ink4: Color,
    val paper: Color, val paper2: Color, val paper3: Color, val line: Color, val card: Color,
    val onInk: Color, val success: Color, val warning: Color, val danger: Color,
    /** The main action's fill: the mark's iris taken down to a deep indigo; light at night, like ink. */
    val action: Color,
) {
    /** The brand iris: the mark's field, tints and links. */
    val iris: Color get() = Color(0xFF7860A8)
}

// Every neutral leans a little toward the mark's iris, so black, grey and silver belong to
// the logo's family; the paper is its warm counterpart, cream.
private val Light = Palette(
    ink = Color(0xFF17151C), ink2 = Color(0xFF55515E), ink3 = Color(0xFF6E6A78), ink4 = Color(0xFFB4B0BC),
    paper = Color(0xFFFAF8F4), paper2 = Color(0xFFF2EEE7), paper3 = Color(0xFFE8E3DA), line = Color(0xFFDDD7CC), card = Color(0xFFFFFFFF),
    onInk = Color(0xFFFAF8F4), success = Color(0xFF3F7D5A), warning = Color(0xFFB07A1F), danger = Color(0xFFC4473F), action = Color(0xFF44367C),
)

private val Dark = Palette(
    ink = Color(0xFFF3F1F6), ink2 = Color(0xFFB6B2BF), ink3 = Color(0xFF9995A3), ink4 = Color(0xFF58545F),
    paper = Color(0xFF121116), paper2 = Color(0xFF26242C), paper3 = Color(0xFF302E37), line = Color(0xFF35323D), card = Color(0xFF1D1B22),
    onInk = Color(0xFF17151C), success = Color(0xFF7FBF98), warning = Color(0xFFE0B45A), danger = Color(0xFFEE7A70), action = Color(0xFFF3F1F6),
)

val LocalPalette = staticCompositionLocalOf { Light }

/** `Ink.colors.paper`, anywhere in composition. */
object Ink {
    val colors: Palette
        @Composable @ReadOnlyComposable get() = LocalPalette.current
}

/** The landing's type: light weights, tight tracking on large sizes, small quiet captions. */
object Type {
    val display = TextStyle(fontSize = 34.sp, lineHeight = 38.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.02).em)
    val title = TextStyle(fontSize = 22.sp, lineHeight = 27.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.02).em)
    val heading = TextStyle(fontSize = 17.sp, lineHeight = 22.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-0.02).em)
    val body = TextStyle(fontSize = 16.sp, lineHeight = 23.sp, fontWeight = FontWeight.Normal, letterSpacing = (-0.005).em)
    val bodyStrong = body.copy(fontWeight = FontWeight.Medium)
    val callout = TextStyle(fontSize = 14.sp, lineHeight = 19.sp, fontWeight = FontWeight.Normal)
    val label = callout.copy(fontWeight = FontWeight.Medium)
    val caption = TextStyle(fontSize = 12.5.sp, lineHeight = 16.sp, fontWeight = FontWeight.Normal)
}

object Metrics {
    val gutter = 20.dp
    val radiusField = 14.dp
    val radiusCard = 18.dp
    val radiusPanel = 26.dp
}

@Composable
fun RutaTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    val p = if (dark) Dark else Light
    // Material's scheme is derived from the palette so stock parts (sheets, menus, switches) match.
    val scheme = (if (dark) darkColorScheme() else lightColorScheme()).copy(
        primary = p.action, onPrimary = p.onInk, primaryContainer = p.paper2, onPrimaryContainer = p.ink,
        secondaryContainer = p.paper2, onSecondaryContainer = p.ink,
        background = p.paper, onBackground = p.ink, surface = p.paper, onSurface = p.ink,
        surfaceVariant = p.paper2, onSurfaceVariant = p.ink3,
        surfaceContainerLowest = p.card, surfaceContainerLow = p.paper, surfaceContainer = p.card, surfaceContainerHigh = p.card, surfaceContainerHighest = p.paper2,
        outline = p.line, outlineVariant = p.line, error = p.danger, onError = Color.White,
    )
    CompositionLocalProvider(LocalPalette provides p) {
        MaterialTheme(colorScheme = scheme, typography = Typography(bodyLarge = Type.body, bodyMedium = Type.callout, labelLarge = Type.label, titleLarge = Type.title), content = content)
    }
}

/**
 * The accents, built around the iris: its lavender, its complement (straw), and the quiet
 * neighbours: sage, denim, dusty rose, camel. A soft fill with a deep glyph, and one solid
 * mid-tone for map markers.
 */
enum class Tint(private val lightFill: Long, private val lightInk: Long, private val darkFill: Long, private val darkInk: Long, private val solidTone: Long) {
    Mint(0xFFE3EADB, 0xFF4F6645, 0xFF2A3324, 0xFFB7CFA6, 0xFF6B8A5E),
    Butter(0xFFF6ECC9, 0xFF7A6428, 0xFF3A321C, 0xFFE3CB8E, 0xFFB8922E),
    Lavender(0xFFEAE4F6, 0xFF5F4A8C, 0xFF2F2840, 0xFFC7B5E6, 0xFF7860A8),
    Denim(0xFFDDE6F1, 0xFF3D5A80, 0xFF22304A, 0xFFA9C1E6, 0xFF4A6FA5),
    Rose(0xFFF4E1E1, 0xFF96505A, 0xFF40262B, 0xFFE8B4BC, 0xFFB9667A),
    Camel(0xFFEFDFC9, 0xFF8A5F2E, 0xFF3B2C1B, 0xFFE0BE94, 0xFFA9753C),
    Neutral(0, 0, 0, 0, 0xFF5A5665);

    val solid: Color get() = Color(solidTone)
    @Composable fun fill(): Color = if (this == Neutral) Ink.colors.paper2 else Color(if (isSystemInDarkTheme()) darkFill else lightFill)
    @Composable fun ink(): Color = if (this == Neutral) Ink.colors.ink else Color(if (isSystemInDarkTheme()) darkInk else lightInk)

    companion object {
        /** A category's admin colour, folded onto the nearest landing accent by hue. */
        fun of(hex: String?): Tint {
            val rgb = hex?.trim()?.removePrefix("#")?.takeIf { it.length == 6 }?.toIntOrNull(16) ?: return Neutral
            val hsv = FloatArray(3)
            android.graphics.Color.RGBToHSV((rgb shr 16) and 0xFF, (rgb shr 8) and 0xFF, rgb and 0xFF, hsv)
            if (hsv[1] < 0.25f) return Neutral
            val hue = hsv[0]
            return when { hue < 18f || hue >= 325f -> Rose; hue < 42f -> Camel; hue < 70f -> Butter; hue < 175f -> Mint; hue < 255f -> Denim; else -> Lavender }
        }
    }
}
