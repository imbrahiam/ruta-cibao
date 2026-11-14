package rutacibao.android.feature.consultations

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.IosShare
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import rutacibao.android.feature.comments.ReplyRow
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.ChatBubbleOutline
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.foundation.clickable
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.foundation.layout.Spacer
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import rutacibao.android.R
import rutacibao.android.feature.auth.SignInDialog
import rutacibao.android.feature.comments.CommentDialogs
import rutacibao.android.feature.comments.CommentsHeader
import rutacibao.android.feature.comments.ThreadAvatar
import rutacibao.android.feature.comments.commentThread
import rutacibao.android.feature.gestion.StepUpSheet
import rutacibao.android.feature.map.StaticPinMap
import rutacibao.android.ui.CategoryAvatar
import rutacibao.android.ui.ErrorState
import rutacibao.android.ui.Hairline
import rutacibao.android.ui.LoadingState
import rutacibao.android.ui.LocalAppGraph
import rutacibao.android.ui.LocalPalette
import rutacibao.android.ui.MessageState
import rutacibao.android.ui.PushedScreen
import rutacibao.android.ui.StatusPill
import rutacibao.android.ui.parseCategoryColor
import rutacibao.android.ui.relativeTimeText
import rutacibao.android.generated.RutaBrand
import rutacibao.presentation.UiError
import rutacibao.presentation.comments.CommentSubject
import rutacibao.presentation.comments.CommentsViewModel
import rutacibao.presentation.consultations.ConsultationDetail
import rutacibao.presentation.consultations.ConsultationDetailUiState.Phase
import rutacibao.presentation.consultations.ConsultationDetailViewModel
import rutacibao.presentation.consultations.ConsultationResponse
import rutacibao.presentation.consultations.statusAfterValue
import rutacibao.presentation.consultations.statusValue

