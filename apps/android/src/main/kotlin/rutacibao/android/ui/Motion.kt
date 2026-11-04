package rutacibao.android.ui

import android.provider.Settings
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

/** True when the system asks for no animation (developer scale 0 or "remove animations"). */
val LocalReducedMotion = compositionLocalOf { false }

@Composable
fun rememberReducedMotion(): Boolean {
    val resolver = LocalContext.current.contentResolver
    return remember {
        runCatching { Settings.Global.getFloat(resolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f }
            .getOrDefault(false)
    }
}

/** Placeholder block: sweeping highlight when motion is allowed, flat tone otherwise. */
fun Modifier.shimmer(base: Color, highlight: Color): Modifier = composed {
    if (LocalReducedMotion.current) {
        drawWithContent { drawRect(base) }
    } else {
        val x by rememberInfiniteTransition(label = "shimmer").animateFloat(
            initialValue = -1f,
            targetValue = 2f,
            animationSpec = infiniteRepeatable(tween(1400, easing = LinearEasing), RepeatMode.Restart),
            label = "shimmer-x",
        )
        drawWithContent {
            val w = size.width.coerceAtLeast(1f)
            drawRect(
                Brush.linearGradient(
                    listOf(base, highlight, base),
                    start = Offset(w * x, 0f),
                    end = Offset(w * (x + 1f), 0f),
                ),
            )
        }
    }
}
