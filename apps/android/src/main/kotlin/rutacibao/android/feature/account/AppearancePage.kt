package rutacibao.android.feature.account

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.outlined.Circle
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import rutacibao.android.R
import rutacibao.android.ui.Hairline
import rutacibao.android.ui.LocalPalette
import rutacibao.android.ui.PushedScreen
import rutacibao.android.ui.TabBarStyle
import rutacibao.android.ui.UiPrefs

/**
 * Cuenta › Apariencia (mirrors iOS): which bottom bar the app uses. Each option shows a small
 * sketch of itself, its name and one line on what it does; the chosen one carries a filled check
 * (shape, not only colour).
 */
@Composable
fun AppearancePage(onBack: () -> Unit) {
    val palette = LocalPalette.current
    PushedScreen(title = stringResource(R.string.appearance_title), onBack = onBack) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState())) {
            Text(
                stringResource(R.string.appearance_tab_bar),
                style = MaterialTheme.typography.titleSmall.copy(fontSize = 15.sp, fontWeight = FontWeight.SemiBold),
                color = palette.textSecondary,
                modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 4.dp).semantics { heading() },
            )
            Column(Modifier.selectableGroup()) {
                TabBarStyle.entries.forEach { option ->
                    val selected = option == UiPrefs.tabBarStyle
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .selectable(selected = selected, role = Role.RadioButton, onClick = { UiPrefs.chooseTabBarStyle(option) })
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(14.dp),
                    ) {
                        TabBarSketch(option)
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(
                                stringResource(if (option == TabBarStyle.Floating) R.string.appearance_floating else R.string.appearance_fixed),
                                style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.SemiBold),
                            )
                            Text(
                                stringResource(if (option == TabBarStyle.Floating) R.string.appearance_floating_body else R.string.appearance_fixed_body),
                                style = MaterialTheme.typography.bodyMedium,
                                color = palette.textSecondary,
                            )
                        }
                        Icon(
                            if (selected) Icons.Filled.CheckCircle else Icons.Outlined.Circle,
                            contentDescription = null,
                            Modifier.size(26.dp),
                            tint = if (selected) palette.accentInk else palette.textDisabled,
                        )
                    }
                    Hairline()
                }
            }
        }
    }
}

/** A thumbnail of the bottom of a screen with the bar drawn in it. */
@Composable
private fun TabBarSketch(style: TabBarStyle) {
    val palette = LocalPalette.current
    val dots: @Composable () -> Unit = {
        Row(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) {
            repeat(4) { Box(Modifier.size(5.dp).background(palette.textSecondary, CircleShape)) }
        }
    }
    Box(Modifier.width(64.dp).height(48.dp).clip(RoundedCornerShape(10.dp)).background(palette.inset), contentAlignment = Alignment.BottomCenter) {
        when (style) {
            TabBarStyle.Floating -> Box(
                Modifier
                    .padding(bottom = 6.dp)
                    .height(14.dp)
                    .clip(CircleShape)
                    .background(palette.background)
                    .border(0.5.dp, palette.fill, CircleShape)
                    .padding(horizontal = 8.dp),
                contentAlignment = Alignment.Center,
            ) { dots() }
            TabBarStyle.Fixed -> Column(Modifier.fillMaxWidth().background(palette.background)) {
                Box(Modifier.fillMaxWidth().height(0.5.dp).background(palette.fill))
                Box(Modifier.fillMaxWidth().height(14.dp), contentAlignment = Alignment.Center) { dots() }
            }
        }
    }
}
