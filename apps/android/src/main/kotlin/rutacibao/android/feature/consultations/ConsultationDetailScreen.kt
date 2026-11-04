package rutacibao.android.feature.consultations

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.ChatBubbleOutline
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.offset
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.material.icons.filled.ThumbUp
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.ThumbUp
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
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
import rutacibao.android.feature.gestion.StepUpSheet
import rutacibao.android.feature.map.StaticPinMap
import rutacibao.android.ui.CategoryAvatar
import rutacibao.android.ui.ErrorState
import rutacibao.android.ui.Hairline
import rutacibao.android.ui.LoadingState
import rutacibao.android.ui.LocalAppGraph
import rutacibao.android.ui.LocalPalette
import rutacibao.android.ui.LocalReducedMotion
import rutacibao.android.ui.MessageState
import rutacibao.android.ui.PushedScreen
import rutacibao.android.ui.StatusPill
import rutacibao.android.ui.parseCategoryColor
import rutacibao.android.ui.relativeTimeText
import rutacibao.android.generated.RutaBrand
import rutacibao.presentation.UiError
import rutacibao.presentation.consultations.ConsultationDetail
import rutacibao.presentation.consultations.ConsultationDetailUiState.Phase
import rutacibao.presentation.consultations.ConsultationDetailViewModel
import rutacibao.presentation.consultations.ConsultationResponse
import rutacibao.presentation.consultations.statusAfterValue
import rutacibao.presentation.consultations.statusValue

