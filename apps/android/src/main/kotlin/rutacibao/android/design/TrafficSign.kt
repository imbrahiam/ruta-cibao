package rutacibao.android.design

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.GenericShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

/**
 * What a road notice is, as an illustrated icon drawn in code (iOS's `TrafficSignKind`): a striped
 * barricade for a closed road, a cone for a blocked lane, the hazard triangle, a rain cloud for
 * floods, cars for slow traffic, and the rest of the set ready for new categories.
 */
enum class TrafficSignKind(val line: Color, val wash: Color) {
    Closed(Color(0xFFD7352B), Color(0xFFF9C3B6)),
    BlockedLane(Color(0xFFD7352B), Color(0xFFF9C3B6)),
    Pothole(Color(0xFFE39A0C), Color(0xFFF9E0A6)),
    Hazard(Color(0xFFE39A0C), Color(0xFFF9E0A6)),
    Flood(Color(0xFF2F6C96), Color(0xFFC7DDEE)),
    Traffic(Color(0xFFE39A0C), Color(0xFFF9E0A6)),
    Crash(Color(0xFFD7352B), Color(0xFFF9C3B6)),
    Police(Color(0xFF3B5BA8), Color(0xFFCFD9F2));

    /** A closed road's stretch is drawn as a barrier, with a marker at either end too. */
    val striped: Boolean get() = this == Closed || this == BlockedLane

    companion object {
        fun of(category: String, icon: String): TrafficSignKind {
            val key = "$category $icon".lowercase()
            fun has(vararg words: String) = words.any { it in key }
            return when {
                has("bloque", "cerrad", "octagon", "closed") -> Closed
                has("carril", "cone", "lane") -> BlockedLane
                has("hoyo", "bache", "pothole") -> Pothole
                has("inund", "lluvia", "rain", "flood", "water") -> Flood
                has("tapón", "tapon", "lento", "slow", "traffic") -> Traffic
                has("choque", "accidente", "crash") -> Crash
                has("polic", "amet", "police") -> Police
                else -> Hazard
            }
        }
    }
}

/** The illustrated icon alone, for the report grid or a sheet's heading. */
@Composable
fun TrafficSign(kind: TrafficSignKind, size: Dp = 32.dp, modifier: Modifier = Modifier) {
    Canvas(modifier.size(size).clearAndSetSemantics {}) {
        val k = min(this.size.width, this.size.height) / 100f
        translate((this.size.width - 100 * k) / 2, (this.size.height - 100 * k) / 2) {
            scale(k, k, pivot = Offset.Zero) { TrafficArt.draw(this, kind) }
        }
    }
}

/** The icon on its soft disc, as a sheet's heading shows it. */
@Composable
fun TrafficBadge(kind: TrafficSignKind, size: Dp = 44.dp) {
    Box(Modifier.size(size).background(kind.wash, CircleShape), Alignment.Center) { TrafficSign(kind, size * 0.66f) }
}

private val Pointer = GenericShape { s, _ -> moveTo(0f, 0f); lineTo(s.width, 0f); lineTo(s.width / 2, s.height); close() }

