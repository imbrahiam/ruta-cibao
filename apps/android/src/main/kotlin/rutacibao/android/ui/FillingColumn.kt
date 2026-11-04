package rutacibao.android.ui

import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.layoutId
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

private const val GROW = "grow"

/** Marks the one child of [FillingColumn] that takes the free height. */
fun Modifier.grow(): Modifier = layoutId(GROW)

/**
 * A scrolling column that is at least as tall as its viewport: the child marked [grow] takes the
 * leftover height (never less than [growMin]), so the form fills the screen and scrolls only when
 * it must, e.g. with the keyboard open.
 */
@Composable
fun FillingColumn(
    padding: PaddingValues,
    spacing: Dp,
    growMin: Dp,
    content: @Composable () -> Unit,
) {
    BoxWithConstraints(Modifier.fillMaxSize().padding(padding)) {
        val viewport = maxHeight - 32.dp
        Layout(
            content = content,
            modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp),
        ) { measurables, constraints ->
            val gap = spacing.roundToPx()
            val loose = Constraints(maxWidth = constraints.maxWidth)
            val growing = measurables.firstOrNull { it.layoutId == GROW }
            val fixed = measurables.filter { it !== growing }.associateWith { it.measure(loose) }
            val used = fixed.values.sumOf { it.height } + gap * (measurables.size - 1)
            val growHeight = maxOf(growMin.roundToPx(), viewport.roundToPx() - used)
            val grown = growing?.measure(Constraints(maxWidth = constraints.maxWidth, minHeight = growHeight, maxHeight = growHeight))
            val height = used + (grown?.height ?: 0)
            layout(constraints.maxWidth, height) {
                var y = 0
                for (m in measurables) {
                    val p = if (m === growing) grown!! else fixed.getValue(m)
                    p.placeRelative(0, y)
                    y += p.height + gap
                }
            }
        }
    }
}
