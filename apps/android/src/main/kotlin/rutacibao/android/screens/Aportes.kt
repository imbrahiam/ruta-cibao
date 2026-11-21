package rutacibao.android.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.outlined.*
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.MoveToInbox
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.ui.graphics.Color
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import rutacibao.android.R
import rutacibao.android.app.LocalBarClearance
import rutacibao.android.design.*
import rutacibao.android.platform.lastKnownLocation
import rutacibao.android.platform.noticeMessage
import rutacibao.android.platform.relativeTimeText
import rutacibao.api.generated.PlacesContributionsItem
import rutacibao.presentation.UiError
import rutacibao.presentation.consultations.NewConsultationUiState
import rutacibao.presentation.consultations.NewConsultationViewModel
import rutacibao.presentation.contribute.SuggestPlaceUiState
import rutacibao.presentation.contribute.SuggestPlaceViewModel
import rutacibao.presentation.contribute.TrafficReportViewModel
import rutacibao.presentation.contributions.ContributionsUiState
import rutacibao.presentation.contributions.ContributionsViewModel
import rutacibao.presentation.contributions.InboxUiState
import rutacibao.presentation.contributions.InboxViewModel

enum class ContributeAction(val title: Int, val detail: Int, val icon: ImageVector, val tint: Tint) {
    Consultation(R.string.contributions_example_case_title, R.string.contributions_example_case_body, Icons.Outlined.ChatBubbleOutline, Tint.Neutral),
    Traffic(R.string.contributions_example_traffic_title, R.string.contributions_example_traffic_body, Icons.Outlined.WarningAmber, Tint.Neutral),
    Place(R.string.contributions_example_place_title, R.string.contributions_example_place_body, Icons.Outlined.Place, Tint.Neutral),
}