/** A case opened like a Threads post: the post in full, then the ayuntamiento's replies as a thread, oldest first. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConsultationDetailScreen(slug: String, onBack: () -> Unit) {
    val graph = LocalAppGraph.current
    val vm: ConsultationDetailViewModel = viewModel(key = "detail:$slug") { graph.viewModels.consultationDetail().also { it.load(slug) } }
    val state by vm.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val detail = state.detail
    PushedScreen(
        title = null,
        onBack = onBack,
        actions = {
            if (detail != null) {
                IconButton(onClick = { shareText(context, detail.title, detail.slug) }) {
                    Icon(Icons.Outlined.Share, contentDescription = stringResource(R.string.common_share))
                }
            }
        },
        bottomBar = {
            if (state.canRespond && detail != null) StaffReplyComposer(state, vm)
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when (state.phase) {
                Phase.Loading -> LoadingState()
                Phase.NotFound -> MessageState(stringResource(R.string.consultations_missing), null, icon = Icons.Filled.ChatBubbleOutline)
                Phase.Failed -> ErrorState(state.error ?: UiError.Unknown, onRetry = vm::retry)
                Phase.Ready -> if (detail != null) {
                    var refreshing by remember { mutableStateOf(false) }
                    LaunchedEffect(detail) { refreshing = false }
                    PullToRefreshBox(isRefreshing = refreshing, onRefresh = { refreshing = true; vm.refresh() }) {
                        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(bottom = 32.dp)) {
                            OriginalPost(detail, onSupport = vm::toggleSupport)
                            Thread(detail)
                        }
                    }
                }
            }
        }
    }
    if (state.signInRequested) SignInDialog(onDismiss = vm::signInHandled)
    StepUpSheet(state.stepUp, onVerify = vm::verifyStepUp, onUseRecovery = vm::useRecoveryCode, onDismiss = vm::dismissStepUp)
}

/** Threads' thread layout: avatar row, then text, media, bare actions and counts at full width. */
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
        Row(Modifier.padding(start = PostInset, end = 2.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            CategoryAvatar(detail.categoryIcon, detail.categoryColor, PostAvatar)
            Text(
                detail.categoryName,
                style = MaterialTheme.typography.titleSmall,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Text(relativeTimeText(detail.createdAt), style = MaterialTheme.typography.bodyMedium, color = palette.textTertiary, maxLines = 1)
            Icon(
                Icons.Filled.MoreHoriz,
                contentDescription = stringResource(R.string.safety_ui_menu_label),
                Modifier.size(48.dp).clip(CircleShape).clickable(role = Role.Button) { menuOpen = true }.padding(14.dp),
                tint = palette.textTertiary,
            )
        }
        Column(Modifier.padding(horizontal = PostInset).padding(top = 4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                detail.title,
                style = MaterialTheme.typography.titleSmall.copy(fontSize = 15.sp, lineHeight = 21.sp, fontWeight = FontWeight.SemiBold),
                modifier = Modifier.semantics { heading() },
            )
            Text(detail.body, style = MaterialTheme.typography.bodyMedium.copy(fontSize = 15.sp, lineHeight = 21.sp))
            val who = if (detail.isMine) stringResource(R.string.consultations_your_case)
            else detail.openedBy?.let { stringResource(R.string.consultations_opened_by, it) }
            val byline = listOfNotNull(detail.municipalityName, who).joinToString(" · ")
            Text(byline, style = MaterialTheme.typography.bodyMedium.copy(fontSize = 15.sp), color = palette.textTertiary, modifier = Modifier.padding(top = 2.dp))
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
        // Icons sit in 48dp targets; the 14dp slack lines the glyphs up with the 16dp margin.
        Row(Modifier.padding(start = PostInset - 14.dp, top = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            SupportIcon(detail.supported, onSupport)
            IconTarget(Icons.Outlined.Share, stringResource(R.string.common_share), MaterialTheme.colorScheme.onSurface) {
                shareText(context, detail.title, detail.slug)
            }
        }
        Row(Modifier.padding(horizontal = PostInset).offset(y = (-4).dp), verticalAlignment = Alignment.CenterVertically) {
            val replies = detail.responseCount.toInt()
            val supports = detail.supportCount.toInt()
            val counts = listOfNotNull(
                if (replies > 0) pluralStringResource(R.plurals.consultations_responses, replies, replies) else null,
                if (supports > 0) pluralStringResource(R.plurals.consultations_supports, supports, supports) else null,
            ).joinToString(" · ")
            Text(
                counts,
                style = MaterialTheme.typography.bodyMedium.copy(fontSize = 15.sp),
                color = palette.textTertiary,
                modifier = Modifier.weight(1f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            StatusPill(detail.statusValue)
        }
    }
}

// ------------------------------------------------------------------ the thread

@Composable
private fun Thread(detail: ConsultationDetail) {
    val palette = LocalPalette.current
    Column {
        Hairline()
        if (detail.responses.isEmpty()) {
            Text(
                stringResource(R.string.consultations_no_responses),
                style = MaterialTheme.typography.bodyMedium.copy(fontSize = 15.sp),
                color = palette.textTertiary,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(horizontal = PostInset, vertical = 28.dp),
            )
        } else {
            detail.responses.forEachIndexed { i, response ->
                Reply(response, detail.municipalityName, isLast = i == detail.responses.lastIndex)
            }
        }
    }
}

/** One official reply, laid out as a feed post. The line joins replies into a thread. */
@Composable
private fun Reply(response: ConsultationResponse, municipality: String, isLast: Boolean) {
    val palette = LocalPalette.current
    val iris = RutaBrand.iris
    val line = palette.hairline
    val who = "${stringResource(R.string.consultations_municipality)} · $municipality"
    Row(
        Modifier
            .fillMaxWidth()
            .drawBehind {
                if (!isLast) {
                    val x = (PostInset + PostAvatar / 2).toPx()
                    drawLine(line, Offset(x, (12.dp + PostAvatar + 6.dp).toPx()), Offset(x, size.height), strokeWidth = 2.dp.toPx(), cap = StrokeCap.Round)
                }
            }
            .padding(horizontal = PostInset)
            .padding(top = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(PostGap),
    ) {
        Box(Modifier.size(PostAvatar).background(iris.copy(alpha = 0.14f), CircleShape), Alignment.Center) {
            Icon(Icons.Filled.AccountBalance, contentDescription = null, Modifier.size(18.dp), tint = iris)
        }
        Column(Modifier.weight(1f).padding(bottom = if (isLast) 14.dp else 20.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    response.author ?: stringResource(R.string.consultations_municipality),
                    style = MaterialTheme.typography.titleSmall,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                // Who speaks, in words: the seal says "ayuntamiento".
                Icon(Icons.Filled.Verified, contentDescription = who, Modifier.size(15.dp), tint = iris)
                Spacer(Modifier.weight(1f))
                Text(relativeTimeText(response.createdAt), style = MaterialTheme.typography.bodyMedium, color = palette.textTertiary, maxLines = 1)
            }
            Text(response.body, style = MaterialTheme.typography.bodyMedium.copy(fontSize = 15.sp, lineHeight = 21.sp))
            StatusPill(response.statusAfterValue, Modifier.padding(top = 6.dp))
        }
    }
}
