package rutacibao.android.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.animation.animateContentSize
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.sp
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import java.text.DateFormat
import java.util.Date
import rutacibao.android.R
import rutacibao.android.app.LocalBarClearance
import rutacibao.android.design.*
import rutacibao.android.platform.relativeTimeText
import rutacibao.api.generated.ConsultationsDetailOutput
import rutacibao.api.generated.ConsultationsRespondInput
import rutacibao.data.Comment
import rutacibao.presentation.UiError
import rutacibao.presentation.comments.CommentSubject
import rutacibao.presentation.comments.CommentsUiState
import rutacibao.presentation.comments.CommentsViewModel
import rutacibao.presentation.consultations.Consultation
import rutacibao.presentation.consultations.ConsultationDetail
import rutacibao.presentation.consultations.ConsultationDetailUiState
import rutacibao.presentation.consultations.ConsultationDetailViewModel
import rutacibao.presentation.consultations.ConsultationStatus
import rutacibao.presentation.consultations.ConsultationsUiState
import rutacibao.presentation.consultations.ConsultationsViewModel
import rutacibao.presentation.consultations.statusValue
import rutacibao.presentation.gestion.StepUpError
import rutacibao.presentation.gestion.StepUpState
import rutacibao.presentation.safety.ReportReason
import rutacibao.presentation.safety.SafetyViewModel

