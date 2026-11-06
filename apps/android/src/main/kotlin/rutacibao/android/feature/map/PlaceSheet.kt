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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.HourglassTop
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import rutacibao.presentation.business.BusinessFormMode
import rutacibao.presentation.business.BusinessState
import rutacibao.presentation.business.Contact
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.navigationBarsPadding
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
import rutacibao.android.ui.CategoryBadge
import rutacibao.android.ui.CloseButton
import rutacibao.android.ui.parseCategoryColor
import androidx.compose.foundation.layout.offset
import rutacibao.android.ui.LocalPalette
import rutacibao.android.ui.PrimaryButton
import rutacibao.api.generated.PlacesDetailOutput
import rutacibao.presentation.map.PlaceSheet
import rutacibao.api.generated.PlacesConfirmInput
import rutacibao.api.generated.PlacesReportInput
import rutacibao.android.feature.comments.PlaceExperiencesSheet

/** Detail URLs may be relative to the API; thumbnails already arrive absolute. */
internal fun absoluteUrl(raw: String?): String? = when {
    raw.isNullOrBlank() -> null
    raw.startsWith("http://") || raw.startsWith("https://") -> raw
    else -> BuildConfig.API_ORIGIN.trimEnd('/') + "/" + raw.trimStart('/')
}

/** A place, Apple Maps style: first frame from the pin, the rest with the detail. One dominant action (directions). */
@Composable
fun PlaceSheet(
    sheet: PlaceSheet,
    onSave: () -> Unit,
    /** Asks to claim; false when sign-in is needed first. */
    onRequestClaim: () -> Boolean,
    onBusinessChanged: () -> Unit,
    onConfirm: (PlacesConfirmInput.Verdict) -> Unit,
    onReport: () -> Unit,
    onReportReason: (PlacesReportInput.Reason) -> Unit,
    onReportDetails: (String) -> Unit,
    onSubmitReport: () -> Unit,
    onCloseReport: () -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val place = sheet.place
    val detail = sheet.detail
    val palette = LocalPalette.current
    val context = LocalContext.current
    var form by remember(place.id) { mutableStateOf<BusinessFormMode?>(null) }
    var experiences by remember(place.id) { mutableStateOf(false) }
    val contact = when (val b = sheet.business) {
        is BusinessState.Listed -> b.contact
        is BusinessState.Owned -> b.contact
        else -> null
    }
    val hero = absoluteUrl(detail?.imageUrl) ?: absoluteUrl(place.thumbnailUrl)
    Column(
        modifier.fillMaxWidth().verticalScroll(rememberScrollState()).navigationBarsPadding().padding(start = 20.dp, end = 20.dp, top = 4.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            CategoryBadge(place.icon, place.color, 48.dp)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(place.name, style = MaterialTheme.typography.titleLarge.copy(fontSize = 22.sp))
                Text(
                    listOfNotNull(place.categoryName, detail?.municipality?.name).joinToString(" · "),
                    style = MaterialTheme.typography.bodyMedium,
                    color = palette.textSecondary,
                )
                if (!sheet.cached) detail?.trust?.let { TrustLine(it.state) }
            }
            CloseButton(onClose, Modifier.offset(x = 8.dp, y = (-6).dp))
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
                tint = parseCategoryColor(place.color, MaterialTheme.colorScheme.primary),
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

        contact?.let { ContactRows(it) }

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
        OutlinedExperiencesButton { experiences = true }
        PlaceFeedback(sheet, onConfirm, onReport)
        when (val b = sheet.business) {
            is BusinessState.Listed -> if (b.canClaim) {
                BusinessRow(Icons.Outlined.Storefront, stringResource(R.string.place_claim_title)) {
                    if (onRequestClaim()) form = BusinessFormMode.Claim
                }
            }
            BusinessState.ClaimPending -> Row(
                Modifier.fillMaxWidth().heightIn(min = 48.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Outlined.HourglassTop, contentDescription = null, Modifier.size(18.dp), tint = palette.textSecondary)
                Text(stringResource(R.string.place_claim_review), style = MaterialTheme.typography.bodyMedium, color = palette.textSecondary)
            }
            is BusinessState.Owned -> BusinessRow(Icons.Outlined.Edit, stringResource(R.string.place_edit_business)) {
                form = BusinessFormMode.Edit
            }
            BusinessState.NotABusiness -> Unit
        }
        if (sheet.loading) {
            Box(Modifier.fillMaxWidth(), Alignment.Center) { CircularProgressIndicator(Modifier.size(28.dp)) }
        }
    }
    form?.let { mode ->
        BusinessFormDialog(place.id, mode, contact, onDone = onBusinessChanged, onDismiss = { form = null })
    }
    if (experiences) PlaceExperiencesSheet(placeSlug = place.slug, placeName = place.name, onDismiss = { experiences = false })
    sheet.report?.let {
        PlaceReportDialog(it, onReportReason, onReportDetails, onSubmitReport, onCloseReport)
    }
}

@Composable
private fun OutlinedExperiencesButton(onClick: () -> Unit) {
    androidx.compose.material3.OutlinedButton(onClick, Modifier.fillMaxWidth().heightIn(min = 56.dp)) {
        Icon(Icons.AutoMirrored.Filled.Chat, contentDescription = null)
        Text(stringResource(R.string.comments_experiences), Modifier.padding(start = 10.dp))
    }
}

/** Call and WhatsApp as pills, hours as one info row. Only what the business published. */
@Composable
private fun ContactRows(contact: Contact) {
    val context = LocalContext.current
    val palette = LocalPalette.current
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        val pills = listOfNotNull(
            contact.phoneLink?.let { Triple(R.string.place_call, Icons.Filled.Call, it) },
            contact.whatsappLink?.let { Triple(R.string.place_whatsapp, Icons.AutoMirrored.Filled.Chat, it) },
        )
        if (pills.isNotEmpty()) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                pills.forEach { (label, icon, link) ->
                    Row(
                        Modifier.weight(1f).heightIn(min = 48.dp).clip(CircleShape).background(palette.fill)
                            .clickable(role = Role.Button) { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(link))) },
                        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(icon, contentDescription = null, Modifier.size(18.dp))
                        Text(stringResource(label), style = MaterialTheme.typography.labelLarge)
                    }
                }
            }
        }
        contact.hours?.let {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Schedule, contentDescription = null, Modifier.size(18.dp), tint = palette.textSecondary)
                Text(it, style = MaterialTheme.typography.bodyMedium, color = palette.textSecondary)
            }
        }
    }
}

/** One quiet trailing row: claim it, or edit what you own. */
@Composable
private fun BusinessRow(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, onClick: () -> Unit) {
    val palette = LocalPalette.current
    Row(
        Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable(role = Role.Button, onClick = onClick),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, Modifier.size(18.dp), tint = palette.textSecondary)
        Text(label, style = MaterialTheme.typography.bodyMedium, color = palette.textSecondary)
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
