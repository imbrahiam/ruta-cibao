package rutacibao.android.feature.map

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Directions
import androidx.compose.material.icons.filled.HelpOutline
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import rutacibao.android.BuildConfig
import rutacibao.android.R
import rutacibao.android.ui.CategoryAvatar
import rutacibao.android.ui.LocalPalette
import rutacibao.android.ui.PrimaryButton
import rutacibao.api.generated.PlacesDetailOutput
import rutacibao.presentation.map.PlaceSheet

/** Detail URLs may be relative to the API; thumbnails already arrive absolute. */
internal fun absoluteUrl(raw: String?): String? = when {
    raw.isNullOrBlank() -> null
    raw.startsWith("http://") || raw.startsWith("https://") -> raw
    else -> BuildConfig.API_ORIGIN.trimEnd('/') + "/" + raw.trimStart('/')
}

/** A place, Apple Maps style: first frame from the pin, the rest with the detail. One dominant action (directions). */
@Composable
fun PlaceSheet(sheet: PlaceSheet, onSave: () -> Unit, modifier: Modifier = Modifier) {
    val place = sheet.place
    val detail = sheet.detail
    val palette = LocalPalette.current
    val context = LocalContext.current
    val hero = absoluteUrl(detail?.imageUrl) ?: absoluteUrl(place.thumbnailUrl)
    Column(
        modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(start = 20.dp, end = 20.dp, top = 4.dp, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            CategoryAvatar(place.icon, place.color, 44.dp)
            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(place.name, style = MaterialTheme.typography.titleLarge.copy(fontSize = 20.sp))
                Text(
                    listOfNotNull(place.categoryName, detail?.municipality?.name).joinToString(" · "),
                    style = MaterialTheme.typography.bodyMedium,
                    color = palette.textSecondary,
                )
                detail?.trust?.let { TrustLine(it.state) }
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            PrimaryButton(
                text = stringResource(R.string.map_directions),
                onClick = {
                    val uri = Uri.parse("https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}")
                    context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                },
                icon = Icons.Filled.Directions,
                height = 48.dp,
                modifier = Modifier.weight(1f),
            )
            val saveLabel = stringResource(if (sheet.saved) R.string.place_saved_label else R.string.place_save)
            RoundAction(if (sheet.saved) Icons.Filled.Bookmark else Icons.Outlined.BookmarkBorder, saveLabel, onSave)
            val shareLabel = stringResource(R.string.common_share)
            RoundAction(Icons.Outlined.Share, shareLabel) {
                val send = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, "${place.name}\nhttps://rutacibao.do/lugares/${place.slug}")
                }
                context.startActivity(Intent.createChooser(send, shareLabel))
            }
        }

        if (hero != null) {
            AsyncImage(
                model = hero,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxWidth().height(200.dp).clip(RoundedCornerShape(16.dp)).background(palette.inset),
            )
        }
        detail?.description?.takeIf { it.isNotBlank() }?.let {
            Text(it, style = MaterialTheme.typography.bodyMedium.copy(lineHeight = 21.sp))
        }
        detail?.address?.takeIf { it.isNotBlank() }?.let {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Outlined.Place, contentDescription = null, Modifier.size(18.dp), tint = palette.textSecondary)
                Text(it, style = MaterialTheme.typography.bodyMedium, color = palette.textSecondary)
            }
        }
        if (sheet.loading) {
            Box(Modifier.fillMaxWidth(), Alignment.Center) { CircularProgressIndicator(Modifier.size(28.dp)) }
        }
    }
}

@Composable
private fun RoundAction(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, onClick: () -> Unit) {
    Box(
        Modifier.size(48.dp).clip(CircleShape).background(LocalPalette.current.fill).clickable(role = Role.Button, onClickLabel = label, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = label, Modifier.size(22.dp))
    }
}

/** How much neighbours vouch for the place, as icon + words. */
@Composable
private fun TrustLine(state: PlacesDetailOutput.Trust.State) {
    val p = LocalPalette.current
    val (icon, text, ink) = when (state) {
        PlacesDetailOutput.Trust.State.New -> Triple(Icons.Filled.AutoAwesome, R.string.place_trust_new, p.textSecondary)
        PlacesDetailOutput.Trust.State.Confirmed -> Triple(Icons.Filled.CheckCircle, R.string.place_trust_confirmed, p.successInk)
        PlacesDetailOutput.Trust.State.Doubted -> Triple(Icons.Filled.HelpOutline, R.string.place_trust_doubted, p.warningInk)
        PlacesDetailOutput.Trust.State.Established -> Triple(Icons.Filled.Verified, R.string.place_trust_established, p.successInk)
    }
    Row(Modifier.padding(top = 2.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
        Icon(icon, contentDescription = null, Modifier.size(15.dp), tint = ink)
        Text(stringResource(text), style = MaterialTheme.typography.labelMedium, color = ink)
    }
}