/** The public feed of consultations: what neighbours asked and where each one stands. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConsultationsScreen(onOpen: (String) -> Unit, onCompose: () -> Unit) {
    val graph = LocalAppGraph.current
    val vm: ConsultationsViewModel = viewModel { graph.viewModels.consultations() }
    val state by vm.state.collectAsStateWithLifecycle()
    val signedIn by graph.session.isSignedIn.collectAsStateWithLifecycle()
    var composeAfterSignIn by remember { mutableStateOf(false) }
    var menuFor by remember { mutableStateOf<Consultation?>(null) }
    LaunchedEffect(signedIn, composeAfterSignIn) { if (signedIn && composeAfterSignIn) { composeAfterSignIn = false; onCompose() } }
    val compose = { if (signedIn) onCompose() else composeAfterSignIn = true }
    val list = rememberLazyListState()
    val nearEnd by remember { derivedStateOf { (list.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0) >= list.layoutInfo.totalItemsCount - 3 } }
    LaunchedEffect(nearEnd, state.items.size) { if (nearEnd && state.phase == ConsultationsUiState.Phase.Ready) vm.loadMore() }

    // The newest cases with a picture lead the page, only on the unfiltered feed; the list skips them.
    val featured = if (state.status == null) state.items.filter { !it.photos.isNullOrEmpty() }.take(6) else emptyList()
    val listed = state.items.filter { item -> featured.none { it.id == item.id } }

    Column(Modifier.fillMaxSize().background(Ink.colors.paper)) {
        RootHeader(stringResource(R.string.consultations_title)) {
            Chip(stringResource(R.string.consultations_all_tab), state.status == null, { vm.selectStatus(null) }, onBrand = true)
            ConsultationStatus.entries.forEach { status -> Chip(statusLabel(status), state.status == status, { vm.selectStatus(status) }, onBrand = true) }
        }
        PullToRefreshBox(isRefreshing = state.refreshing, onRefresh = vm::refresh, modifier = Modifier.weight(1f).fillMaxWidth()) {
            LazyColumn(Modifier.fillMaxSize(), state = list, contentPadding = PaddingValues(bottom = LocalBarClearance.current + 24.dp)) {
                when (state.phase) {
                    ConsultationsUiState.Phase.Loading -> {
                        if (state.status == null) {
                            item { SectionTitle(stringResource(R.string.explore_highlights)) }
                            item { FeaturedSkeleton() }
                            item { SectionTitle(stringResource(R.string.consultations_more)) }
                        } else item { Spacer(Modifier.height(12.dp)) }
                        item { RowSkeleton(4, showsStatus = state.status == null) }
                    }
                    ConsultationsUiState.Phase.Failed -> item { ErrorView(state.error ?: UiError.Unknown, Modifier.height(360.dp), vm::retry) }
                    ConsultationsUiState.Phase.Empty -> item {
                        StateView(stringResource(R.string.consultations_empty), Modifier.height(360.dp), icon = Icons.Outlined.ChatBubbleOutline, message = stringResource(R.string.consultations_empty_body), action = stringResource(R.string.consultations_new), onAction = compose)
                    }
                    ConsultationsUiState.Phase.Ready -> {
                        if (featured.isNotEmpty()) {
                            item(key = "featured-title") { SectionTitle(stringResource(R.string.explore_highlights)) }
                            item(key = "featured") {
                                LazyRow(Modifier.edgeFade(), contentPadding = PaddingValues(horizontal = Metrics.gutter), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                                    items(featured, key = { it.id }) { item -> FeatureCard(item) { onOpen(item.slug) } }
                                }
                            }
                            item(key = "more-title") { SectionTitle(stringResource(R.string.consultations_more)) }
                        } else {
                            item(key = "top") { Spacer(Modifier.height(12.dp)) }
                        }
                        // Filtered by a state, every row has it: saying it again on each is noise.
                        items(listed, key = { it.id }) { item -> CompactRow(item, showsStatus = state.status == null) { onOpen(item.slug) } }
                        if (state.loadingMore) item { RowSkeleton(1, showsStatus = state.status == null) }
                    }
                }
            }
        }
    }
    menuFor?.let { item -> PostMenu(item.id, item.slug, item.title, onHidden = { vm.hiddenChanged(item.id) }, onDismiss = { menuFor = null }) }
    if (state.signInRequested) SignInDialog(onDismiss = vm::signInHandled)
    if (composeAfterSignIn && !signedIn) SignInDialog(onDismiss = { composeAfterSignIn = false })
}

@Composable
private fun SectionTitle(text: String) {
    Text(text, style = Type.title, color = Ink.colors.ink, modifier = Modifier.padding(start = Metrics.gutter, end = Metrics.gutter, top = 26.dp, bottom = 12.dp).semantics { heading() })
}

/** A case with a picture, as a large card in the opening carousel: words on a scrim at its foot. */
@Composable
private fun FeatureCard(item: Consultation, onOpen: () -> Unit) {
    Box(Modifier.width(264.dp).height(248.dp).clip(RoundedCornerShape(22.dp)).pressable(scale = 0.98f, onClick = onOpen)) {
        RemoteImage(item.photos?.firstOrNull()?.url, Modifier.fillMaxSize())
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0.42f to Color.Transparent, 1f to Color.Black.copy(alpha = 0.78f))))
        Box(Modifier.align(Alignment.TopStart).padding(12.dp)) { StatusBadge(item.statusValue, solid = true) }
        Column(Modifier.align(Alignment.BottomStart).padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(item.title, style = Type.heading.copy(fontSize = 19.sp), color = Color.White, maxLines = 3)
            Text("${item.categoryName} · ${relativeTimeText(item.createdAt)}", style = Type.callout, color = Color.White.copy(alpha = 0.86f))
        }
    }
}