/** A public post, official municipal responses, then the residents' flat comment thread. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConsultationDetailScreen(slug: String, onBack: () -> Unit) {
    val graph = LocalAppGraph.current
    val vm: ConsultationDetailViewModel = viewModel(key = "detail:$slug") { graph.viewModels.consultationDetail().also { it.load(slug) } }
    val state by vm.state.collectAsStateWithLifecycle()
    val commentsVm: CommentsViewModel = viewModel(key = "consultation-comments:$slug") {
        graph.viewModels.comments().also { it.load(CommentSubject.Consultation, slug) }
    }
    val comments by commentsVm.state.collectAsStateWithLifecycle()
    val emptyComments = stringResource(R.string.comments_empty)
    val context = LocalContext.current
    val detail = state.detail
    var replyOpen by rememberSaveable(slug) { mutableStateOf(false) }
    // Only its author sees a case before review; nobody can reply to it yet.
    val pending = detail?.publicationStatus == rutacibao.api.generated.ConsultationsDetailOutput.PublicationStatus.Pending
    // The post's reply button: straight into the composer, or to sign-in first.
    val startReply = {
        if (pending && !state.canRespond) Unit else if (state.canRespond || comments.signedIn) replyOpen = true else commentsVm.requestSignIn()
        Unit
    }
    var menuOpen by remember { mutableStateOf(false) }
    if (menuOpen && detail != null) {
        PostMenuSheet(consultationId = detail.id, slug = detail.slug, title = detail.title, onHidden = {}, onDismiss = { menuOpen = false })
    }
    PushedScreen(
        title = stringResource(R.string.consultations_post_title),
        onBack = onBack,
        // X's bar: a plain "•••" at the end.
        actions = {
            if (detail != null) {
                IconButton(onClick = { menuOpen = true }, modifier = Modifier.size(48.dp)) {
                    Icon(Icons.Filled.MoreHoriz, contentDescription = stringResource(R.string.safety_ui_menu_label))
                }
            }
        },
        bottomBar = {
            if (state.phase == Phase.Ready && detail != null && (!pending || state.canRespond)) ConsultationComposer(state, vm, comments, commentsVm, open = replyOpen, onOpenChange = { replyOpen = it })
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding)) {
            when (state.phase) {
                Phase.Loading -> LoadingState()
                Phase.NotFound -> MessageState(stringResource(R.string.consultations_missing), null, icon = Icons.Filled.ChatBubbleOutline)
                Phase.Failed -> ErrorState(state.error ?: UiError.Unknown, onRetry = vm::retry)
                Phase.Ready -> if (detail != null) {
                    PullToRefreshBox(isRefreshing = state.refreshing, onRefresh = { vm.refresh(); commentsVm.refresh() }) {
                        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 16.dp)) {
                            val replies = detail.responses.size + comments.total
                            item(key = "original") { OriginalPost(detail, replies, onSupport = vm::toggleSupport, onReply = startReply) }
                            // One thread, as Threads shows it: the ayuntamiento's answers pinned
                            // first, then the residents', all in the same row (mirrors iOS).
                            if (replies > 0) item(key = "thread:header") { CommentsHeader(pluralStringResource(R.plurals.consultations_responses, replies, replies), replies) }
                            items(detail.responses, key = { "official:${it.id}" }) { OfficialReply(it) }
                            if (pending) {
                                item(key = "review-note") {
                                    Row(
                                        Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 16.dp),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        Icon(Icons.Outlined.Schedule, contentDescription = null, modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                                        Text(stringResource(R.string.contribute_review_note), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                }
                            } else {
                                commentThread(comments, commentsVm, if (detail.responses.isEmpty()) emptyComments else null)
                            }
                        }
                    }
                }
            }
        }
    }
    if (state.signInRequested) SignInDialog(onDismiss = vm::signInHandled)
    CommentDialogs(comments, commentsVm)
    StepUpSheet(state.stepUp, onVerify = vm::verifyStepUp, onUseRecovery = vm::useRecoveryCode, onDismiss = vm::dismissStepUp)
}

/**
 * X's opened post, field for field (mirrors iOS): a 48dp photo with the bold name over the grey
 * handle (here the town) and, where X puts its label, the case's status; the text at 17sp (title
 * in bold); the category tag, media and map as X's bordered cards; the grey meta line (time · date
 * · bold count); then X's action row spread across the width.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun OriginalPost(detail: ConsultationDetail, replyCount: Int, onSupport: () -> Unit, onReply: () -> Unit) {
    val palette = LocalPalette.current
    val context = LocalContext.current
    var viewerStart by remember { mutableStateOf<Int?>(null) }
    val photos = remember(detail.photos) { detail.photos.orEmpty().map { Photo(it.url, it.width, it.height, it.alt) } }
    viewerStart?.let { PhotoViewer(photos, it) { viewerStart = null } }
    val inset = XInset
    Column(Modifier.padding(top = 8.dp)) {
        val author = detail.openedBy ?: if (detail.isMine) stringResource(R.string.consultations_you) else detail.categoryName
        Row(Modifier.padding(horizontal = inset), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ThreadAvatar(author, detail.openedByImage, size = 48.dp)
            Column(Modifier.weight(1f)) {
                Text(author, style = MaterialTheme.typography.titleMedium.copy(fontSize = 17.sp, fontWeight = FontWeight.Bold), maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(detail.municipalityName, style = MaterialTheme.typography.bodyLarge.copy(fontSize = 17.sp), color = palette.textSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            StatusPill(detail.statusValue)
        }
        Column(Modifier.padding(horizontal = inset).padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(detail.title, style = MaterialTheme.typography.bodyLarge.copy(fontSize = 17.sp, lineHeight = 24.sp, fontWeight = FontWeight.Bold), modifier = Modifier.semantics { heading() })
            SelectionContainer { Text(detail.body, style = MaterialTheme.typography.bodyLarge.copy(fontSize = 17.sp, lineHeight = 24.sp)) }
        }
        Row(
            Modifier.padding(horizontal = inset).padding(top = 12.dp).clip(CircleShape).background(palette.inset).padding(start = 4.dp, end = 10.dp).height(28.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            CategoryAvatar(detail.categoryIcon, detail.categoryColor, 20.dp)
            Text(detail.categoryName, style = MaterialTheme.typography.labelLarge)
        }
        if (photos.isNotEmpty()) PostPhotos(photos, onOpen = { viewerStart = it }, modifier = Modifier.padding(start = inset, top = 12.dp))
        detail.location?.let { loc ->
            StaticPinMap(
                latitude = loc.lat,
                longitude = loc.lng,
                tint = parseCategoryColor(detail.categoryColor, palette.accent),
                meters = 600.0,
                modifier = Modifier
                    .padding(horizontal = inset)
                    .padding(top = 12.dp)
                    .fillMaxWidth()
                    .height(150.dp)
                    .clip(RoundedCornerShape(16.dp))
                    // X's card edge: one pale blue-grey pixel.
                    .border(1.dp, palette.fillPressed, RoundedCornerShape(16.dp)),
            )
        }
        // X's meta line: "5:20 p. m. · 11/6/26 · 8 apoyos", the count in bold ink.
        val supports = detail.supportCount.toInt()
        val phrase = if (supports == 0) stringResource(R.string.consultations_supports_zero) else pluralStringResource(R.plurals.consultations_supports, supports, supports)
        Text(
            buildAnnotatedString {
                append(postTimestamp(detail.createdAt))
                append(" · ")
                appendCount(phrase, supports, palette.text)
            },
            style = MaterialTheme.typography.bodyMedium.copy(fontSize = 15.sp),
            color = palette.textSecondary,
            modifier = Modifier.padding(horizontal = inset).padding(top = 16.dp),
        )
        // Three actions, grouped at the start as Threads does (spread edge to edge like X's five they
        // leave holes): support, reply, share.
        Row(
            // Each target pads its own glyph by 14dp, so the row itself needs none.
            Modifier.fillMaxWidth().padding(top = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            SupportIcon(detail.supported, onSupport, count = supports)
            ReplyIcon(replyCount, onReply)
            IconTarget(Icons.Outlined.IosShare, stringResource(R.string.common_share), palette.textSecondary) {
                shareText(context, detail.title, detail.slug)
            }
            Spacer(Modifier.weight(1f))
        }
    }
}

/** X's thread gutter (mirrors iOS `XMetrics.inset`). */
val XInset = 12.dp