/**
 * The three ways to add something, opened from the add button in every header (iOS's
 * `ContributeSheet`): grey blocks with a glyph, a title and one line, no rules between them.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ContributeSheet(onDismiss: () -> Unit, onChoose: (ContributeAction) -> Unit) {
    val p = Ink.colors
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = p.paper, dragHandle = { androidx.compose.material3.BottomSheetDefaults.DragHandle(color = p.ink4) }) {
        Text(stringResource(R.string.contributions_contribute), style = Type.bodyStrong, color = p.ink, modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        Column(Modifier.padding(horizontal = 16.dp).padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            ContributeAction.entries.forEachIndexed { index, action ->
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(Metrics.radiusCard)).background(p.paper2).pressable(scale = 0.98f) { onChoose(action) }.padding(14.dp).rise(index),
                    horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically,
                ) {
                    GlyphDisc(action.icon, size = 48.dp, tint = Tint.Neutral)
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(stringResource(action.title), style = Type.bodyStrong, color = p.ink)
                        Text(stringResource(action.detail), style = Type.callout, color = p.ink3, maxLines = 2)
                    }
                    Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, null, Modifier.size(18.dp), tint = p.ink4)
                }
            }
        }
    }
}

/** What a resident sent and what came back: their contributions and their notices, under the green header. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ContributionsScreen(onOpenConsultation: (String) -> Unit, startOnInbox: Boolean, inboxRequest: Long, onOpenHref: (String) -> Unit) {
    val graph = LocalAppGraph.current
    val vm: ContributionsViewModel = rootViewModel("contributions") { graph.viewModels.contributions() }
    val inboxVm: InboxViewModel = rootViewModel("inbox") { graph.viewModels.inbox() }
    val state by vm.state.collectAsStateWithLifecycle()
    val inbox by inboxVm.state.collectAsStateWithLifecycle()
    var onInbox by rememberSaveable { mutableStateOf(startOnInbox) }
    var signingIn by remember { mutableStateOf(false) }
    val contribute = rutacibao.android.design.LocalContribute.current
    LaunchedEffect(inboxRequest) { if (inboxRequest != 0L) { onInbox = true; inboxVm.refresh() } }
    val p = Ink.colors

    Column(Modifier.fillMaxSize().background(p.paper)) {
        RootHeader(stringResource(R.string.contributions_title), filters = if (!state.signedIn) null else ({
            Chip(stringResource(R.string.contributions_mine), !onInbox, { onInbox = false }, onBrand = true)
            Chip(stringResource(R.string.contributions_inbox), onInbox, { onInbox = true }, onBrand = true, badge = inbox.unread.toInt())
            if (onInbox && inbox.unread > 0) {
                Spacer(Modifier.weight(1f))
                Box(
                    Modifier.size(44.dp).clip(CircleShape).pressable { inboxVm.markRead(null) },
                    Alignment.Center,
                ) {
                    Box(Modifier.size(34.dp).background(Color.White.copy(alpha = 0.14f), CircleShape), Alignment.Center) {
                        Icon(Icons.Outlined.Check, stringResource(R.string.notifications_mark_all_read), Modifier.size(16.dp), tint = Color.White)
                    }
                }
            }
        }))
        PullToRefreshBox(isRefreshing = state.refreshing, onRefresh = { vm.refresh(); inboxVm.refresh() }, modifier = Modifier.weight(1f).fillMaxWidth()) {
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(top = 6.dp, bottom = LocalBarClearance.current + 24.dp)) {
                if (!state.signedIn) {
                    item {
                        StateView(stringResource(R.string.contributions_signed_out_title), Modifier.height(380.dp), message = stringResource(R.string.contributions_signed_out_body),
                            action = stringResource(R.string.contributions_sign_in), prominent = true, onAction = { signingIn = true })
                    }
                } else if (!onInbox) when (state.phase) {
                    ContributionsUiState.Phase.Loading -> item { LoadingDots(Modifier.height(200.dp)) }
                    ContributionsUiState.Phase.Failed -> item { ErrorView(state.error ?: UiError.Unknown, Modifier.height(280.dp), vm::retry) }
                    ContributionsUiState.Phase.Empty -> item {
                        StateView(stringResource(R.string.contributions_empty), Modifier.height(280.dp), message = stringResource(R.string.contributions_empty_body),
                            action = stringResource(R.string.contributions_contribute), onAction = contribute)
                    }
                    ContributionsUiState.Phase.Ready -> items(state.items, key = { "${it.kind}:${it.id}" }) { item ->
                        val slug = state.slugFor(item)
                        MineRow(item, enabled = slug != null || item.href != null) { if (slug != null) onOpenConsultation(slug) else item.href?.let(onOpenHref) }
                    }
                } else when (inbox.phase) {
                    InboxUiState.Phase.Loading -> item { LoadingDots(Modifier.height(200.dp)) }
                    InboxUiState.Phase.Failed -> item { ErrorView(inbox.error ?: UiError.Unknown, Modifier.height(280.dp), inboxVm::refresh) }
                    InboxUiState.Phase.Empty -> item { StateView(stringResource(R.string.contributions_inbox_empty), Modifier.height(280.dp), icon = Icons.Outlined.Inbox, message = stringResource(R.string.contributions_inbox_empty_body)) }
                    InboxUiState.Phase.Ready -> items(inbox.items, key = { it.id }) { notice ->
                        val context = LocalContext.current
                        Row(
                            Modifier.fillMaxWidth().clickable { inboxVm.markRead(notice.id); notice.consultationSlug?.let(onOpenConsultation) ?: notice.href?.let(onOpenHref) }
                                .padding(horizontal = Metrics.gutter, vertical = 10.dp),
                            horizontalArrangement = Arrangement.spacedBy(14.dp),
                        ) {
                            Box {
                                GlyphDisc(notice.categoryIcon?.let(::categoryIcon) ?: Icons.Outlined.Notifications, tint = Tint.Neutral)
                                if (notice.unread) Box(Modifier.align(Alignment.TopEnd).size(11.dp).background(p.paper, CircleShape).padding(2.dp).background(p.brand, CircleShape))
                            }
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                                Text(remember(notice) { noticeMessage(context, notice.messageKey, notice.params) }, style = if (notice.unread) Type.bodyStrong else Type.body, color = if (notice.unread) p.ink else p.ink2)
                                Text(relativeTimeText(notice.createdAt), style = Type.caption, color = p.ink3)
                            }
                        }
                    }
                }
            }
        }
    }
    if (signingIn && !state.signedIn) SignInDialog(onDismiss = { signingIn = false })
}

@Composable
private fun MineRow(item: PlacesContributionsItem, enabled: Boolean, onClick: () -> Unit) {
    val p = Ink.colors
    val kind = stringResource(when (item.kind) {
        PlacesContributionsItem.Kind.Place -> R.string.contributions_kind_place
        PlacesContributionsItem.Kind.Report -> R.string.contributions_kind_report
        PlacesContributionsItem.Kind.Photo -> R.string.contributions_kind_photo
        PlacesContributionsItem.Kind.Traffic -> R.string.contributions_kind_traffic
        PlacesContributionsItem.Kind.Consultation -> R.string.contributions_kind_consultation
        PlacesContributionsItem.Kind.Claim -> R.string.contributions_kind_claim
    })
    val consultation = item.kind == PlacesContributionsItem.Kind.Consultation
    val status = stringResource(when (item.status) {
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
        PlacesContributionsItem.Status.Open -> if (consultation) R.string.consultations_status_label_open else R.string.contributions_status_open
        PlacesContributionsItem.Status.InReview -> R.string.contributions_status_in_review
        PlacesContributionsItem.Status.Answered -> if (consultation) R.string.consultations_status_label_answered else R.string.contributions_status_answered
        PlacesContributionsItem.Status.Approved -> R.string.contributions_status_approved
    })
    val color = when (item.status) {
        PlacesContributionsItem.Status.Published, PlacesContributionsItem.Status.Resolved, PlacesContributionsItem.Status.Answered, PlacesContributionsItem.Status.Approved, PlacesContributionsItem.Status.Active -> p.success
        PlacesContributionsItem.Status.Pending, PlacesContributionsItem.Status.InReview, PlacesContributionsItem.Status.Draft -> p.warning
        PlacesContributionsItem.Status.Rejected, PlacesContributionsItem.Status.Removed -> p.danger
        else -> p.ink3
    }
    // The same glyphs as a consultation's state, so a state reads alike everywhere.
    val glyph = when (item.status) {
        PlacesContributionsItem.Status.Published, PlacesContributionsItem.Status.Approved, PlacesContributionsItem.Status.Active, PlacesContributionsItem.Status.Resolved -> Icons.Filled.CheckCircle
        PlacesContributionsItem.Status.Answered -> Icons.Filled.ChatBubble
        PlacesContributionsItem.Status.Pending, PlacesContributionsItem.Status.InReview -> Icons.Filled.Visibility
        PlacesContributionsItem.Status.Draft -> Icons.Filled.Edit
        PlacesContributionsItem.Status.Open -> Icons.Filled.MoveToInbox
        PlacesContributionsItem.Status.Rejected, PlacesContributionsItem.Status.Removed -> Icons.Filled.Cancel
        else -> Icons.Filled.Schedule
    }
    Row(
        Modifier.fillMaxWidth().clickable(enabled = enabled, onClick = onClick).padding(horizontal = Metrics.gutter, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically,
    ) {
        GlyphDisc(categoryIcon(item.categoryIcon), tint = Tint.Neutral)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(item.name, style = Type.bodyStrong, color = p.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text("$kind · ${relativeTimeText(item.createdAt)}", style = Type.callout, color = p.ink3)
            // The team's reason, when they left one.
            val note = item.note
            if (!note.isNullOrBlank()) Text(note, style = Type.callout, color = p.ink2, maxLines = 3, modifier = Modifier.padding(top = 2.dp))
        }
        StatusTag(status, color, glyph)
    }
}

// ------------------------------------------------------------------ forms

@Composable
private fun FormError(error: UiError?) {
    if (error != null) Text(stringResource(if (error == UiError.Offline) R.string.common_offline else R.string.common_error_title), style = Type.callout, color = Ink.colors.danger)
}

/** Opening a consultation: what happens, where, and a photo if it helps. */
@Composable
fun NewConsultationScreen(onBack: () -> Unit, onOpened: (String) -> Unit) {
    val graph = LocalAppGraph.current
    val vm: NewConsultationViewModel = viewModel { graph.viewModels.consultationComposer() }
    val state by vm.state.collectAsStateWithLifecycle()
    LaunchedEffect(state.openedSlug) { state.openedSlug?.let(onOpened) }
    if (state.submitted && state.openedSlug == null) {
        SentView(stringResource(R.string.offline_queued_toast), stringResource(R.string.offline_queued_toast_body), onBack)
        return
    }
    FormScreen(stringResource(R.string.consultations_new_title), stringResource(if (state.error != null) R.string.common_retry else R.string.consultations_submit), onBack, vm::send, sending = state.sending, enabled = state.canSend) {
        Field(state.title, vm::updateTitle, stringResource(R.string.consultations_title_label))
        Field(state.body, vm::updateBody, stringResource(R.string.consultations_body_label), minLines = 5, maxLines = 12)
        FormLabel(stringResource(R.string.consultations_category), NewConsultationUiState.Problem.Category in state.problems)
        ChoiceFlow(state.categories, state.categories.firstOrNull { it.id == state.categoryId }, { it.name }, { categoryIcon(it.icon) }) { vm.selectCategory(it.id) }
        FormLabel(stringResource(R.string.consultations_municipality), NewConsultationUiState.Problem.Municipality in state.problems)
        ChoiceFlow(state.municipalities, state.municipalities.firstOrNull { it.id == state.municipalityId }, { it.name }) { vm.selectMunicipality(it.id) }
        FormLabel(stringResource(R.string.consultations_location))
        LocationField(state.latitude, state.longitude, stringResource(R.string.consultations_add_location), vm::setLocation)
        PhotoTray(state.photos.map { it.jpeg }, NewConsultationUiState.MAX_PHOTOS, vm::addPhoto, vm::removePhoto)
        FormError(state.error)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(Icons.Outlined.Visibility, null, Modifier.size(15.dp), tint = Ink.colors.ink3)
            Text(stringResource(R.string.consultations_public_note), style = Type.caption, color = Ink.colors.ink3)
        }
    }
    if (state.signInRequested) SignInDialog(onDismiss = vm::signInHandled)
}

