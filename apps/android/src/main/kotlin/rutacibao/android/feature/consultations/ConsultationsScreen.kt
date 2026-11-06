package rutacibao.android.feature.consultations

import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.layout.layout
import android.content.Intent
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.gestures.animateScrollBy
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import rutacibao.android.generated.RutaBrand
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import rutacibao.android.R
import rutacibao.android.feature.auth.SignInDialog
import rutacibao.android.navigation.LocalTabBarClearance
import rutacibao.android.ui.LoadingMark
import rutacibao.android.ui.EmptyState
import rutacibao.android.ui.ErrorState
import rutacibao.android.ui.LocalAppGraph
import rutacibao.android.ui.LocalPalette
import rutacibao.android.ui.LocalReducedMotion
import rutacibao.android.ui.CategoryAvatar
import rutacibao.android.ui.Hairline
import rutacibao.android.ui.statusInk
import rutacibao.android.ui.statusLabel
import rutacibao.android.ui.relativeTimeText
import rutacibao.presentation.UiError
import rutacibao.presentation.consultations.Consultation
import rutacibao.presentation.consultations.ConsultationStatus
import rutacibao.presentation.consultations.ConsultationsUiState.Phase
import rutacibao.presentation.consultations.ConsultationsViewModel
import rutacibao.presentation.consultations.statusValue

@Composable
fun ConsultationsScreen(onOpen: (String) -> Unit = {}) {
    val graph = LocalAppGraph.current
    val vm: ConsultationsViewModel = viewModel { graph.viewModels.consultations() }
    val state by vm.state.collectAsStateWithLifecycle()
    val screenName = stringResource(R.string.consultations_title)
    val pull = rememberPullToRefreshState()

    Column(Modifier.fillMaxSize().semantics { paneTitle = screenName }) {
        when (state.phase) {
            Phase.Ready -> PullToRefreshBox(
                isRefreshing = state.refreshing,
                onRefresh = vm::refresh,
                state = pull,
            ) {
                val list = rememberLazyListState()
                val nearEnd by remember {
                    derivedStateOf { (list.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0) >= list.layoutInfo.totalItemsCount - 4 }
                }
                LaunchedEffect(nearEnd, state.items.size) { if (nearEnd) vm.loadMore() }
                LazyColumn(
                    state = list,
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(bottom = LocalTabBarClearance.current + 16.dp),
                ) {
                    item(key = "header") { FeedHeader(state.filters, state.status, vm::selectStatus) }
                    items(state.items, key = { it.id }) { item ->
                        PostRow(item, onOpen = { onOpen(item.slug) }, onToggleSupport = { vm.toggleSupport(item.id) }, onHidden = vm::hiddenChanged)
                    }
                    if (state.loadingMore) {
                        item { Box(Modifier.fillMaxWidth().padding(24.dp), Alignment.Center) { LoadingMark(28.dp, spinning = true) } }
                    }
                }
            }
            else -> {
                FeedHeader(state.filters, state.status, vm::selectStatus)
                when (state.phase) {
                    Phase.Loading -> LoadingFeed()
                    Phase.Failed -> ErrorState(state.error ?: UiError.Unknown, onRetry = vm::retry)
                    else -> EmptyState(
                        stringResource(R.string.consultations_empty),
                        stringResource(R.string.consultations_empty_body),
                    )
                }
            }
        }
    }

    if (state.signInRequested) SignInDialog(onDismiss = vm::signInHandled)
}

/** The status chips; scrolls away with the list. */
@Composable
private fun FeedHeader(filters: List<ConsultationStatus?>, selected: ConsultationStatus?, onSelect: (ConsultationStatus?) -> Unit) {
    StatusFilters(filters, selected, onSelect)
}

/**
 * X's header tabs: bare words, the current one in ink and bolder, the rest tertiary.
 * Weight changes with colour, so state is never colour alone.
 */
@Composable
private fun StatusFilters(filters: List<ConsultationStatus?>, selected: ConsultationStatus?, onSelect: (ConsultationStatus?) -> Unit) {
    val description = stringResource(R.string.consultations_filter_status)
    val palette = LocalPalette.current
    val listState = rememberLazyListState()
    val selectedIndex = filters.indexOf(selected).coerceAtLeast(0)
    LaunchedEffect(selectedIndex) {
        val info = listState.layoutInfo
        val target = info.visibleItemsInfo.firstOrNull { it.index == selectedIndex }
        val center = (info.viewportEndOffset + info.viewportStartOffset) / 2
        if (target != null) listState.animateScrollBy((target.offset + target.size / 2 - center).toFloat())
        else listState.animateScrollToItem(selectedIndex)
    }
    Box {
        LazyRow(
            state = listState,
            contentPadding = PaddingValues(horizontal = PostInset),
            horizontalArrangement = Arrangement.spacedBy(22.dp),
            modifier = Modifier.semantics { contentDescription = description },
        ) {
            items(filters, key = { it?.name ?: "all" }) { status ->
                val isSelected = selected == status
                Box(
                    Modifier
                        .defaultMinSize(minHeight = 48.dp)
                        .selectable(selected = isSelected, role = Role.Tab, onClick = { onSelect(status) }),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        status?.let { statusLabel(it) } ?: stringResource(R.string.consultations_all_tab),
                        style = MaterialTheme.typography.bodyLarge.copy(
                            fontSize = 16.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.SemiBold,
                        ),
                        color = if (isSelected) palette.text else palette.textTertiary,
                        maxLines = 1,
                    )
                }
            }
        }
        Hairline(Modifier.align(Alignment.BottomCenter))
    }
}

