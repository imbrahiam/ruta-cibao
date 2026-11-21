package rutacibao.android.design

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import rutacibao.android.R

/** Opens the three ways to add something (consultation, road report, place) from any header. */
val LocalContribute = staticCompositionLocalOf<() -> Unit> { {} }

/**
 * A tab's header, as on iOS (`brandHeader`): the brand pine running under the status bar, with
 * rounded bottom corners. The title (or the map's search) and the add button share the first
 * row; the tab's filters sit under it on the green.
 */
@Composable
fun BrandHeader(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(bottomStart = 28.dp, bottomEnd = 28.dp))
            .background(Ink.colors.brand)
            .windowInsetsPadding(WindowInsets.statusBars)
            .padding(top = 6.dp, bottom = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        content = content,
    )
}

/** A root tab's header: its title in white beside the add button, then its filters. */
@Composable
fun RootHeader(title: String, modifier: Modifier = Modifier, filters: (@Composable RowScope.() -> Unit)? = null) {
    BrandHeader(modifier) {
        Row(Modifier.fillMaxWidth().padding(horizontal = Metrics.gutter), verticalAlignment = Alignment.CenterVertically) {
            Text(title, style = Type.display.copy(fontSize = 32.sp), color = Color.White, modifier = Modifier.weight(1f).semantics { heading() })
            ContributeButton()
        }
        if (filters != null) HeaderFilters(content = filters)
    }
}

/** Adding to the map, from any tab's header: the one solid white button on the green. */
@Composable
fun ContributeButton(modifier: Modifier = Modifier) {
    val open = LocalContribute.current
    val label = stringResource(R.string.contributions_contribute)
    Box(
        modifier.size(48.dp).background(Color.White, CircleShape).clip(CircleShape).pressable(haptic = true, onClick = open).semantics { contentDescription = label },
        Alignment.Center,
    ) { Icon(Icons.Outlined.Add, null, Modifier.size(24.dp), tint = Ink.colors.brand) }
}

/** A sideways row of chips on the header that fades at both edges instead of being cut. */
@Composable
fun HeaderFilters(modifier: Modifier = Modifier, content: @Composable RowScope.() -> Unit) {
    Row(
        modifier
            .fillMaxWidth()
            .edgeFade()
            .horizontalScroll(rememberScrollState())
            .padding(PaddingValues(horizontal = Metrics.gutter)),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
        content = content,
    )
}

/** Fades content out over the last few points at each side, so a scrolling row never ends in a hard cut. */
fun Modifier.edgeFade(width: Float = 20f): Modifier =
    graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }.drawWithContent {
        drawContent()
        val fade = width.dp.toPx()
        drawRect(Brush.horizontalGradient(0f to Color.Transparent, fade / size.width to Color.Black, 1f - fade / size.width to Color.Black, 1f to Color.Transparent), blendMode = BlendMode.DstIn)
    }
