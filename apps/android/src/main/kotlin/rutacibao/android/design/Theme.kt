package rutacibao.android.design

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
 * The Vínculo system, the same values as the iOS app's `Theme.swift`: white surfaces,
 * near-black ink, neutral greys with no tint, and one brand colour (pine) only for the main
 * action, the selected state, links, the logo and the tabs' header block. Light only for now.
 */
@Immutable
data class Palette(
    val ink: Color, val ink2: Color, val ink3: Color, val ink4: Color,
    val paper: Color, val paper2: Color, val paper3: Color, val line: Color, val card: Color,
    val onInk: Color, val success: Color, val warning: Color, val danger: Color,
    /** The main action's fill: the brand's pine. */
    val action: Color,
) {
    /** The brand pine: header blocks, selection, links, the mark. */
    val brand: Color get() = Color(0xFF28594A)
    val brandDeep: Color get() = Color(0xFF1F4739)
    /** The pine's soft wash, for a chosen chip. */
    val brandSoft: Color get() = Color(0xFFE6EFEB)
    /** Support (the heart), filled when given. */
    val heart: Color get() = Color(0xFFE0364A)
    /** Where you are on a map: the system blue every map app uses. */
    val locate: Color get() = Color(0xFF2F6FE4)
}

private val Light = Palette(
    ink = Color(0xFF161718), ink2 = Color(0xFF5C5E62), ink3 = Color(0xFF6A6C71), ink4 = Color(0xFFB4B6BA),
    paper = Color(0xFFFFFFFF), paper2 = Color(0xFFF3F3F4), paper3 = Color(0xFFE8E8EA), line = Color(0xFFE1E1E4), card = Color(0xFFFFFFFF),
    onInk = Color(0xFFFFFFFF), success = Color(0xFF2F7D57), warning = Color(0xFFB87503), danger = Color(0xFFC8372D), action = Color(0xFF28594A),
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
    // Light only until the light look is settled, as on iOS.
    val dark = false
    val p = Light
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
 * A category's colour, folded onto the map's family of tones by hue (the same mapping as
 * iOS's `PinTone`): a solid disc with a white glyph, as on its pin. Neutral is the quiet grey
 * disc for rows that are not about a category; Brand is the pine's soft wash.
 */
enum class Tint(private val tone: Long) {
    Pine(0xFF28594A), Moss(0xFF5E7F2B), Clay(0xFFB5523B), Ochre(0xFF94661A), Sky(0xFF2F6C96), Plum(0xFF7B5596), Slate(0xFF5A5C61),
    /** Eco routes, on the map and in lists. */
    Trail(0xFF2F7D57),
    Brand(0),
    Neutral(0);

    val solid: Color get() = when (this) { Neutral -> Color(0xFF5A5C61); Brand -> Color(0xFF28594A); else -> Color(tone) }
    @Composable fun fill(): Color = when (this) { Neutral -> Ink.colors.paper2; Brand -> Ink.colors.brandSoft; else -> Color(tone) }
    @Composable fun ink(): Color = when (this) { Neutral -> Ink.colors.ink; Brand -> Ink.colors.brandDeep; else -> Color.White }

    companion object {
        /** A category's admin colour, folded onto the nearest tone by hue. Green categories get moss, never the brand's pine. */
        fun of(hex: String?): Tint {
            val rgb = hex?.trim()?.removePrefix("#")?.takeIf { it.length == 6 }?.toIntOrNull(16) ?: return Slate
            val hsv = FloatArray(3)
            android.graphics.Color.RGBToHSV((rgb shr 16) and 0xFF, (rgb shr 8) and 0xFF, rgb and 0xFF, hsv)
            if (hsv[1] < 0.25f) return Slate
            val hue = hsv[0]
            return when { hue < 20f || hue >= 335f -> Clay; hue < 65f -> Ochre; hue < 170f -> Moss; hue < 250f -> Sky; else -> Plum }
        }
    }
}
