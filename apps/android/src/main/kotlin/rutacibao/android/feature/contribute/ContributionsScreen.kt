package rutacibao.android.feature.contribute

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import rutacibao.android.R
import rutacibao.android.feature.auth.SignInDialog
import rutacibao.android.feature.consultations.PostAvatar
import rutacibao.android.feature.consultations.PostGap
import rutacibao.android.feature.consultations.PostInset
import rutacibao.android.ui.BrandMark
import rutacibao.android.ui.ErrorState
import rutacibao.android.ui.Hairline
import rutacibao.android.ui.LocalAppGraph
import rutacibao.android.ui.LocalPalette
import rutacibao.android.ui.PrimaryButton
import rutacibao.android.ui.relativeTimeText
import rutacibao.android.ui.rootViewModel
import rutacibao.api.generated.PlacesContributionsItem
import rutacibao.presentation.UiError
import rutacibao.presentation.contributions.ContributionsUiState
import rutacibao.presentation.contributions.ContributionsViewModel

enum class ContributeAction { Consultation, Traffic, Place }

private val Indigo = Color(0xFF5E5CE6)
private val Orange = Color(0xFFFF9500)
private val Green = Color(0xFF30A45A)

/** "Aportes": start a contribution, and follow the ones you've made. */
@Composable
fun ContributionsScreen(onStart: (ContributeAction) -> Unit, onOpenConsultation: (String) -> Unit) {
    val graph = LocalAppGraph.current
    val vm: ContributionsViewModel = rootViewModel("contributions") { graph.viewModels.contributions() }
    val state by vm.state.collectAsStateWithLifecycle()
    var signingIn by rememberSaveable { mutableStateOf(false) }
    val screenName = stringResource(R.string.contributions_title)

    PullToRefreshBox(isRefreshing = state.refreshing, onRefresh = vm::refresh, modifier = Modifier.semantics { paneTitle = screenName }) {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(bottom = 24.dp)) {
            Box(Modifier.fillMaxWidth().padding(top = 12.dp, bottom = 16.dp), Alignment.Center) {
                BrandMark(28.dp, Modifier.semantics { contentDescription = screenName; heading() })
            }
            ActionTiles { action -> if (state.signedIn) onStart(action) else signingIn = true }

            if (state.signedIn) {
                Mine(state, vm, onOpenConsultation)
            } else {
                Column(
                    Modifier.fillMaxWidth().padding(horizontal = 24.dp).padding(top = 36.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    Text(
                        stringResource(R.string.contributions_signed_out_title),
                        style = MaterialTheme.typography.titleLarge.copy(fontSize = 20.sp),
                        textAlign = TextAlign.Center,
                    )
                    PrimaryButton(stringResource(R.string.contributions_sign_in), { signingIn = true }, Modifier.fillMaxWidth())
                }
            }
        }
    }
    if (signingIn && !state.signedIn) SignInDialog(onDismiss = { signingIn = false })
}

