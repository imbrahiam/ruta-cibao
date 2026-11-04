package rutacibao.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import rutacibao.android.R

/**
 * The small round "x" of Instagram and Threads sheets: a 30dp disc that reads as chrome,
 * inside a 48dp touch target. [onMedia] is white on a dark translucent disc, for photos.
 */
@Composable
fun CloseButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    onMedia: Boolean = false,
    label: String = stringResource(R.string.common_close),
) {
    val palette = LocalPalette.current
    Box(
        modifier.size(48.dp).clip(CircleShape).clickable(role = Role.Button, onClickLabel = label, onClick = onClick),
        Alignment.Center,
    ) {
        Box(
            Modifier.size(30.dp).background(if (onMedia) Color.Black.copy(alpha = 0.45f) else palette.inset, CircleShape),
            Alignment.Center,
        ) {
            Icon(
                Icons.Filled.Close,
                contentDescription = label,
                Modifier.size(15.dp),
                tint = if (onMedia) Color.White else palette.textSecondary,
            )
        }
    }
}
