package rutacibao.android.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import rutacibao.android.R

/**
 * The Ruta Cibao mark: the green circle with the winding road, the same
 * drawing iOS and the web use. With [animate] it settles in with a small
 * spring, or simply appears under reduced motion.
 */
@Composable
fun BrandMark(size: Dp, modifier: Modifier = Modifier, animate: Boolean = false) {
    val reduced = LocalReducedMotion.current
    val shown = remember { Animatable(if (animate && !reduced) 0f else 1f) }
    LaunchedEffect(animate, reduced) {
        if (animate && !reduced) shown.animateTo(1f, spring(dampingRatio = 0.7f, stiffness = Spring.StiffnessMediumLow))
        else shown.snapTo(1f)
    }
    Image(
        painter = painterResource(R.drawable.brand_mark),
        contentDescription = null,
        modifier = modifier.size(size).graphicsLayer {
            val scale = 0.85f + 0.15f * shown.value
            scaleX = scale
            scaleY = scale
            alpha = shown.value.coerceIn(0f, 1f)
        },
    )
}