/** Three big tiles: icon and label, always both. */
@Composable
private fun ActionTiles(start: (ContributeAction) -> Unit) {
    val palette = LocalPalette.current
    Row(Modifier.padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        listOf(
            Triple(ContributeAction.Consultation, Icons.Filled.ChatBubble to Indigo, R.string.contributions_example_case_title),
            Triple(ContributeAction.Traffic, Icons.Filled.Warning to Orange, R.string.contributions_example_traffic_title),
            Triple(ContributeAction.Place, Icons.Filled.LocationOn to Green, R.string.contributions_example_place_title),
        ).forEach { (action, look, label) ->
            val (icon, color) = look
            Column(
                Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(18.dp))
                    .background(palette.inset)
                    .clickable(role = Role.Button) { start(action) }
                    .padding(horizontal = 6.dp, vertical = 14.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Box(Modifier.size(44.dp).background(color.copy(alpha = 0.14f), CircleShape), Alignment.Center) {
                    Icon(icon, contentDescription = null, Modifier.size(22.dp), tint = color)
                }
                Text(
                    stringResource(label),
                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold),
                    textAlign = TextAlign.Center,
                    minLines = 2,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
private fun Mine(state: ContributionsUiState, vm: ContributionsViewModel, open: (String) -> Unit) {
    val palette = LocalPalette.current
    Text(
        stringResource(R.string.contributions_mine),
        style = MaterialTheme.typography.titleMedium,
        modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 28.dp, bottom = 6.dp).semantics { heading() },
    )
    when (state.phase) {
        ContributionsUiState.Phase.Loading -> Box(Modifier.fillMaxWidth().height(120.dp), Alignment.Center) { CircularProgressIndicator() }
        ContributionsUiState.Phase.Failed -> ErrorState(state.error ?: UiError.Unknown, onRetry = vm::retry, modifier = Modifier.height(320.dp))
        ContributionsUiState.Phase.Empty -> Text(
            stringResource(R.string.contributions_empty),
            style = MaterialTheme.typography.bodyMedium,
            color = palette.textSecondary,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
        )
        ContributionsUiState.Phase.Ready -> state.items.forEach { item ->
            val slug = state.slugFor(item)
            ContributionRow(item, opens = slug != null, onClick = { slug?.let(open) })
        }
    }
}

/** One contribution, in the post style: kind icon, name, kind and status word, time. */
@Composable
private fun ContributionRow(item: PlacesContributionsItem, opens: Boolean, onClick: () -> Unit) {
    val palette = LocalPalette.current
    val (icon, color, kindRes) = when (item.kind) {
        PlacesContributionsItem.Kind.Place -> Triple(Icons.Filled.LocationOn, Green, R.string.contributions_kind_place)
        PlacesContributionsItem.Kind.Report -> Triple(Icons.Filled.Flag, Orange, R.string.contributions_kind_report)
        PlacesContributionsItem.Kind.Photo -> Triple(Icons.Filled.PhotoCamera, Color(0xFF0A84FF), R.string.contributions_kind_photo)
        PlacesContributionsItem.Kind.Traffic -> Triple(Icons.Filled.Warning, Orange, R.string.contributions_kind_traffic)
        PlacesContributionsItem.Kind.Consultation -> Triple(Icons.Filled.ChatBubble, Indigo, R.string.contributions_kind_consultation)
        PlacesContributionsItem.Kind.Claim -> Triple(Icons.Filled.Storefront, Color(0xFFAF52DE), R.string.contributions_kind_claim)
    }
    val statusRes = when (item.status) {
        PlacesContributionsItem.Status.Draft -> R.string.contributions_status_draft
        PlacesContributionsItem.Status.Pending -> R.string.contributions_status_pending
        PlacesContributionsItem.Status.Published -> R.string.contributions_status_published
        PlacesContributionsItem.Status.Rejected -> R.string.contributions_status_rejected
        PlacesContributionsItem.Status.Archived -> R.string.contributions_status_archived
        PlacesContributionsItem.Status.Resolved -> R.string.contributions_status_resolved
        PlacesContributionsItem.Status.Dismissed -> R.string.contributions_status_dismissed
        PlacesContributionsItem.Status.Active -> R.string.contributions_status_active
        PlacesContributionsItem.Status.Cleared -> R.string.contributions_status_cleared
        PlacesContributionsItem.Status.Expired -> R.string.contributions_status_expired
        PlacesContributionsItem.Status.Removed -> R.string.contributions_status_removed
        PlacesContributionsItem.Status.Open -> R.string.contributions_status_open
        PlacesContributionsItem.Status.InReview -> R.string.contributions_status_in_review
        PlacesContributionsItem.Status.Answered -> R.string.contributions_status_answered
        PlacesContributionsItem.Status.Approved -> R.string.contributions_status_approved
    }
    val statusInk = when (item.status) {
        PlacesContributionsItem.Status.Published, PlacesContributionsItem.Status.Resolved, PlacesContributionsItem.Status.Answered,
        PlacesContributionsItem.Status.Approved, PlacesContributionsItem.Status.Active -> palette.successInk
        PlacesContributionsItem.Status.Pending, PlacesContributionsItem.Status.InReview, PlacesContributionsItem.Status.Draft -> palette.warningInk
        PlacesContributionsItem.Status.Rejected, PlacesContributionsItem.Status.Removed -> palette.dangerInk
        else -> palette.textTertiary
    }
    Column {
        Row(
            Modifier
                .fillMaxWidth()
                .then(if (opens) Modifier.clickable(role = Role.Button, onClick = onClick) else Modifier)
                .padding(horizontal = PostInset, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(PostGap),
        ) {
            Box(Modifier.size(PostAvatar).background(color.copy(alpha = 0.16f), CircleShape).clearAndSetSemantics { }, Alignment.Center) {
                Icon(icon, contentDescription = null, Modifier.size(18.dp), tint = color)
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(item.name, style = MaterialTheme.typography.titleSmall, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                    Text(relativeTimeText(item.createdAt), style = MaterialTheme.typography.bodyMedium, color = palette.textTertiary, maxLines = 1)
                }
                Text(
                    buildAnnotatedString {
                        append(stringResource(kindRes))
                        append(" · ")
                        withStyle(SpanStyle(color = statusInk)) { append(stringResource(statusRes)) }
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = palette.textTertiary,
                )
                item.note?.takeIf { it.isNotBlank() }?.let {
                    Text(it, style = MaterialTheme.typography.bodyMedium, color = palette.textSecondary, modifier = Modifier.padding(top = 2.dp))
                }
            }
            if (opens) {
                Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, Modifier.size(20.dp), tint = palette.textTertiary)
            }
        }
        Hairline()
    }
}