/** "5:20 p. m. · 11/6/26", in the phone's locale. */
private fun postTimestamp(instant: kotlin.time.Instant): String {
    val zoned = java.time.Instant.ofEpochMilli(instant.toEpochMilliseconds()).atZone(java.time.ZoneId.systemDefault())
    val time = java.time.format.DateTimeFormatter.ofLocalizedTime(java.time.format.FormatStyle.SHORT).format(zoned)
    val date = java.time.format.DateTimeFormatter.ofPattern("d/M/yy").format(zoned)
    return "$time · $date"
}

/** X's "147K Views": the number in bold ink inside a plural phrase. */
private fun androidx.compose.ui.text.AnnotatedString.Builder.appendCount(phrase: String, count: Int, ink: androidx.compose.ui.graphics.Color) {
    val number = count.toString()
    val at = phrase.indexOf(number)
    if (count == 0 || at < 0) { append(phrase); return }
    append(phrase.substring(0, at))
    withStyle(androidx.compose.ui.text.SpanStyle(fontWeight = FontWeight.Bold, color = ink)) { append(number) }
    append(phrase.substring(at + number.length))
}

/** Threads' reply bubble with its bare count; opens the composer. */
@Composable
private fun ReplyIcon(count: Int, onClick: () -> Unit) {
    val palette = LocalPalette.current
    val label = stringResource(R.string.comments_participant_mode)
    Row(
        Modifier
            .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
            .clip(RoundedCornerShape(24.dp))
            .clickable(role = Role.Button, onClick = onClick)
            .clearAndSetSemantics { contentDescription = if (count > 0) "$label, $count" else label; role = Role.Button }
            .padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(Icons.Outlined.ChatBubbleOutline, contentDescription = null, Modifier.size(20.dp), tint = palette.textSecondary)
        if (count > 0) Text(count.toString(), style = MaterialTheme.typography.bodyMedium, color = palette.textSecondary)
    }
}

// ------------------------------------------------------------------ the thread

/** One official reply in the shared row: the ayuntamiento's disc, its name with the "Oficial" badge, the age, the answer. */
@Composable
private fun OfficialReply(response: ConsultationResponse) {
    val palette = LocalPalette.current
    Box(Modifier.semantics(mergeDescendants = true) {}) {
        ReplyRow(
            name = response.author ?: stringResource(R.string.consultations_municipality),
            age = relativeTimeText(response.createdAt),
            body = response.body,
            official = true,
            avatar = {
                Box(Modifier.size(40.dp).background(palette.fill, CircleShape), Alignment.Center) {
                    Icon(Icons.Filled.AccountBalance, contentDescription = null, Modifier.size(18.dp), tint = palette.text)
                }
            },
        )
    }
}