/** Something on the road right now: what it is and where, in two taps. */
@Composable
fun TrafficReportScreen(onBack: () -> Unit, onSent: () -> Unit) {
    val graph = LocalAppGraph.current
    val vm: TrafficReportViewModel = viewModel { graph.viewModels.trafficReport() }
    val state by vm.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val p = Ink.colors
    // A road report is almost always about where you are standing.
    LaunchedEffect(Unit) { if (state.latitude == null) lastKnownLocation(context)?.let { vm.setLocation(it.latitude, it.longitude) } }
    if (state.sent) {
        SentView(stringResource(if (state.queued) R.string.offline_queued_toast else R.string.contribute_traffic_sent), stringResource(if (state.queued) R.string.offline_queued_toast_body else R.string.contribute_traffic_sent_body)) { onSent(); onBack() }
        return
    }
    FormScreen(stringResource(R.string.contribute_traffic_title), stringResource(R.string.contribute_traffic_submit), onBack, vm::send, sending = state.sending, enabled = state.canSend) {
        // What is on the road, as a grid of the same icons the map draws.
        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            state.categories.chunked(3).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    row.forEach { category ->
                        val selected = category.id == state.categoryId
                        Column(
                            Modifier.weight(1f).pressable(haptic = true) { vm.selectCategory(category.id) },
                            verticalArrangement = Arrangement.spacedBy(8.dp), horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Box(Modifier.size(76.dp)) {
                                Box(
                                    Modifier.fillMaxSize().background(p.paper2, CircleShape).then(if (selected) Modifier.border(3.dp, p.action, CircleShape) else Modifier),
                                    Alignment.Center,
                                ) { TrafficSign(TrafficSignKind.of(category.name, category.icon), 42.dp) }
                                if (selected) Icon(Icons.Filled.CheckCircle, null, Modifier.align(Alignment.TopEnd).size(22.dp).background(p.paper, CircleShape), tint = p.action)
                            }
                            Text(
                                category.name, style = Type.callout.copy(fontWeight = if (selected) androidx.compose.ui.text.font.FontWeight.SemiBold else androidx.compose.ui.text.font.FontWeight.Normal),
                                color = p.ink, maxLines = 2, textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                            )
                        }
                    }
                    repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
                }
            }
        }
        LocationField(state.latitude, state.longitude, stringResource(R.string.contribute_place_location), vm::setLocation)
        Field(state.description, vm::updateDescription, stringResource(R.string.contribute_traffic_description), maxLines = 4)
        if (state.duplicate) Notice(Icons.Outlined.Group, stringResource(R.string.contribute_traffic_duplicate), stringResource(R.string.contribute_traffic_duplicate_body)) else FormError(state.error)
    }
}

