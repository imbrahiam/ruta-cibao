package rutacibao.android.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import rutacibao.android.generated.RutaPalette
import rutacibao.android.generated.RutaTheme
import rutacibao.android.generated.rutaPalette
import rutacibao.shared.AppGraph

val LocalAppGraph = staticCompositionLocalOf<AppGraph> { error("AppGraph not provided") }
val LocalPalette = staticCompositionLocalOf<RutaPalette> { error("RutaPalette not provided") }

/**
 * The generated palette is the source of truth; Material's colour scheme is
 * derived from it so stock components (chips, bars, sheets) match the theme.
 */
@Composable
fun RutaAppTheme(theme: RutaTheme = RutaTheme.Clasico, content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    val p = rutaPalette(theme, dark)
    val base = if (dark) darkColorScheme() else lightColorScheme()
    val scheme = base.copy(
        primary = p.accent,
        onPrimary = p.onAccent,
        primaryContainer = p.accentSoft,
        onPrimaryContainer = p.text,
        // Selected chips stay a neutral fill; the blue is for actions only (mirrors iOS).
        secondaryContainer = p.fill,
        onSecondaryContainer = p.text,
        background = p.background,
        onBackground = p.text,
        surface = p.background,
        onSurface = p.text,
        surfaceVariant = p.inset,
        onSurfaceVariant = p.textSecondary,
        surfaceContainerLow = p.surface,
        surfaceContainer = p.surface,
        surfaceContainerHigh = p.elevated,
        surfaceContainerHighest = p.fill,
        outline = p.separator,
        outlineVariant = p.hairline,
        error = p.danger,
        onError = p.onStatus,
        scrim = p.scrim,
    )
    val reduced = rememberReducedMotion()
    CompositionLocalProvider(LocalPalette provides p, LocalReducedMotion provides reduced) {
        MaterialTheme(colorScheme = scheme, typography = RutaTypography, content = content)
    }
}