@Composable
private fun LoadingFeed() {
    val label = stringResource(R.string.common_loading)
    Box(Modifier.fillMaxSize().semantics { contentDescription = label }, Alignment.Center) { LoadingMark(PullMark, spinning = true) }
}

@Composable
private fun PostRow(item: Consultation, onOpen: () -> Unit, onToggleSupport: () -> Unit, onHidden: (String) -> Unit) {
    val scheme = MaterialTheme.colorScheme
    val time = relativeTimeText(item.createdAt)
    val lineColor = scheme.outlineVariant
    var menuOpen by remember { androidx.compose.runtime.mutableStateOf(false) }
    var columnTop by remember { androidx.compose.runtime.mutableFloatStateOf(0f) }
    var miniTop by remember { androidx.compose.runtime.mutableFloatStateOf(0f) }
    var viewerStart by remember { androidx.compose.runtime.mutableStateOf<Int?>(null) }
    viewerStart?.let { PhotoViewer(item.photos.orEmpty(), it) { viewerStart = null } }
    if (menuOpen) {
        PostMenuSheet(
            consultationId = item.id,
            slug = item.slug,
            title = item.title,
            onHidden = { onHidden(item.id) },
            onDismiss = { menuOpen = false },
        )
    }
    Column(
        Modifier
            .fillMaxWidth()
            .onGloballyPositioned { columnTop = it.positionInRoot().y }
            .drawBehind {
                // Thread line: from under the avatar down to the small replier avatar when the ayuntamiento replied.
                if (item.responseCount > 0 && miniTop > columnTop) {
                    val x = (PostInset + PostAvatar / 2).toPx()
                    drawLine(
                        lineColor,
                        Offset(x, (14.dp + PostAvatar + 6.dp).toPx()),
                        Offset(x, miniTop - columnTop - 3.dp.toPx()),
                        strokeWidth = 2.dp.toPx(),
                        cap = StrokeCap.Round,
                    )
                }
            }
            .padding(vertical = 14.dp),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onOpen)
                .padding(horizontal = PostInset),
            horizontalArrangement = Arrangement.spacedBy(PostGap),
        ) {
            CategoryAvatar(item.categoryIcon, item.categoryColor, PostAvatar)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        item.title,
                        style = MaterialTheme.typography.titleSmall,
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f),
                    )
                    Text(time, style = MaterialTheme.typography.bodyMedium, color = LocalPalette.current.textTertiary, maxLines = 1)
                    Icon(
                        Icons.Filled.MoreHoriz,
                        contentDescription = stringResource(R.string.safety_ui_menu_label),
                        Modifier
                            .offset(x = 2.dp)
                            .touchTarget(20.dp)
                            .clickable(role = Role.Button) { menuOpen = true }
                            .padding(14.dp),
                        tint = LocalPalette.current.textTertiary,
                    )
                }
            }
        }
        val photos = item.photos.orEmpty()
        if (photos.isNotEmpty()) {
            PostPhotos(photos, onOpen = { viewerStart = it }, modifier = Modifier.padding(start = PostColumn, top = 10.dp))
        }
        ActionsRow(item, onOpen, onToggleSupport, Modifier.padding(start = PostColumn - 14.dp, end = PostInset))
        // Pulled up into the 48dp targets' slack: the icons keep their touch area, the line sits close like iOS.
        Row(Modifier.padding(horizontal = PostInset).offset(y = (-6).dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.width(PostAvatar), Alignment.Center) {
                if (item.responseCount > 0) ReplierMini(Modifier.onGloballyPositioned { miniTop = it.positionInRoot().y })
            }
            Spacer(Modifier.width(PostGap))
            PostCounts(item)
        }
    }
    Hairline()
}

