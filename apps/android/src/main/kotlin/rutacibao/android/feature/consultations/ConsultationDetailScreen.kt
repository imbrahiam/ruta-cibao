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
    PushedScreen(
        title = stringResource(R.string.consultations_post_title),
        onBack = onBack,
        bottomBar = {
            if (state.phase == Phase.Ready && detail != null) ConsultationComposer(state, vm, comments, commentsVm)
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
                            item(key = "original") { OriginalPost(detail, onSupport = vm::toggleSupport) }
                            item(key = "official") { Thread(detail) }
                            item(key = "comments:header") {
                                Hairline()
                                CommentsHeader(stringResource(R.string.comments_title), comments.total)
                            }
                            commentThread(comments, commentsVm, emptyComments)
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

/** Threads' thread layout: avatar row, then text, media, bare actions and counts at full width. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun OriginalPost(detail: ConsultationDetail, onSupport: () -> Unit) {
    val palette = LocalPalette.current
    val context = LocalContext.current
    var viewerStart by remember { mutableStateOf<Int?>(null) }
    var menuOpen by remember { mutableStateOf(false) }
    val photos = remember(detail.photos) { detail.photos.orEmpty().map { Photo(it.url, it.width, it.height, it.alt) } }
    viewerStart?.let { PhotoViewer(photos, it) { viewerStart = null } }
    if (menuOpen) {
        PostMenuSheet(consultationId = detail.id, slug = detail.slug, title = detail.title, onHidden = {}, onDismiss = { menuOpen = false })
    }
    Column(Modifier.padding(top = 8.dp, bottom = 6.dp)) {
        val author = detail.openedBy ?: if (detail.isMine) stringResource(R.string.consultations_you) else detail.categoryName
        Row(Modifier.padding(start = PostInset, end = 2.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            ThreadAvatar(author, detail.openedByImage, size = PostAvatar)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(author, style = MaterialTheme.typography.titleMedium.copy(fontSize = 17.sp, fontWeight = FontWeight.Bold))
                Text(listOf(detail.municipalityName, relativeTimeText(detail.createdAt)).joinToString(" · "),
                    style = MaterialTheme.typography.bodyMedium.copy(fontSize = 15.sp), color = palette.textTertiary, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Icon(
                Icons.Filled.MoreHoriz,
                contentDescription = stringResource(R.string.safety_ui_menu_label),
                Modifier.size(48.dp).clip(CircleShape).clickable(role = Role.Button) { menuOpen = true }.padding(14.dp),
                tint = palette.textTertiary,
            )
        }
        Column(Modifier.padding(horizontal = PostInset).padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(detail.title, style = MaterialTheme.typography.titleLarge, modifier = Modifier.semantics { heading() })
            SelectionContainer { Text(detail.body, style = MaterialTheme.typography.bodyLarge) }
            Row(
                Modifier.clip(CircleShape).background(palette.inset).padding(start = 4.dp, end = 10.dp).height(28.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                CategoryAvatar(detail.categoryIcon, detail.categoryColor, 20.dp)
                Text(detail.categoryName, style = MaterialTheme.typography.labelLarge)
            }
        }
        if (photos.isNotEmpty()) PostPhotos(photos, onOpen = { viewerStart = it }, modifier = Modifier.padding(start = PostInset, top = 10.dp))
        detail.location?.let { loc ->
            StaticPinMap(
                latitude = loc.lat,
                longitude = loc.lng,
                tint = parseCategoryColor(detail.categoryColor, palette.accent),
                meters = 600.0,
                modifier = Modifier
                    .padding(horizontal = PostInset)
                    .padding(top = 10.dp)
                    .fillMaxWidth()
                    .height(150.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .border(0.5.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(16.dp)),
            )
        }
        // X's stats bar (mirrors iOS): hairlines above and below, icons with bare counts, status trailing.
        Hairline(Modifier.padding(horizontal = PostInset).padding(top = 14.dp))
        Row(
            Modifier.fillMaxWidth().padding(start = PostInset - 14.dp, end = PostInset, top = 2.dp, bottom = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            SupportIcon(detail.supported, onSupport, count = detail.supportCount.toInt())
            IconTarget(Icons.AutoMirrored.Outlined.Send, stringResource(R.string.common_share), palette.textSecondary) {
                shareText(context, detail.title, detail.slug)
            }
            Spacer(Modifier.weight(1f))
            StatusPill(detail.statusValue)
        }
        Hairline(Modifier.padding(horizontal = PostInset))
    }
}

// ------------------------------------------------------------------ the thread

@Composable
private fun Thread(detail: ConsultationDetail) {
    // No replies, no heading: the composer already says who can answer.
    if (detail.responses.isEmpty()) return
    Column {
        Hairline()
        Row(
            Modifier.fillMaxWidth().padding(horizontal = PostInset).padding(top = 18.dp, bottom = 4.dp).semantics { heading() },
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            val style = MaterialTheme.typography.titleSmall.copy(fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            Text(stringResource(R.string.comments_official_replies), style = style)
            Text(detail.responses.size.toString(), style = style, color = LocalPalette.current.textTertiary)
        }
        detail.responses.forEach { Reply(it) }
    }
}

/** One official reply: the ayuntamiento's mark, its name with an "Oficial" badge (text, not colour), the time, then the answer. */
@Composable
private fun Reply(response: ConsultationResponse) {
    val palette = LocalPalette.current
    Row(
        Modifier.fillMaxWidth().padding(horizontal = PostInset, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(Modifier.size(32.dp).background(palette.fill, CircleShape), Alignment.Center) {
            Icon(Icons.Filled.AccountBalance, contentDescription = null, Modifier.size(16.dp), tint = palette.text)
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    response.author ?: stringResource(R.string.consultations_municipality),
                    style = MaterialTheme.typography.titleSmall.copy(fontSize = 13.sp, fontWeight = FontWeight.Bold),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                Text(
                    stringResource(R.string.comments_official_badge),
                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp, fontWeight = FontWeight.SemiBold),
                    modifier = Modifier.clip(CircleShape).background(palette.inset).padding(horizontal = 6.dp, vertical = 2.dp),
                )
                Text(relativeTimeText(response.createdAt), style = MaterialTheme.typography.labelMedium.copy(fontSize = 13.sp), color = palette.textTertiary, maxLines = 1)
            }
            SelectionContainer { Text(response.body, style = MaterialTheme.typography.bodyLarge.copy(fontSize = 16.sp)) }
        }
    }
}