/** A case in the list: its picture or category beside its title, where and when, and where it stands. */
@Composable
private fun CompactRow(item: Consultation, showsStatus: Boolean, onOpen: () -> Unit) {
    val p = Ink.colors
    Row(Modifier.fillMaxWidth().clickable(onClick = onOpen).padding(horizontal = Metrics.gutter, vertical = 9.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        val photo = item.photos?.firstOrNull()?.url
        Box(Modifier.size(76.dp).clip(RoundedCornerShape(12.dp)).background(p.paper2), Alignment.Center) {
            if (photo != null) RemoteImage(photo, Modifier.fillMaxSize())
            else Icon(categoryIcon(item.categoryIcon), null, Modifier.size(26.dp), tint = p.ink2)
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(item.title, style = Type.bodyStrong, color = p.ink, maxLines = 2, overflow = TextOverflow.Ellipsis)
            // Which ayuntamiento it was raised with matters as much as the topic.
            Text("${item.categoryName} · ${item.municipalityName} · ${relativeTimeText(item.createdAt)}", style = Type.callout, color = p.ink3, maxLines = 2)
            if (showsStatus) Box(Modifier.padding(top = 2.dp)) { StatusBadge(item.statusValue) }
        }
    }
}

// ------------------------------------------------------------------ detail

/** One consultation as a thread: the question, the ayuntamiento's answers, the neighbours' replies. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConsultationDetailScreen(slug: String, onBack: () -> Unit) {
    val graph = LocalAppGraph.current
    val vm: ConsultationDetailViewModel = viewModel(key = "detail:$slug") { graph.viewModels.consultationDetail().also { it.load(slug) } }
    val state by vm.state.collectAsStateWithLifecycle()
    val commentsVm: CommentsViewModel = viewModel(key = "comments:$slug") { graph.viewModels.comments().also { it.load(CommentSubject.Consultation, slug) } }
    val comments by commentsVm.state.collectAsStateWithLifecycle()
    val detail = state.detail
    var replying by rememberSaveable(slug) { mutableStateOf(false) }
    var menu by remember { mutableStateOf(false) }
    val pending = detail?.publicationStatus == ConsultationsDetailOutput.PublicationStatus.Pending
    val canReply = !pending || state.canRespond
    val startReply = { if (state.canRespond || comments.signedIn) replying = true else commentsVm.requestSignIn() }

    Column(Modifier.fillMaxSize().background(Ink.colors.paper)) {
        TopRow("", onBack) { if (detail != null) IconDisc(Icons.Outlined.MoreHoriz, stringResource(R.string.safety_ui_menu_label), { menu = true }) }
        Box(Modifier.weight(1f)) {
            when (state.phase) {
                ConsultationDetailUiState.Phase.Loading -> DetailSkeleton()
                ConsultationDetailUiState.Phase.NotFound -> StateView(stringResource(R.string.consultations_missing), Modifier.fillMaxSize(), icon = Icons.Outlined.ChatBubbleOutline)
                ConsultationDetailUiState.Phase.Failed -> ErrorView(state.error ?: UiError.Unknown, Modifier.fillMaxSize(), vm::retry)
                ConsultationDetailUiState.Phase.Ready -> if (detail != null) {
                    PullToRefreshBox(isRefreshing = state.refreshing, onRefresh = { vm.refresh(); commentsVm.refresh() }) {
                        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 24.dp)) {
                            item(key = "post") { Original(detail, detail.responses.size + comments.total, vm::toggleSupport) { if (canReply) startReply() } }
                            items(detail.responses, key = { "official:${it.id}" }) { OfficialReply(it.author ?: stringResource(R.string.comments_official_badge), it.body, relativeTimeText(it.createdAt)) }
                            if (pending) {
                                item(key = "review") {
                                    Row(Modifier.padding(horizontal = Metrics.gutter, vertical = 20.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Outlined.Schedule, null, Modifier.size(18.dp), tint = Ink.colors.ink3)
                                        Text(stringResource(R.string.contribute_review_note), style = Type.callout, color = Ink.colors.ink3)
                                    }
                                }
                            } else commentRows(comments, commentsVm, emptyNote = detail.responses.isEmpty())
                        }
                    }
                }
            }
        }
        if (state.phase == ConsultationDetailUiState.Phase.Ready && canReply) {
            Row(
                Modifier.padding(horizontal = 16.dp, vertical = 8.dp).fillMaxWidth().height(52.dp).floating(CircleShape).clip(CircleShape).pressable(scale = 0.98f, onClick = startReply).padding(start = 20.dp, end = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(stringResource(if (state.canRespond) R.string.comments_reply_placeholder else R.string.comments_placeholder), style = Type.body, color = Ink.colors.ink3, modifier = Modifier.weight(1f))
                Box(Modifier.size(32.dp).background(Ink.colors.action, CircleShape), Alignment.Center) { Icon(Icons.Outlined.ArrowUpward, null, Modifier.size(16.dp), tint = Ink.colors.onInk) }
            }
        }
    }
    if (replying) ReplySheet(state, vm, comments, commentsVm) { replying = false }
    if (menu && detail != null) PostMenu(detail.id, detail.slug, detail.title, onHidden = onBack, onDismiss = { menu = false })
    if (state.signInRequested) SignInDialog(onDismiss = vm::signInHandled)
    if (comments.signInRequested) SignInDialog(onDismiss = { commentsVm.signInHandled(); commentsVm.refresh(); vm.refresh() })
    StepUpSheet(state.stepUp, vm::verifyStepUp, vm::useRecoveryCode, vm::dismissStepUp)
}

@Composable
private fun Original(detail: ConsultationDetail, replies: Int, onSupport: () -> Unit, onReply: () -> Unit) {
    val p = Ink.colors
    Column {
        // Corners, as on iOS: state top-left, time top-right, so the title is the first thing read;
        // who and where close the block.
        Row(Modifier.padding(horizontal = Metrics.gutter).padding(top = 4.dp).rise(0), verticalAlignment = Alignment.CenterVertically) {
            StatusBadge(detail.statusValue)
            Spacer(Modifier.weight(1f))
            Text(relativeTimeText(detail.createdAt), style = Type.caption, color = p.ink3)
        }
        Text(detail.title, style = Type.title, color = p.ink, modifier = Modifier.padding(horizontal = Metrics.gutter).padding(top = 12.dp).rise(1))
        Text(detail.body, style = Type.body.copy(lineHeight = Type.body.lineHeight * 1.08f), color = p.ink, modifier = Modifier.padding(horizontal = Metrics.gutter).padding(top = 8.dp).rise(2))
        Row(Modifier.padding(horizontal = Metrics.gutter).padding(top = 16.dp).rise(3), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Avatar(detail.openedBy, 28.dp)
            Text(
                listOf(if (detail.isMine) stringResource(R.string.consultations_you) else detail.openedBy ?: stringResource(R.string.traffic_resident), detail.municipalityName).joinToString(" · "),
                style = Type.callout, color = p.ink2, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
            Row(Modifier.height(28.dp).background(p.paper2, CircleShape).padding(horizontal = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(categoryIcon(detail.categoryIcon), null, Modifier.size(13.dp), tint = p.ink2)
                Text(detail.categoryName, style = Type.caption, color = p.ink2, maxLines = 1)
            }
        }
        val photos = detail.photos.orEmpty()
        if (photos.isNotEmpty()) PhotoStrip(photos.map { it.url }, Modifier.padding(top = 16.dp).rise(4), height = 240.dp)
        PostActions(detail.supported, detail.supportCount.toInt(), replies, detail.slug, detail.title, onSupport, onReply, Modifier.padding(horizontal = Metrics.gutter - 8.dp).padding(top = 2.dp))
        Hairline(Modifier.padding(top = 4.dp, bottom = 10.dp))
    }
}

/** The ayuntamiento's answer: set apart on its own card, named and marked official. */
@Composable
private fun OfficialReply(author: String, body: String, age: String) {
    val p = Ink.colors
    Column(Modifier.padding(horizontal = Metrics.gutter, vertical = 5.dp).fillMaxWidth().background(p.paper2, RoundedCornerShape(Metrics.radiusCard)).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.size(28.dp).background(p.action, CircleShape), Alignment.Center) { Icon(Icons.Outlined.AccountBalance, null, Modifier.size(15.dp), tint = p.onInk) }
            Text(author, style = Type.label, color = p.ink)
            Text(stringResource(R.string.comments_official_badge), style = Type.caption, color = p.success, modifier = Modifier.weight(1f))
            Text(age, style = Type.caption, color = p.ink3)
        }
        Text(body, style = Type.body, color = p.ink)
    }
}

