package rutacibao.android.navigation

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import rutacibao.android.ui.LocalPalette
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import rutacibao.android.ui.Hairline
import rutacibao.android.ui.RutaHighlight

object TabBarMetrics {
    val Height = 64.dp
    val SideMargin = 16.dp
    val BottomGap = 8.dp

    /** What a screen under the bar reserves above the system navigation inset. */
    val Reserved = Height + BottomGap

    /** X's fixed bar: 50dp of icons above the system navigation inset. */
    val FixedHeight = 50.dp

    fun reserved(style: rutacibao.android.ui.TabBarStyle) =
        if (style == rutacibao.android.ui.TabBarStyle.Fixed) FixedHeight else Reserved
}

/** Screens can ask the tab bar to step aside (an open map sheet covers that edge). */
class TabChrome {
    var hidden by mutableStateOf(false)
}

val LocalTabChrome = staticCompositionLocalOf { TabChrome() }

/** Height the floating bar takes from the bottom edge, system inset included; maps use it to lift their own controls. */
val LocalTabBarClearance = staticCompositionLocalOf { 0.dp }

/**
 * The floating tab bar, shaped like iOS 26's: a capsule over the content, icon and label always
 * visible, every tab in the text colour and the selected one filled, set on a pill and tinted.
 */
@Composable
fun RutaTabBar(selected: Tab, onSelect: (Tab) -> Unit, modifier: Modifier = Modifier) {
    val palette = LocalPalette.current
    Surface(
        modifier = modifier.padding(horizontal = TabBarMetrics.SideMargin).fillMaxWidth().height(TabBarMetrics.Height),
        shape = CircleShape,
        color = palette.glass,
        shadowElevation = 10.dp,
        border = BorderStroke(0.5.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Row(Modifier.padding(horizontal = 4.dp), horizontalArrangement = Arrangement.spacedBy(0.dp), verticalAlignment = Alignment.CenterVertically) {
            Tab.entries.forEach { tab ->
                val isSelected = tab == selected
                val tint = if (isSelected) RutaHighlight.selection() else MaterialTheme.colorScheme.onSurface
                Column(
                    Modifier
                        .weight(1f)
                        .height(TabBarMetrics.Height - 8.dp)
                        .clip(CircleShape)
                        .background(if (isSelected) MaterialTheme.colorScheme.onSurface.copy(alpha = 0.1f) else androidx.compose.ui.graphics.Color.Transparent)
                        .selectable(selected = isSelected, role = Role.Tab, onClick = { onSelect(tab) }),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Icon(if (isSelected) tab.iconSelected else tab.icon, contentDescription = null, Modifier.size(24.dp), tint = tint)
                    Text(
                        stringResource(tab.label),
                        fontSize = 11.sp,
                        lineHeight = 14.sp,
                        fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Medium,
                        color = tint,
                        maxLines = 1,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
            }
        }
    }
}

/**
 * X's bottom bar (mirrors iOS): fixed to the edge, full width, a rule on top, the screen's own
 * background down through the system navigation area, icons only. The selected tab is the filled
 * icon; every icon stays ink, so the state is shape, never colour. TalkBack reads each name.
 */
@Composable
fun FixedTabBar(selected: Tab, onSelect: (Tab) -> Unit, bottomInset: androidx.compose.ui.unit.Dp, modifier: Modifier = Modifier) {
    val palette = LocalPalette.current
    Column(modifier.fillMaxWidth().background(MaterialTheme.colorScheme.background)) {
        Hairline()
        Row(Modifier.fillMaxWidth().height(TabBarMetrics.FixedHeight), verticalAlignment = Alignment.CenterVertically) {
            Tab.entries.forEach { tab ->
                val isSelected = tab == selected
                val label = stringResource(tab.label)
                Box(
                    Modifier
                        .weight(1f)
                        .height(TabBarMetrics.FixedHeight)
                        .selectable(selected = isSelected, role = Role.Tab, onClick = { onSelect(tab) })
                        .semantics { contentDescription = label },
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(if (isSelected) tab.iconSelected else tab.icon, contentDescription = null, Modifier.size(26.dp), tint = palette.text)
                }
            }
        }
        Box(Modifier.fillMaxWidth().height(bottomInset))
    }
}
