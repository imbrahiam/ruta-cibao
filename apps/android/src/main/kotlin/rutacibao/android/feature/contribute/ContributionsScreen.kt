package rutacibao.android.feature.contribute

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.luminance
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.filled.AltRoute
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.TextButton
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import rutacibao.android.ui.MessageState
import rutacibao.presentation.contributions.InboxUiState
import rutacibao.presentation.contributions.InboxViewModel
import rutacibao.presentation.contributions.Notice
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import rutacibao.android.ui.RutaHighlight
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.runtime.LaunchedEffect
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

// iOS system colours, so the same kind reads the same on both phones.
private val Indigo = Color(0xFF007AFF)
private val Orange = Color(0xFFFF9500)
private val Green = Color(0xFF34C759)

private enum class Section { Mine, Inbox }

/** "Aportes": start a contribution, and follow the ones you've made and the notices about them. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ContributionsScreen(onStart: (ContributeAction) -> Unit, onOpenConsultation: (String) -> Unit, startOnInbox: Boolean = false, inboxRequest: Long = 0, onOpenHref: (String) -> Unit = {}) {
    val graph = LocalAppGraph.current
    val vm: ContributionsViewModel = rootViewModel("contributions") { graph.viewModels.contributions() }
    val inbox: InboxViewModel = rootViewModel("inbox") { graph.viewModels.inbox() }
    val state by vm.state.collectAsStateWithLifecycle()
    val notices by inbox.state.collectAsStateWithLifecycle()
    var signingIn by rememberSaveable { mutableStateOf(false) }
    var section by rememberSaveable { mutableStateOf(if (startOnInbox) Section.Inbox else Section.Mine) }
    val screenName = stringResource(R.string.contributions_title)
    LaunchedEffect(inboxRequest) {
        if (inboxRequest != 0L) { section = Section.Inbox; inbox.refresh() }
    }

    PullToRefreshBox(
        isRefreshing = state.refreshing,
        onRefresh = { vm.refresh(); inbox.refresh() },
        modifier = Modifier.semantics { paneTitle = screenName },
    ) {
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 24.dp)) {
            item { Spacer(Modifier.height(12.dp)) }
            item { ActionTiles { action -> if (state.signedIn) onStart(action) else signingIn = true } }

            if (state.signedIn) {
                stickyHeader { SectionTabs(section, notices.unread) { section = it } }
                if (section == Section.Mine) item { rutacibao.android.feature.account.PendingContributions(hideWhenEmpty = true) }
                item {
                    Column {
                        if (section == Section.Mine) Mine(state, vm, onOpenConsultation) else Inbox(notices, inbox, onOpenHref)
                    }
                }
            } else {
                item {
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
    }
    if (signingIn && !state.signedIn) SignInDialog(onDismiss = { signingIn = false })
}

/** Mis aportes / Avisos, pinned while the list scrolls. The unread count is in the label, not just a colour. */
@Composable
private fun SectionTabs(selected: Section, unread: Int, onSelect: (Section) -> Unit) {
    val labels = listOf(
        Section.Mine to stringResource(R.string.contributions_mine),
        Section.Inbox to if (unread > 0) stringResource(R.string.contributions_inbox_count, unread.toString()) else stringResource(R.string.contributions_inbox),
    )
    val palette = LocalPalette.current
    Column(Modifier.background(MaterialTheme.colorScheme.background)) {
    Row(Modifier.fillMaxWidth().selectableGroup()) {
        labels.forEach { (section, label) ->
            val isSelected = section == selected
            Box(
                Modifier
                    .weight(1f)
                    .heightIn(min = 48.dp)
                    .selectable(selected = isSelected, role = Role.Tab, onClick = { onSelect(section) }),
                Alignment.Center,
            ) {
                Text(
                    label,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Medium,
                    color = if (isSelected) MaterialTheme.colorScheme.onSurface else palette.textTertiary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (isSelected) Box(Modifier.align(Alignment.BottomCenter).fillMaxWidth().height(2.dp).background(RutaHighlight.selection()))
            }
        }
    }
    Hairline()
    }
}

@Composable
private fun Inbox(state: InboxUiState, vm: InboxViewModel, open: (String) -> Unit) {
    val palette = LocalPalette.current
    when (state.phase) {
        InboxUiState.Phase.Loading -> Box(Modifier.fillMaxWidth().height(120.dp), Alignment.Center) { CircularProgressIndicator() }
        InboxUiState.Phase.Failed -> ErrorState(state.error ?: UiError.Unknown, onRetry = vm::refresh, modifier = Modifier.height(320.dp))
        InboxUiState.Phase.Empty -> MessageState(
            stringResource(R.string.contributions_inbox_empty),
            stringResource(R.string.contributions_inbox_empty_body),
            Modifier.height(320.dp),
            icon = Icons.Filled.Notifications,
        )
        InboxUiState.Phase.Ready -> {
            if (state.unread > 0) {
                Box(Modifier.fillMaxWidth(), Alignment.CenterEnd) {
                    TextButton(onClick = { vm.markRead(null) }, Modifier.heightIn(min = 48.dp).padding(horizontal = 8.dp)) {
                        Text(stringResource(R.string.contributions_mark_all))
                    }
                }
            }
            state.items.forEach { notice ->
                NoticeRow(notice) {
                    vm.markRead(notice.id)
                    notice.href?.let(open)
                }
            }
        }
    }
}

/** One notice: unread shows a dot, heavier text and a spoken "Sin leer"; the target opens on tap. */
@Composable
private fun NoticeRow(notice: Notice, onClick: () -> Unit) {
    val palette = LocalPalette.current
    val context = LocalContext.current
    val (icon, color) = noticeLook(notice.messageKey)
    val unreadLabel = stringResource(R.string.notifications_unread)
    Column {
        Row(
            Modifier
                .fillMaxWidth()
                .clickable(role = Role.Button, onClick = onClick)
                .semantics(mergeDescendants = true) { if (notice.unread) stateDescription = unreadLabel }
                .padding(horizontal = PostInset, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(PostGap),
        ) {
            KindBadge(icon, color, PostAvatar)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(
                    noticeMessage(context, notice.messageKey, notice.params),
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = if (notice.unread) FontWeight.SemiBold else FontWeight.Normal,
                )
                Text(relativeTimeText(notice.createdAt), style = MaterialTheme.typography.bodyMedium, color = palette.textTertiary)
            }
            if (notice.unread) {
                Box(Modifier.padding(top = 6.dp).size(9.dp).background(palette.accent, CircleShape).clearAndSetSemantics { })
            }
        }
        Hairline()
    }
}

private fun noticeLook(key: String): Pair<ImageVector, Color> = when {
    "consultation" in key -> Icons.Filled.ChatBubble to Indigo
    "traffic" in key -> Icons.Filled.Warning to Orange
    "place" in key -> Icons.Filled.LocationOn to Green
    "business" in key -> Icons.Filled.Storefront to Color(0xFFAF52DE)
    "route" in key -> Icons.Filled.AltRoute to Green
    else -> Icons.Filled.Notifications to Color(0xFF8E8E93)
}

/** Three big tiles: icon and label, always both. */
@Composable
private fun ActionTiles(start: (ContributeAction) -> Unit) {
    val dark = isSystemInDarkTheme()
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
                    .clickable(role = Role.Button) { start(action) },
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Box(
                    Modifier.fillMaxWidth().height(72.dp).clip(RoundedCornerShape(18.dp))
                        .background(kindGradient(color)),
                    Alignment.Center,
                ) {
                    Icon(icon, contentDescription = null, Modifier.size(24.dp), tint = if (dark) contrastInk(color) else Color.White)
                }
                Text(
                    stringResource(label),
                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold),
                    textAlign = TextAlign.Center,
                    minLines = 2,
                )
            }
        }
    }
}

@Composable
private fun Mine(state: ContributionsUiState, vm: ContributionsViewModel, open: (String) -> Unit) {
    val palette = LocalPalette.current
    // The tab above already says "Mis aportes"; a second heading would repeat it.
    Spacer(Modifier.height(8.dp))
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
            KindBadge(icon, color, PostAvatar)
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

private fun kindGradient(color: Color) = Brush.linearGradient(listOf(color, Color(
    red = color.red * 0.78f, green = color.green * 0.78f, blue = color.blue * 0.78f, alpha = 1f,
)))

private fun contrastInk(color: Color): Color =
    if ((color.luminance() + 0.05f) / 0.05f > 1.05f / (color.luminance() + 0.05f)) Color.Black else Color.White

@Composable
private fun KindBadge(icon: ImageVector, color: Color, size: androidx.compose.ui.unit.Dp) {
    Box(Modifier.size(size).background(kindGradient(color), CircleShape), Alignment.Center) {
        Icon(icon, contentDescription = null, Modifier.size(18.dp), tint = Color.White)
    }
}
