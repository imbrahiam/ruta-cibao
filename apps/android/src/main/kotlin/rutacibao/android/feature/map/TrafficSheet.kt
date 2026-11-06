package rutacibao.android.feature.map

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import rutacibao.android.R
import rutacibao.android.ui.CloseButton
import rutacibao.android.ui.LocalPalette
import androidx.compose.foundation.layout.offset
import rutacibao.android.ui.categoryIcon
import rutacibao.android.ui.parseCategoryColor
import rutacibao.presentation.RelativeTime
import rutacibao.presentation.UiError
import rutacibao.presentation.map.TrafficNotice
import rutacibao.presentation.map.TrafficSeverity
import rutacibao.presentation.map.TrafficVerdict

val TrafficNotice.tint: Color get() = parseCategoryColor(color, Color(0xFF57554F))

/** Blocking roads draw heavier; the sheet says the same in words. */
val TrafficNotice.lineWidthDp: Float get() = if (severity == TrafficSeverity.Blocking) 9f else 5f

private val TrafficSeverity.icon: ImageVector
    get() = when (this) {
        TrafficSeverity.Blocking -> Icons.Filled.Block
        TrafficSeverity.Partial -> Icons.Filled.Speed
        TrafficSeverity.Minor -> Icons.Filled.Warning
    }

private fun TrafficSeverity.label(): Int = when (this) {
    TrafficSeverity.Blocking -> R.string.traffic_severity_blocking
    TrafficSeverity.Partial -> R.string.traffic_severity_partial
    TrafficSeverity.Minor -> R.string.traffic_severity_minor
}

@Composable
private fun RelativeTime.text(): String = when (unit) {
    RelativeTime.Unit.Now -> stringResource(R.string.time_now)
    RelativeTime.Unit.Minutes -> pluralStringResource(R.plurals.time_minutes, value, value)
    RelativeTime.Unit.Hours -> pluralStringResource(R.plurals.time_hours, value, value)
    RelativeTime.Unit.Days -> pluralStringResource(R.plurals.time_days, value, value)
}

/** A road report on the map: a rounded square with a white edge, so it never reads as a place's round pin. */
@Composable
fun TrafficPin(notice: TrafficNotice, selected: Boolean) {
    val size = if (selected) 46.dp else 38.dp
    val shape = RoundedCornerShape(size * 0.28f)
    val label = stringResource(R.string.traffic_sheet_label, notice.categoryName)
    Box(
        Modifier.size(size).background(notice.tint, shape).border(2.5.dp, Color.White, shape).clearAndSetSemantics { contentDescription = label },
        Alignment.Center,
    ) {
        Icon(categoryIcon(notice.icon), contentDescription = null, Modifier.size(if (selected) 24.dp else 20.dp), tint = Color.White)
    }
}

/** What and where, then the one question that matters: two equal answers with the neighbours' counts. */
@Composable
fun TrafficSheet(notice: TrafficNotice, failure: UiError?, onConfirm: (TrafficVerdict) -> Unit, onClose: () -> Unit, modifier: Modifier = Modifier) {
    val palette = LocalPalette.current
    Column(
        modifier.fillMaxWidth().navigationBarsPadding().padding(start = 20.dp, end = 20.dp, top = 0.dp, bottom = 16.dp).underDragHandle(),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(48.dp).background(notice.tint, RoundedCornerShape(14.dp)), Alignment.Center) {
                Icon(categoryIcon(notice.icon), contentDescription = null, Modifier.size(24.dp), tint = Color.White)
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    notice.categoryName,
                    style = MaterialTheme.typography.titleLarge.copy(fontSize = 20.sp, fontWeight = FontWeight.Bold),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    "${notice.municipality} · ${RelativeTime.since(notice.createdAt).text()}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = palette.textSecondary,
                )
                // Only when it says something the title doesn't (a flood that also blocks the road).
                notice.severity?.takeIf { stringResource(it.label()) != notice.categoryName }?.let { severity ->
                    Row(
                        Modifier.padding(top = 4.dp).clip(CircleShape).background(palette.fill).padding(horizontal = 10.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Icon(severity.icon, contentDescription = null, Modifier.size(16.dp))
                        Text(stringResource(severity.label()), style = MaterialTheme.typography.labelLarge)
                    }
                }
            }
            CloseButton(onClose, Modifier.offset(x = 8.dp))
        }
        notice.details?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = palette.textSecondary) }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Answer(stringResource(R.string.traffic_still_short), notice.stillCount, notice.myVerdict == TrafficVerdict.Still, !notice.isMine, Modifier.weight(1f)) {
                onConfirm(TrafficVerdict.Still)
            }
            Answer(stringResource(R.string.traffic_gone_short), notice.clearedCount, notice.myVerdict == TrafficVerdict.Cleared, !notice.isMine, Modifier.weight(1f)) {
                onConfirm(TrafficVerdict.Cleared)
            }
        }
        if (failure != null) {
            Text(
                stringResource(if (failure == UiError.Offline) R.string.common_offline_body else R.string.common_error_body),
                style = MaterialTheme.typography.bodySmall,
                color = palette.warningInk,
            )
        }
    }
}

@Composable
private fun Answer(title: String, count: Int, chosen: Boolean, enabled: Boolean, modifier: Modifier, onClick: () -> Unit) {
    val palette = LocalPalette.current
    val shape = RoundedCornerShape(14.dp)
    val description = "$title, $count"
    // One ladder step above the sheet in dark, with full-strength label text (4.5:1).
    val rest = if (isSystemInDarkTheme()) palette.fillPressed else palette.fill
    Row(
        modifier
            .heightIn(min = 48.dp)
            .clip(shape)
            .background(if (chosen) MaterialTheme.colorScheme.primary.copy(alpha = 0.22f) else rest)
            .then(if (chosen) Modifier.border(2.dp, MaterialTheme.colorScheme.primary, shape) else Modifier)
            .then(if (enabled) Modifier.clickable(role = Role.RadioButton, onClick = onClick) else Modifier)
            .semantics(mergeDescendants = true) { contentDescription = description; selected = chosen; role = Role.RadioButton }
            .padding(vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (chosen) Icon(Icons.Filled.CheckCircle, contentDescription = null, Modifier.size(18.dp))
        Text(title, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center)
        Text("$count", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface)
    }
}