/** Neighbours' replies, flat, with delete on your own and report on the rest. */
private fun androidx.compose.foundation.lazy.LazyListScope.commentRows(state: CommentsUiState, vm: CommentsViewModel, emptyNote: Boolean) {
    when {
        state.loading && state.items.isEmpty() -> item { CommentSkeleton() }
        state.loadError != null && state.items.isEmpty() -> item { ErrorView(state.loadError ?: UiError.Unknown, Modifier.height(200.dp), vm::retryLoad) }
        state.items.isEmpty() -> if (emptyNote) item {
            Text(stringResource(R.string.comments_empty), style = Type.callout, color = Ink.colors.ink3, modifier = Modifier.fillMaxWidth().padding(vertical = 28.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        }
        else -> {
            items(state.items, key = { "comment:${it.id}" }) { comment -> CommentRow(comment, state.workingCommentId == comment.id, vm) }
            if (state.canLoadMore) item { Box(Modifier.fillMaxWidth().padding(top = 16.dp), Alignment.Center) { Pill(stringResource(R.string.common_see_all), vm::loadMore, kind = PillKind.Quiet, compact = true) } }
        }
    }
}

@Composable
private fun CommentRow(comment: Comment, working: Boolean, vm: CommentsViewModel) {
    val p = Ink.colors
    var menu by remember { mutableStateOf(false) }
    var reporting by remember { mutableStateOf(false) }
    Column(Modifier.animateContentSize()) {
        Row(Modifier.padding(start = Metrics.gutter, end = 8.dp, top = 14.dp, bottom = 14.dp).alpha(if (working) 0.4f else 1f), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Avatar(comment.author, 36.dp)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(if (comment.isMine) stringResource(R.string.consultations_you) else comment.author ?: stringResource(R.string.traffic_resident), style = Type.label, color = p.ink)
                    Text(relativeTimeText(comment.createdAt), style = Type.caption, color = p.ink3)
                }
                Text(comment.body, style = Type.body, color = p.ink)
            }
            Box {
                Icon(Icons.Outlined.MoreHoriz, stringResource(R.string.comments_options), Modifier.size(44.dp).clip(CircleShape).clickable { menu = true }.padding(13.dp), tint = p.ink3)
                DropdownMenu(menu, { menu = false }, containerColor = p.card) {
                    if (comment.isMine) DropdownMenuItem({ Text(stringResource(R.string.comments_delete), color = p.danger) }, { menu = false; vm.delete(comment.id) })
                    else DropdownMenuItem({ Text(stringResource(R.string.comments_report)) }, { menu = false; reporting = true })
                }
            }
        }
    }
    if (reporting) ReasonDialog(stringResource(R.string.comments_report), { reporting = false }) { vm.report(comment.id, it) }
}

