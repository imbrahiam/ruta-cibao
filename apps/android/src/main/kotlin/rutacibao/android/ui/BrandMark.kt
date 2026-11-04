package rutacibao.android.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathMeasure
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.Dp
import rutacibao.android.generated.RutaBrand

/** packages/shared/src/brand.ts MARK, viewBox 256. */
private const val MARK_PATH = "M190 106C181 74 158 54 127 54C86 54 54 87 54 128C54 169 86 202 127 202C158 202 182 184 193 154"

@Composable
fun BrandMark(size: Dp, modifier: Modifier = Modifier, color: Color = RutaBrand.iris, animate: Boolean = false) {
    val path = remember { PathParser().parsePathString(MARK_PATH).toPath() }
    val measure = remember { PathMeasure().also { it.setPath(path, false) } }
    val reduced = LocalReducedMotion.current
    val progress = remember { Animatable(if (animate && !reduced) 0f else 1f) }
    LaunchedEffect(animate, reduced) {
        if (animate && !reduced) progress.animateTo(1f, tween(900, easing = FastOutSlowInEasing))
        else progress.snapTo(1f)
    }
    Canvas(modifier.size(size)) {
        val k = this.size.minDimension / 256f
        scale(k, k, pivot = Offset.Zero) {
            val seg = Path()
            measure.getSegment(0f, measure.length * progress.value, seg, true)
            drawPath(seg, color, style = Stroke(width = 32f, cap = StrokeCap.Round, join = StrokeJoin.Round))
            val dot = ((progress.value - 0.8f) / 0.2f).coerceIn(0f, 1f)
            drawCircle(color, radius = 15f * dot, center = Offset(207f, 57f))
        }
    }
}

/**
 * The brand mark as a loading indicator: a faint full stroke underneath and an ink stroke on top.
 * [progress] draws the ink in while pulling (0..1); [spinning] runs a segment around the path
 * while work is in flight; under reduced motion it pulses instead.
 */
@Composable
fun LoadingMark(size: Dp, modifier: Modifier = Modifier, progress: Float = 1f, spinning: Boolean = false) {
    val path = remember { PathParser().parsePathString(MARK_PATH).toPath() }
    val measure = remember { PathMeasure().also { it.setPath(path, false) } }
    val reduced = LocalReducedMotion.current
    val palette = LocalPalette.current
    val ink = palette.text
    val track = palette.hairline
    val transition = rememberInfiniteTransition(label = "loading-mark")
    val phase by transition.animateFloat(
        0f, 1f, infiniteRepeatable(tween(1100, easing = LinearEasing), RepeatMode.Restart), label = "phase",
    )
    val pulse by transition.animateFloat(
        0.55f, 1f, infiniteRepeatable(tween(700, easing = LinearEasing), RepeatMode.Reverse), label = "pulse",
    )
    val running = spinning && !reduced
    Canvas(
        modifier.size(size).graphicsLayer { alpha = if (spinning && reduced) pulse else 1f },
    ) {
        val k = this.size.minDimension / 256f
        val from = if (running) maxOf(0f, phase * 1.35f - 0.35f) else 0f
        val to = if (running) minOf(1f, phase * 1.35f) else progress.coerceIn(0f, 1f)
        val stroke = Stroke(width = 32f, cap = StrokeCap.Round, join = StrokeJoin.Round)
        scale(k, k, pivot = Offset.Zero) {
            drawPath(path, track, style = stroke)
            val seg = Path()
            measure.getSegment(measure.length * from, measure.length * to, seg, true)
            drawPath(seg, ink, style = stroke)
            drawCircle(if (progress >= 1f || spinning) ink else track, radius = 15f, center = Offset(207f, 57f))
        }
    }
}
