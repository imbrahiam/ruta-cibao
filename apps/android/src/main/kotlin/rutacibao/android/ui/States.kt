package rutacibao.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Inbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import rutacibao.android.R
import rutacibao.presentation.UiError

@Composable
fun LoadingState(modifier: Modifier = Modifier) {
    SkeletonFeed(count = 3, modifier = modifier)
}

/**
 * Threads' loading rows (mirrors iOS `SkeletonFeed`): a 40dp circle and three soft bars
 * shaped like the content that's coming, instead of a spinner.
 */
@Composable
fun SkeletonFeed(count: Int = 5, modifier: Modifier = Modifier) {
    val label = stringResource(R.string.common_loading)
    val palette = LocalPalette.current
    Column(modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite; contentDescription = label }) {
        repeat(count) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 18.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.size(40.dp).clip(CircleShape).shimmer(palette.inset, palette.fill))
                Column(Modifier.weight(1f).padding(top = 2.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(Modifier.width(120.dp).height(14.dp).clip(RoundedCornerShape(6.dp)).shimmer(palette.inset, palette.fill))
                    Box(Modifier.fillMaxWidth().height(14.dp).clip(RoundedCornerShape(6.dp)).shimmer(palette.inset, palette.fill))
                    Box(Modifier.width(200.dp).height(14.dp).clip(RoundedCornerShape(6.dp)).shimmer(palette.inset, palette.fill))
                }
            }
        }
    }
}

@Composable
fun MessageState(
    title: String,
    body: String?,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    action: (@Composable () -> Unit)? = null,
) {
    Column(
        modifier.fillMaxSize().padding(horizontal = 40.dp, vertical = 32.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        if (icon != null) {
            Box(
                Modifier.size(64.dp).background(MaterialTheme.colorScheme.surfaceVariant, CircleShape),
                Alignment.Center,
            ) {
                Icon(icon, contentDescription = null, Modifier.size(28.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Box(Modifier.size(8.dp))
        }
        Text(
            title,
            style = MaterialTheme.typography.titleLarge,
            textAlign = TextAlign.Center,
            modifier = Modifier.semantics { heading() },
        )
        if (body != null) {
            Text(body, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
        }
        if (action != null) {
            Box(Modifier.size(8.dp))
            action()
        }
    }
}

@Composable
fun TonalAction(text: String, onClick: () -> Unit) {
    FilledTonalButton(onClick = onClick, Modifier.defaultMinSize(minHeight = 48.dp)) {
        Text(text, style = MaterialTheme.typography.labelLarge)
    }
}

@Composable
fun EmptyState(title: String, body: String?, modifier: Modifier = Modifier) {
    MessageState(title, body, modifier, icon = Icons.Outlined.Inbox)
}

@Composable
fun ErrorState(error: UiError, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    val offline = error == UiError.Offline
    MessageState(
        title = stringResource(if (offline) R.string.common_offline else R.string.common_error_title),
        body = stringResource(if (offline) R.string.common_offline_body else R.string.common_error_body),
        modifier = modifier,
        icon = if (offline) Icons.Outlined.CloudOff else Icons.Outlined.ErrorOutline,
    ) {
        TonalAction(stringResource(R.string.common_retry), onRetry)
    }
}