@Composable
fun reasonLabel(reason: ReportReason): String = stringResource(when (reason) {
    ReportReason.Abuse -> R.string.safety_reasons_abuse
    ReportReason.PersonalInformation -> R.string.safety_reasons_personal_information
    ReportReason.Unsafe -> R.string.safety_reasons_unsafe
    ReportReason.Other -> R.string.safety_reasons_other
})

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ReasonDialog(title: String, onDismiss: () -> Unit, onPick: (ReportReason) -> Unit) {
    ModalBottomSheet(onDismiss, containerColor = Ink.colors.paper, shape = RoundedCornerShape(topStart = Metrics.radiusPanel, topEnd = Metrics.radiusPanel)) {
        Column(Modifier.navigationBarsPadding().padding(bottom = 12.dp)) {
            Text(title, style = Type.heading, color = Ink.colors.ink, modifier = Modifier.padding(horizontal = Metrics.gutter).padding(bottom = 8.dp))
            ReportReason.entries.forEach { reason -> RowLabel(reasonLabel(reason), onClick = { onPick(reason); onDismiss() }) }
        }
    }
}

/** Writing a reply: a resident's comment, or the ayuntamiento's answer with the status it leaves. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ReplySheet(state: ConsultationDetailUiState, vm: ConsultationDetailViewModel, comments: CommentsUiState, commentsVm: CommentsViewModel, onDismiss: () -> Unit) {
    val asStaff = state.canRespond
    var official by rememberSaveable { mutableStateOf("") }
    var status by rememberSaveable { mutableStateOf(ConsultationsRespondInput.StatusAfter.Answered) }
    val busy = if (asStaff) state.replying else comments.sending
    val canSend = if (asStaff) official.trim().length >= 3 else comments.canSend
    var wasSending by remember { mutableStateOf(false) }
    LaunchedEffect(state.replySent) { if (state.replySent) { vm.replySentHandled(); onDismiss() } }
    LaunchedEffect(comments.sending) {
        if (wasSending && !comments.sending && comments.sendError == null) onDismiss()
        wasSending = comments.sending
    }
    ModalBottomSheet(onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = Ink.colors.paper, shape = RoundedCornerShape(topStart = Metrics.radiusPanel, topEnd = Metrics.radiusPanel)) {
        Column(Modifier.imePadding().navigationBarsPadding().padding(horizontal = Metrics.gutter).padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(if (asStaff) R.string.comments_official_reply else R.string.comments_reply_title), style = Type.heading, color = Ink.colors.ink, modifier = Modifier.weight(1f))
                Pill(stringResource(R.string.common_send), { if (asStaff) vm.respond(official, status) else commentsVm.send() }, compact = true, enabled = canSend, busy = busy)
            }
            // What the reply answers, so the sheet never loses its context.
            state.detail?.title?.let { Text(stringResource(R.string.comments_replying_to, "«$it»"), style = Type.callout, color = Ink.colors.ink3, maxLines = 2) }
            Field(if (asStaff) official else comments.draft, { if (asStaff) official = it else commentsVm.updateDraft(it) },
                stringResource(if (asStaff) R.string.comments_reply_placeholder else R.string.comments_placeholder), minLines = 4, maxLines = 10)
            if (asStaff) {
                Text(stringResource(R.string.comments_status_after), style = Type.caption, color = Ink.colors.ink3)
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(state.replyStatuses) { option ->
                        Chip(stringResource(when (option) {
                            ConsultationsRespondInput.StatusAfter.InReview -> R.string.consultations_status_label_in_review
                            ConsultationsRespondInput.StatusAfter.Answered -> R.string.consultations_status_label_answered
                            ConsultationsRespondInput.StatusAfter.Resolved -> R.string.consultations_status_label_resolved
                            ConsultationsRespondInput.StatusAfter.Rejected -> R.string.consultations_status_label_rejected
                        }), status == option, { status = option })
                    }
                }
            }
            if ((asStaff && state.replyError != null) || (!asStaff && comments.sendError != null)) {
                Text(stringResource(if (asStaff) R.string.comments_official_reply_failed else R.string.comments_send_failed), style = Type.callout, color = Ink.colors.danger)
            }
        }
    }
}

// ------------------------------------------------------------------ overflow

/** The overflow of a post: share it, stop seeing its author, or report it. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PostMenu(consultationId: String, slug: String, title: String, onHidden: () -> Unit, onDismiss: () -> Unit) {
    val graph = LocalAppGraph.current
    val vm: SafetyViewModel = viewModel(key = "safety:$consultationId") { graph.viewModels.safety() }
    val state by vm.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val shareLabel = stringResource(R.string.common_share)
    var step by remember { mutableStateOf(0) }
    var details by remember { mutableStateOf("") }
    var confirmHide by remember { mutableStateOf(false) }
    LaunchedEffect(state.hidden) { if (state.hidden) { onHidden(); vm.reset(); onDismiss() } }
    ModalBottomSheet({ vm.reset(); onDismiss() }, containerColor = Ink.colors.paper, shape = RoundedCornerShape(topStart = Metrics.radiusPanel, topEnd = Metrics.radiusPanel)) {
        Column(Modifier.imePadding().navigationBarsPadding().padding(bottom = 12.dp)) {
            when {
                state.reported -> StateView(stringResource(R.string.safety_report_sent), icon = Icons.Outlined.CheckCircle, message = stringResource(R.string.safety_report_sent_hint), action = stringResource(R.string.common_done), onAction = { vm.reset(); onDismiss() })
                step == 0 -> {
                    RowLabel(shareLabel, icon = Icons.Outlined.IosShare, chevron = false, onClick = { shareConsultation(context, title, slug, shareLabel) })
                    RowLabel(stringResource(R.string.safety_block_action), icon = Icons.Outlined.VisibilityOff, chevron = false, onClick = { confirmHide = true })
                    RowLabel(stringResource(R.string.safety_report_action), icon = Icons.Outlined.Flag, chevron = false, danger = true, divider = false, onClick = { step = 1 })
                    state.errorCode?.let { code ->
                        Text(stringResource(when (code) {
                            "own_content" -> R.string.safety_errors_own_content
                            "no_author" -> R.string.safety_errors_no_author
                            "not_found" -> R.string.safety_errors_not_found
                            else -> R.string.safety_errors_generic
                        }), style = Type.callout, color = Ink.colors.danger, modifier = Modifier.padding(Metrics.gutter))
                    }
                }
                step == 1 -> {
                    Text(stringResource(R.string.safety_report_subtitle), style = Type.callout, color = Ink.colors.ink3, modifier = Modifier.padding(horizontal = Metrics.gutter).padding(bottom = 8.dp))
                    vm.reasons.forEach { reason ->
                        RowLabel(reasonLabel(reason), onClick = { if (reason == ReportReason.Other) step = 2 else vm.report(consultationId, reason, null) })
                    }
                }
                else -> Column(Modifier.padding(horizontal = Metrics.gutter), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Field(details, { details = it }, stringResource(R.string.safety_report_details_label), minLines = 3, maxLines = 6)
                    Text(stringResource(R.string.safety_report_details_hint), style = Type.caption, color = Ink.colors.ink3)
                    Pill(stringResource(R.string.safety_report_submit), { vm.report(consultationId, ReportReason.Other, details) }, Modifier.fillMaxWidth(), enabled = details.isNotBlank(), busy = state.working)
                }
            }
        }
    }
    if (confirmHide) {
        AlertDialog(
            onDismissRequest = { confirmHide = false },
            title = { Text(stringResource(R.string.safety_block_title)) },
            text = { Text(stringResource(R.string.safety_block_body)) },
            confirmButton = { TextButton({ confirmHide = false; vm.hideAuthor(consultationId) }) { Text(stringResource(R.string.safety_block_confirm), color = Ink.colors.danger) } },
            dismissButton = { TextButton({ confirmHide = false }) { Text(stringResource(R.string.common_cancel)) } },
            containerColor = Ink.colors.card,
        )
    }
    if (state.signInRequested) SignInDialog(onDismiss = vm::signInHandled)
}

// ------------------------------------------------------------------ staff verification

/** Staff actions ask for the authenticator code first: one sentence, six boxes. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StepUpSheet(state: StepUpState, onVerify: (String) -> Unit, onUseRecovery: (Boolean) -> Unit, onDismiss: () -> Unit) {
    if (state is StepUpState.None) return
    var code by remember { mutableStateOf("") }
    ModalBottomSheet(onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = Ink.colors.paper, shape = RoundedCornerShape(topStart = Metrics.radiusPanel, topEnd = Metrics.radiusPanel)) {
        Column(Modifier.imePadding().navigationBarsPadding().padding(horizontal = 24.dp).padding(bottom = 20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text(stringResource(R.string.gestion_step_up_title), style = Type.title, color = Ink.colors.ink)
            if (state is StepUpState.EnrollOnWeb) {
                Text(stringResource(R.string.gestion_enroll_on_web), style = Type.body, color = Ink.colors.ink2)
            } else {
                val recovery = (state as? StepUpState.Asking)?.recovery ?: (state as? StepUpState.Verifying)?.recovery ?: false
                val error = (state as? StepUpState.Asking)?.error
                val busy = state is StepUpState.Verifying
                LaunchedEffect(error) { if (error != null) code = "" }
                Text(stringResource(R.string.gestion_step_up_body), style = Type.body, color = Ink.colors.ink2)
                if (recovery) {
                    Field(code, { code = it }, stringResource(R.string.gestion_recovery_code), onDone = { onVerify(code) })
                    Pill(stringResource(R.string.common_continue), { onVerify(code) }, Modifier.fillMaxWidth(), enabled = code.length >= 6, busy = busy)
                } else {
                    CodeBoxes(code, failed = error != null) { next -> code = next; if (next.length == 6) onVerify(next) }
                }
                if (error != null) Text(stringResource(if (error == StepUpError.Offline) R.string.common_offline_body else R.string.gestion_step_up_invalid), style = Type.callout, color = Ink.colors.danger)
                Pill(stringResource(if (recovery) R.string.gestion_use_authenticator else R.string.gestion_use_recovery), { code = ""; onUseRecovery(!recovery) }, kind = PillKind.Outline, compact = true, enabled = !busy)
            }
        }
    }
}

// ---------------------------------------------------------------- loading

/** Two feature cards, in the carousel's own sizes. */
@Composable
private fun FeaturedSkeleton() {
    Skeleton {
        Row(Modifier.padding(horizontal = Metrics.gutter), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            repeat(2) {
                Box(Modifier.size(264.dp, 248.dp)) {
                    Bone(Modifier.matchParentSize(), RoundedCornerShape(22.dp))
                    Box(Modifier.padding(12.dp).size(78.dp, 23.dp).background(Ink.colors.paper2, CircleShape))
                    Column(Modifier.align(Alignment.BottomStart).padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Box(Modifier.size(150.dp, 15.dp).background(Ink.colors.paper2, CircleShape))
                        Box(Modifier.padding(top = 6.dp).size(96.dp, 10.dp).background(Ink.colors.paper2, CircleShape))
                    }
                }
            }
        }
    }
}

