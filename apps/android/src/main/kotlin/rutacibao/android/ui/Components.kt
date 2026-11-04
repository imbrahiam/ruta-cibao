package rutacibao.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Circle
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.QuestionAnswer
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import rutacibao.android.R
import rutacibao.presentation.consultations.ConsultationStatus

/** Category avatar: 16% wash of the category colour with its glyph. */
@Composable
fun CategoryAvatar(icon: String, hex: String, size: Dp, modifier: Modifier = Modifier) {
    val color = parseCategoryColor(hex, MaterialTheme.colorScheme.onSurfaceVariant)
    Box(modifier.size(size).background(color.copy(alpha = 0.16f), CircleShape), Alignment.Center) {
        Icon(categoryIcon(icon), contentDescription = null, Modifier.size(size * 0.5f), tint = color)
    }
}

@Composable
fun Hairline(modifier: Modifier = Modifier) {
    HorizontalDivider(modifier, thickness = 0.5.dp, color = MaterialTheme.colorScheme.outlineVariant)
}

/** The single dominant action: filled accent, text on onAccent so it reads in both themes. */
@Composable
fun PrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    busy: Boolean = false,
    height: Dp = 52.dp,
    icon: ImageVector? = null,
) {
    Button(
        onClick = { if (!busy) onClick() },
        enabled = enabled,
        shape = CircleShape,
        modifier = modifier.defaultMinSize(minHeight = height),
    ) {
        if (busy) {
            CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
        } else {
            if (icon != null) {
                Icon(icon, contentDescription = null, Modifier.size(18.dp))
                Box(Modifier.size(8.dp))
            }
            Text(text, style = MaterialTheme.typography.titleSmall)
        }
    }
}

@Composable
fun statusLabel(status: ConsultationStatus): String = stringResource(
    when (status) {
        ConsultationStatus.Open -> R.string.consultations_status_label_open
        ConsultationStatus.InReview -> R.string.consultations_status_label_in_review
        ConsultationStatus.Answered -> R.string.consultations_status_label_answered
        ConsultationStatus.Resolved -> R.string.consultations_status_label_resolved
        ConsultationStatus.Rejected -> R.string.consultations_status_label_rejected
    },
)

@Composable
fun statusInk(status: ConsultationStatus): Color {
    val p = LocalPalette.current
    return when (status) {
        ConsultationStatus.Open -> p.textTertiary
        ConsultationStatus.InReview -> p.warningInk
        ConsultationStatus.Answered, ConsultationStatus.Resolved -> p.successInk
        ConsultationStatus.Rejected -> p.dangerInk
    }
}

/** Each status carries its own glyph, so colour is never the only signal. */
@Composable
fun StatusPill(status: ConsultationStatus, modifier: Modifier = Modifier) {
    val ink = if (status == ConsultationStatus.Open) LocalPalette.current.textSecondary else statusInk(status)
    val glyph = when (status) {
        ConsultationStatus.Open -> Icons.Filled.Circle
        ConsultationStatus.InReview -> Icons.Filled.Schedule
        ConsultationStatus.Answered -> Icons.Filled.QuestionAnswer
        ConsultationStatus.Resolved -> Icons.Filled.CheckCircle
        ConsultationStatus.Rejected -> Icons.Filled.Cancel
    }
    Row(
        modifier.clip(CircleShape).background(ink.copy(alpha = 0.1f)).padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(glyph, contentDescription = null, Modifier.size(if (status == ConsultationStatus.Open) 8.dp else 12.dp), tint = ink)
        Text(statusLabel(status), style = MaterialTheme.typography.labelMedium, color = ink, maxLines = 1)
    }
}

/** Tinted inline notice (duplicate report, send errors). */
@Composable
fun Notice(icon: ImageVector, title: String, body: String?, ink: Color, modifier: Modifier = Modifier) {
    Row(
        modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(ink.copy(alpha = 0.1f)).padding(14.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(icon, contentDescription = null, tint = ink)
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, style = MaterialTheme.typography.titleSmall, color = ink)
            if (body != null) Text(body, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
