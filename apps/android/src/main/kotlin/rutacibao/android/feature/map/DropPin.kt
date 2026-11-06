package rutacibao.android.feature.map

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp

private val PinRed = Color(0xFFFF3B30)
private val PinStem = Color(0xFF8E8E93)

/**
 * Apple Maps' marked-location pin (same drawing as iOS): red head, white dot, short stem
 * and a ground shadow. Centred in its parent with the shadow on the exact centre.
 */
@Composable
fun BoxScope.DropPin() {
    Canvas(Modifier.align(Alignment.Center).offset(y = (-24).dp).size(32.dp, 48.dp)) {
        val cx = size.width / 2
        // Ground shadow at the bottom edge, which is the reported point.
        drawOval(Color.Black.copy(alpha = 0.3f), Offset(cx - 5.dp.toPx(), size.height - 4.dp.toPx()), Size(10.dp.toPx(), 4.dp.toPx()))
        // Stem.
        drawRoundRect(PinStem, Offset(cx - 1.5.dp.toPx(), 29.dp.toPx()), Size(3.dp.toPx(), 17.dp.toPx()), CornerRadius(1.5.dp.toPx()))
        // Head: soft shadow, red disc, white ring and dot.
        val head = Offset(cx, 16.dp.toPx())
        drawCircle(Color.Black.copy(alpha = 0.22f), 15.dp.toPx(), head + Offset(0f, 2.dp.toPx()))
        drawCircle(PinRed, 15.dp.toPx(), head)
        drawCircle(Color.White, 14.dp.toPx(), head, style = Stroke(2.dp.toPx()))
        drawCircle(Color.White, 5.dp.toPx(), head)
    }
}
