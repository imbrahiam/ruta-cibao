package rutacibao.android.design

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Water
import androidx.compose.material.icons.outlined.DirectionsCar
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.sqrt

/**
 * What a road notice is, drawn the way the road would sign it (iOS's `TrafficSignKind`): the red
 * octagon for a closed road, the Dominican yellow diamond for hazards.
 */
enum class TrafficSignKind(val line: Color) {
    Closed(Color(0xFFC8372D)), Pothole(Color(0xFFD99A06)), Flood(Color(0xFF2F6C96)), Slow(Color(0xFFD99A06)), Caution(Color(0xFFD99A06));

    companion object {
        fun of(category: String, icon: String): TrafficSignKind {
            val key = "$category $icon".lowercase()
            return when {
                "bloque" in key || "octagon" in key || "closed" in key -> Closed
                "hoyo" in key || "pothole" in key || "triangle" in key -> Pothole
                "inund" in key || "rain" in key || "flood" in key || "water" in key -> Flood
                "lento" in key || "slow" in key -> Slow
                else -> Caution
            }
        }
    }
}

private val SignYellow = Color(0xFFF4C21B)
private val SignInk = Color(0xFF161718)

/** A road sign drawn in code: its shape and rim, and a glyph that says what is on the road. */
@Composable
fun TrafficSign(kind: TrafficSignKind, size: Dp = 32.dp, modifier: Modifier = Modifier) {
    Box(modifier.size(size).clearAndSetSemantics {}, Alignment.Center) {
        Canvas(Modifier.size(size)) {
            if (kind == TrafficSignKind.Closed) {
                drawPath(octagon(0f), Color.White)
                drawPath(octagon(this.size.width * 0.06f), Color(0xFFC8372D))
                drawPath(octagon(this.size.width * 0.12f), Color.White, style = Stroke(this.size.width * 0.035f))
                val bar = Size(this.size.width * 0.52f, this.size.width * 0.14f)
                drawRoundRect(Color.White, Offset((this.size.width - bar.width) / 2, (this.size.height - bar.height) / 2), bar, CornerRadius(this.size.width * 0.04f))
            } else {
                drawPath(diamond(0f), Color.White)
                drawPath(diamond(this.size.width * 0.07f), SignYellow)
                drawPath(diamond(this.size.width * 0.13f), SignInk, style = Stroke(this.size.width * 0.045f))
                if (kind == TrafficSignKind.Pothole) {
                    val w = this.size.width; val h = this.size.height
                    val dip = Path().apply {
                        moveTo(w * 0.27f, h * 0.46f); lineTo(w * 0.39f, h * 0.46f)
                        quadraticTo(w * 0.5f, h * 0.68f, w * 0.61f, h * 0.46f); lineTo(w * 0.73f, h * 0.46f)
                    }
                    drawPath(dip, SignInk, style = Stroke(w * 0.065f, cap = StrokeCap.Round))
                }
            }
        }
        when (kind) {
            TrafficSignKind.Flood -> Icon(Icons.Outlined.Water, null, Modifier.size(size * 0.34f), tint = SignInk)
            TrafficSignKind.Slow -> Icon(Icons.Outlined.DirectionsCar, null, Modifier.size(size * 0.32f), tint = SignInk)
            TrafficSignKind.Caution -> Text("!", color = SignInk, fontSize = (size.value * 0.42f).sp, fontWeight = FontWeight.Black)
            else -> Unit
        }
    }
}

private fun DrawScope.octagon(inset: Float): Path {
    val w = size.width - inset * 2
    val c = w / (2 + sqrt(2f))
    val l = inset; val t = inset; val r = inset + w; val b = inset + w
    return Path().apply {
        moveTo(l + c, t); lineTo(r - c, t); lineTo(r, t + c); lineTo(r, b - c)
        lineTo(r - c, b); lineTo(l + c, b); lineTo(l, b - c); lineTo(l, t + c); close()
    }
}

private fun DrawScope.diamond(inset: Float): Path {
    val l = inset; val t = inset; val r = size.width - inset; val b = size.height - inset
    val cx = (l + r) / 2; val cy = (t + b) / 2
    return Path().apply { moveTo(cx, t); lineTo(r, cy); lineTo(cx, b); lineTo(l, cy); close() }
}