/** A place the map is missing: its name, what it is, where, and a photo. */
@Composable
fun SuggestPlaceScreen(onBack: () -> Unit, onSent: () -> Unit) {
    val graph = LocalAppGraph.current
    val vm: SuggestPlaceViewModel = viewModel { graph.viewModels.suggestPlace() }
    val state by vm.state.collectAsStateWithLifecycle()
    if (state.sent) {
        SentView(stringResource(if (state.queued) R.string.offline_queued_toast else R.string.contribute_place_sent), stringResource(if (state.queued) R.string.offline_queued_toast_body else R.string.contribute_place_sent_body)) { onSent(); onBack() }
        return
    }
    if (state.pendingLimit) {
        Column(Modifier.fillMaxSize().background(Ink.colors.paper)) {
            TopRow(stringResource(R.string.contribute_place_title), onBack, backIcon = Icons.Outlined.Close)
            StateView(stringResource(R.string.contribute_place_pending_title), Modifier.weight(1f), icon = Icons.Outlined.Schedule, message = stringResource(R.string.contribute_place_pending_body))
        }
        return
    }
    @Composable fun problem(kind: SuggestPlaceUiState.Problem, text: Int) {
        if (kind in state.problems) Text(stringResource(text), style = Type.caption, color = Ink.colors.danger)
    }
    FormScreen(stringResource(R.string.contribute_place_title), stringResource(R.string.contribute_place_submit), onBack, vm::send, sending = state.sending) {
        Field(state.name, vm::updateName, stringResource(R.string.contribute_place_name))
        problem(SuggestPlaceUiState.Problem.Name, R.string.contribute_place_errors_name)
        Field(state.description, vm::updateDescription, stringResource(R.string.contribute_place_description), minLines = 3, maxLines = 8)
        problem(SuggestPlaceUiState.Problem.Description, R.string.contribute_place_errors_description)
        MenuField(stringResource(R.string.contribute_place_category), state.categories, state.categories.firstOrNull { it.id == state.categoryId }, { it.name }, { categoryIcon(it.icon) }, SuggestPlaceUiState.Problem.Category in state.problems) { vm.selectCategory(it.id) }
        LocationField(state.latitude, state.longitude, stringResource(R.string.contribute_place_location), vm::setLocation)
        problem(SuggestPlaceUiState.Problem.Location, R.string.contribute_place_errors_location)
        Field(state.address, vm::updateAddress, stringResource(R.string.contribute_place_address))
        PhotoTray(state.photos.map { it.jpeg }, SuggestPlaceUiState.MAX_PHOTOS, vm::addPhoto, vm::removePhoto)
        FormError(state.error)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(Icons.Outlined.Schedule, null, Modifier.size(15.dp), tint = Ink.colors.ink3)
            Text(stringResource(R.string.contribute_review_note), style = Type.caption, color = Ink.colors.ink3)
        }
    }
}