/** The ayuntamiento's small avatar under the post's, where the thread line ends. */
@Composable
private fun ReplierMini(modifier: Modifier = Modifier) {
    val iris = RutaBrand.iris
    Box(
        modifier
            .size(20.dp)
            .background(MaterialTheme.colorScheme.background, CircleShape)
            .padding(1.5.dp)
            .background(iris.copy(alpha = 0.18f), CircleShape),
        Alignment.Center,
    ) {
        Icon(Icons.Filled.AccountBalance, contentDescription = null, Modifier.size(9.dp), tint = iris)
    }
}

/** "En revisión · 1 respuesta · 9 apoyos": only the parts that say something. */
@Composable
private fun PostCounts(item: Consultation, modifier: Modifier = Modifier) {
    val muted = LocalPalette.current.textTertiary
    val status = item.statusValue
    val replies = if (item.responseCount > 0) pluralStringResource(R.plurals.consultations_responses, item.responseCount.toInt(), item.responseCount.toInt()) else null
    val supports = if (item.supportCount > 0) pluralStringResource(R.plurals.consultations_supports, item.supportCount.toInt(), item.supportCount.toInt()) else null
    val statusText = if (status != ConsultationStatus.Open) statusLabel(status) else null
    val ink = statusInk(status)
    if (statusText == null && replies == null && supports == null) return
    val text = buildAnnotatedString {
        var first = true
        fun sep() { if (!first) append(" · "); first = false }
        statusText?.let { sep(); withStyle(SpanStyle(color = ink, fontWeight = FontWeight.Medium)) { append(it) } }
        replies?.let { sep(); append(it) }
        supports?.let { sep(); append(it) }
    }
    Text(text, style = MaterialTheme.typography.bodyMedium.copy(fontSize = 15.sp), color = muted, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = modifier.padding(top = 2.dp))
}

/** Bare icons in 48dp targets, no counts beside them. */
@Composable
private fun ActionsRow(item: Consultation, onReply: () -> Unit, onToggleSupport: () -> Unit, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val ink = MaterialTheme.colorScheme.onSurface
    val shareLabel = stringResource(R.string.common_share)
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        SupportIcon(item.supported, onToggleSupport)
        IconTarget(Icons.Outlined.ChatBubbleOutline, stringResource(R.string.consultations_timeline), ink, onReply)
        IconTarget(Icons.AutoMirrored.Outlined.Send, shareLabel, ink) { shareText(context, item.title, item.slug) }
    }
}

fun shareText(context: android.content.Context, title: String, slug: String) {
    val label = context.getString(R.string.common_share)
    val send = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, "$title\nhttps://rutacibao.do/consultas/$slug")
    }
    context.startActivity(Intent.createChooser(send, label))
}

@Composable
internal fun IconTarget(icon: ImageVector, label: String, tint: Color, onClick: () -> Unit) {
    Box(
        Modifier.size(48.dp).clip(CircleShape).clickable(role = Role.Button, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = label, Modifier.size(20.dp), tint = tint)
    }
}

@Composable
internal fun SupportIcon(supported: Boolean, onToggle: () -> Unit) {
    val haptics = LocalHapticFeedback.current
    val reduced = LocalReducedMotion.current
    val ink = if (supported) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
    val scale = remember { Animatable(1f) }
    val first = remember { booleanArrayOf(true) }
    LaunchedEffect(supported) {
        if (first[0]) { first[0] = false; return@LaunchedEffect }
        if (!reduced) {
            scale.animateTo(1.3f, tween(90))
            scale.animateTo(1f, spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMedium))
        }
    }
    val label = stringResource(if (supported) R.string.consultations_supported else R.string.consultations_support)
    Box(
        Modifier
            .size(48.dp)
            .clip(CircleShape)
            .toggleable(value = supported, role = Role.Checkbox, interactionSource = remember { MutableInteractionSource() }, indication = androidx.compose.material3.ripple()) {
                haptics.performHapticFeedback(if (supported) HapticFeedbackType.ToggleOff else HapticFeedbackType.ToggleOn)
                onToggle()
            }
            .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            if (supported) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
            contentDescription = null,
            Modifier.size(20.dp).scale(scale.value),
            tint = ink,
        )
    }
}

/** Column maths for the post layout, shared with the composer and the contributions rows. */
val PostInset = 16.dp
val PostAvatar = 36.dp
val PostGap = 12.dp
val PostColumn = PostInset + PostAvatar + PostGap

private val PullMark = 56.dp

/**
 * A [visible]-sized slot whose hit area is the 48dp minimum: the node measures
 * 48dp but reports only [visible] to the row, centred, so the header keeps its
 * Threads-tight height while the touch target meets WCAG 2.5.8 / Material.
 */
private fun Modifier.touchTarget(visible: Dp): Modifier = layout { measurable, constraints ->
    val full = 48.dp.roundToPx()
    val placeable = measurable.measure(Constraints.fixed(full, full))
    val shown = visible.roundToPx()
    layout(shown, shown) { placeable.place((shown - full) / 2, (shown - full) / 2) }
}
