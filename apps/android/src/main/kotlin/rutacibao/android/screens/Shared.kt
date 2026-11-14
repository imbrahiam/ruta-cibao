package rutacibao.android.screens

import android.content.Context
import android.content.Intent
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.IosShare
import androidx.compose.material.icons.outlined.MoreHoriz
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import coil3.request.ImageRequest
import coil3.request.crossfade
import rutacibao.android.BuildConfig
import rutacibao.android.R
import rutacibao.android.design.Ink
import rutacibao.android.design.Metrics
import rutacibao.android.design.StatusTag
import rutacibao.android.design.Type
import rutacibao.android.design.pressable
import rutacibao.presentation.consultations.ConsultationStatus

internal fun absoluteUrl(raw: String?): String? = when {
    raw.isNullOrBlank() -> null
    raw.startsWith("http://") || raw.startsWith("https://") -> raw
    else -> BuildConfig.API_ORIGIN.trimEnd('/') + "/" + raw.trimStart('/')
}

/** A server image that fades in over paper; a quiet tile while it loads or if it fails. */
@Composable
fun RemoteImage(url: String?, modifier: Modifier = Modifier, description: String? = null) {
    val context = LocalContext.current
    AsyncImage(
        model = ImageRequest.Builder(context).data(absoluteUrl(url)).crossfade(true).build(),
        contentDescription = description,
        contentScale = ContentScale.Crop,
        modifier = modifier.background(Ink.colors.paper3),
    )
}

/** Photos side by side, each a rounded frame; one photo takes the width. */
@Composable
fun PhotoStrip(urls: List<String>, modifier: Modifier = Modifier, height: Dp = 210.dp, onClick: (() -> Unit)? = null) {
    val shape = RoundedCornerShape(Metrics.radiusCard)
    if (urls.size == 1) {
        RemoteImage(urls.first(), modifier.padding(horizontal = Metrics.gutter).fillMaxWidth().height(height).clip(shape).then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier))
    } else {
        LazyRow(modifier, contentPadding = PaddingValues(horizontal = Metrics.gutter), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(urls) { url ->
                RemoteImage(url, Modifier.size(height * 1.25f, height).clip(shape).then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier))
            }
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

/** A case's standing: a dot in the status colour beside its word. */
@Composable
fun StatusBadge(status: ConsultationStatus) {
    val p = Ink.colors
    StatusTag(statusLabel(status), when (status) {
        ConsultationStatus.Open -> p.ink4
        ConsultationStatus.InReview -> p.warning
        ConsultationStatus.Answered, ConsultationStatus.Resolved -> p.success
        ConsultationStatus.Rejected -> p.danger
    })
}

fun shareConsultation(context: Context, title: String, slug: String, label: String) {
    val send = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, "$title\nhttps://rutacibao.do/consultas/$slug")
    }
    context.startActivity(Intent.createChooser(send, label))
}

/** Support, replies, share and the overflow: quiet ink until you act. */
@Composable
fun PostActions(supported: Boolean, supportCount: Int, replies: Int, slug: String, title: String, onSupport: () -> Unit, onReply: () -> Unit, modifier: Modifier = Modifier, onMore: (() -> Unit)? = null) {
    val context = LocalContext.current
    val shareLabel = stringResource(R.string.common_share)
    val beat by animateFloatAsState(if (supported) 1f else 0.92f, spring(dampingRatio = 0.35f), label = "heart")
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        ActionCell(if (supported) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder, stringResource(if (supported) R.string.consultations_supported else R.string.consultations_support), onSupport,
            count = supportCount, tint = if (supported) Ink.colors.danger else Ink.colors.ink3, iconModifier = Modifier.graphicsLayer { scaleX = beat; scaleY = beat })
        ActionCell(Icons.Outlined.ChatBubbleOutline, pluralStringResource(R.plurals.consultations_responses, replies, replies), onReply, count = replies)
        Spacer(Modifier.weight(1f))
        ActionCell(Icons.Outlined.IosShare, shareLabel, { shareConsultation(context, title, slug, shareLabel) })
        if (onMore != null) ActionCell(Icons.Outlined.MoreHoriz, stringResource(R.string.safety_ui_menu_label), onMore)
    }
}

@Composable
private fun ActionCell(icon: ImageVector, label: String, onClick: () -> Unit, count: Int = 0, tint: Color = Ink.colors.ink3, iconModifier: Modifier = Modifier) {
    Row(
        Modifier.defaultMinSize(44.dp, 44.dp).pressable(scale = 0.9f, haptic = true, onClick = onClick).semantics { contentDescription = label }.padding(horizontal = 8.dp).animateContentSize(),
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, iconModifier.size(19.dp), tint = tint)
        if (count > 0) Text("$count", style = Type.callout, color = Ink.colors.ink3)
    }
}