/** A notice on the map: its icon in a round marker with a white ring and a short point. */
@Composable
fun TrafficMarker(kind: TrafficSignKind, selected: Boolean = false, small: Boolean = false) {
    val size = if (selected) 50.dp else if (small) 30.dp else 40.dp
    Column(Modifier.padding(4.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy((-1).dp)) {
        Box(Modifier.size(size).shadow(3.dp, CircleShape).background(Color.White, CircleShape).padding(if (small) 2.5.dp else 3.dp).background(kind.wash, CircleShape), Alignment.Center) {
            TrafficSign(kind, size * 0.62f)
        }
        Box(Modifier.size(size * 0.26f, size * 0.18f).offset(y = (-1).dp).background(Color.White, Pointer))
    }
}

/** The drawings on a 100 × 100 grid: flat colours with a dark outline, as on iOS. */
private object TrafficArt {
    val outline = Color(0xFF2B2B2E)
    val red = Color(0xFFE2402F)
    val orange = Color(0xFFF2812B)
    val yellow = Color(0xFFF7C51E)
    val blue = Color(0xFF2F7FD0)
    val navy = Color(0xFF2D4B9A)
    val grey = Color(0xFFA3A9AF)
    val line = Stroke(5f, cap = StrokeCap.Round, join = StrokeJoin.Round)

    fun draw(d: DrawScope, kind: TrafficSignKind) = with(d) {
        when (kind) {
            TrafficSignKind.Closed -> barricade()
            TrafficSignKind.BlockedLane -> cone()
            TrafficSignKind.Pothole -> pothole()
            TrafficSignKind.Hazard -> hazard()
            TrafficSignKind.Flood -> cloud()
            TrafficSignKind.Traffic -> { car(46f, 14f, yellow); car(28f, 36f, orange); car(8f, 58f, red) }
            TrafficSignKind.Crash -> crash()
            TrafficSignKind.Police -> police()
        }
    }

    private fun DrawScope.fillStroke(path: Path, color: Color) { drawPath(path, color); drawPath(path, outline, style = line) }
    private fun rect(x: Float, y: Float, w: Float, h: Float) = Path().apply { addRect(Rect(x, y, x + w, y + h)) }
    private fun round(x: Float, y: Float, w: Float, h: Float, r: Float) = Path().apply { addRoundRect(RoundRect(x, y, x + w, y + h, CornerRadius(r))) }
    private fun oval(x: Float, y: Float, w: Float, h: Float) = Path().apply { addOval(Rect(x, y, x + w, y + h)) }
    private fun poly(vararg p: Float) = Path().apply { moveTo(p[0], p[1]); for (i in 2 until p.size step 2) lineTo(p[i], p[i + 1]); close() }

    private fun DrawScope.barricade() {
        for (x in listOf(26f, 74f)) fillStroke(rect(x - 4, 46f, 8f, 40f), grey)
        val board = round(8f, 22f, 84f, 28f, 5f)
        drawPath(board, Color.White)
        clipPath(board) { var x = -20f; while (x <= 100f) { drawPath(poly(x, 50f, x + 11, 50f, x + 25, 22f, x + 14, 22f), red); x += 22f } }
        drawPath(board, outline, style = line)
    }

    private fun DrawScope.cone() {
        val body = poly(42f, 10f, 58f, 10f, 76f, 80f, 24f, 80f)
        drawPath(body, orange)
        clipPath(body) { drawRect(Color.White, Offset(0f, 32f), Size(100f, 11f)); drawRect(Color.White, Offset(0f, 56f), Size(100f, 11f)) }
        drawPath(body, outline, style = line)
        fillStroke(round(14f, 80f, 72f, 10f, 3f), orange)
    }

    private fun DrawScope.hazard() {
        val tri = poly(50f, 10f, 92f, 84f, 8f, 84f)
        drawPath(tri, yellow); drawPath(tri, outline, style = Stroke(6f, cap = StrokeCap.Round, join = StrokeJoin.Round))
        drawPath(round(45f, 34f, 10f, 28f, 5f), outline)
        drawPath(oval(44.5f, 67f, 11f, 11f), outline)
    }

    private fun DrawScope.pothole() {
        val road = poly(36f, 12f, 64f, 12f, 92f, 88f, 8f, 88f)
        drawPath(road, Color(0xFF6E747B))
        clipPath(road) { for ((y, h) in listOf(14f to 10f, 34f to 13f, 58f to 16f)) drawRect(yellow, Offset(47.5f, y), Size(5f, h)) }
        drawPath(road, outline, style = line)
        val rim = oval(22f, 56f, 44f, 22f)
        drawPath(rim, Color(0xFF9EA4AA)); drawPath(rim, outline, style = Stroke(4f))
        drawPath(oval(28f, 61f, 32f, 14f), outline)
    }

    private fun DrawScope.cloud() {
        val cloud = Path().apply {
            addOval(Rect(10f, 30f, 44f, 60f)); addOval(Rect(28f, 14f, 70f, 54f)); addOval(Rect(54f, 28f, 90f, 60f))
            addRoundRect(RoundRect(20f, 40f, 82f, 60f, CornerRadius(10f)))
        }
        // Stroked wide, then filled again, so only the outer edge of the outline shows.
        drawPath(cloud, outline, style = Stroke(10f, cap = StrokeCap.Round, join = StrokeJoin.Round))
        drawPath(cloud, Color(0xFFD3D8DE))
        for ((x, y) in listOf(30f to 70f, 50f to 74f, 70f to 70f)) drawLine(blue, Offset(x, y), Offset(x - 6, y + 16), 7f, StrokeCap.Round)
    }

    private fun DrawScope.car(x: Float, y: Float, color: Color) {
        fillStroke(poly(x + 8, y + 13, x + 14, y, x + 32, y, x + 38, y + 13), Color(0xFFCFE3F2))
        fillStroke(round(x, y + 12, 46f, 18f, 6f), color)
        for (wx in listOf(x + 6, x + 30)) drawPath(oval(wx, y + 24, 11f, 11f), outline)
    }

    private fun DrawScope.crash() {
        car(2f, 48f, blue); car(52f, 48f, Color(0xFF2FA36B))
        val burst = Path().apply {
            for (i in 0 until 16) {
                val a = i * Math.PI / 8 - Math.PI / 2
                val r = if (i % 2 == 0) 26.0 else 13.0
                val px = (50 + cos(a) * r).toFloat(); val py = (34 + sin(a) * r).toFloat()
                if (i == 0) moveTo(px, py) else lineTo(px, py)
            }
            close()
        }
        fillStroke(burst, yellow)
    }

    private fun DrawScope.police() {
        fillStroke(oval(24f, 36f, 52f, 52f), Color(0xFFC98B5E))
        fillStroke(Path().apply { moveTo(18f, 46f); quadraticTo(50f, 4f, 82f, 46f); close() }, navy)
        drawPath(round(16f, 43f, 68f, 9f, 4f), outline)
        drawPath(oval(44f, 24f, 12f, 12f), yellow)
        for (x in listOf(38f, 56f)) drawPath(oval(x, 60f, 6f, 6f), outline)
        drawPath(Path().apply { moveTo(40f, 74f); quadraticTo(50f, 82f, 60f, 74f) }, outline, style = Stroke(4f, cap = StrokeCap.Round))
    }
}
