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