/** Rows shaped like [CompactRow]: the square, two lines and, unfiltered, the state. */
@Composable
private fun RowSkeleton(count: Int, showsStatus: Boolean) {
    Skeleton {
        Column {
            repeat(count) {
                Row(Modifier.fillMaxWidth().padding(horizontal = Metrics.gutter, vertical = 9.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    Bone(Modifier.size(76.dp), RoundedCornerShape(12.dp))
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        BoneLine(178.dp)
                        BoneLine(148.dp, lineHeight = 18.dp, barHeight = 11.dp)
                        if (showsStatus) Bone(Modifier.padding(top = 2.dp).size(72.dp, 20.dp))
                    }
                }
            }
        }
    }
}

/** The case itself: state and time, title, three lines of text, who and where. */
@Composable
private fun DetailSkeleton() {
    Skeleton(Modifier.fillMaxSize()) {
        Column(Modifier.padding(horizontal = Metrics.gutter).padding(top = 4.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Bone(Modifier.size(76.dp, 21.dp))
                Spacer(Modifier.weight(1f))
                Bone(Modifier.size(56.dp, 12.dp))
            }
            Spacer(Modifier.height(12.dp))
            BoneLine(264.dp, lineHeight = 29.dp, barHeight = 17.dp)
            Column(Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                BoneLine(360.dp); BoneLine(316.dp); BoneLine(190.dp)
            }
            Row(Modifier.padding(top = 16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Bone(Modifier.size(28.dp))
                Bone(Modifier.size(86.dp, 13.dp))
                Spacer(Modifier.weight(1f))
                Bone(Modifier.size(80.dp, 28.dp))
            }
        }
    }
}

/** Two replies on their way: avatar, name, a line. */
@Composable
private fun CommentSkeleton() {
    Skeleton {
        Column(Modifier.padding(horizontal = Metrics.gutter, vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            repeat(2) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(Modifier.size(44.dp), Alignment.TopCenter) { Bone(Modifier.size(36.dp)) }
                    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        BoneLine(116.dp, lineHeight = 18.dp, barHeight = 11.dp)
                        BoneLine(214.dp)
                    }
                }
            }
        }
    }
}
