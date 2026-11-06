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
import rutacibao.android.ui.SkeletonFeed
import rutacibao.android.ui.StatusPill
import rutacibao.android.ui.parseCategoryColor
import rutacibao.android.ui.categoryIcon
import rutacibao.android.ui.RutaHighlight
import androidx.compose.ui.graphics.Brush
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
                        item { SkeletonFeed(count = 1) }
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
 * Threads' chips (mirrors iOS), 36 tall inside a 48 hit area: a hairline outline at rest, a
 * soft grey fill and bolder label when chosen; a trailing fade says the row scrolls.
 */
@Composable
private fun StatusFilters(filters: List<ConsultationStatus?>, selected: ConsultationStatus?, onSelect: (ConsultationStatus?) -> Unit) {
    val description = stringResource(R.string.consultations_filter_status)
    val palette = LocalPalette.current
    val background = MaterialTheme.colorScheme.background
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
            horizontalArrangement = Arrangement.spacedBy(8.dp),
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
                    Box(
                        Modifier
                            .height(36.dp)
                            .clip(CircleShape)
                            .background(if (isSelected) palette.inset else Color.Transparent)
                            .border(1.dp, palette.separator, CircleShape)
                            .padding(horizontal = 16.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            status?.let { statusLabel(it) } ?: stringResource(R.string.consultations_all_tab),
                            style = MaterialTheme.typography.bodyMedium.copy(fontSize = 15.sp, fontWeight = if (isSelected) FontWeight.Bold else FontWeight.SemiBold),
                            color = palette.text,
                            maxLines = 1,
                        )
                    }
                }
            }
        }
        Box(
            Modifier
                .align(Alignment.CenterEnd)
                .width(24.dp)
                .height(48.dp)
                .background(Brush.horizontalGradient(listOf(background.copy(alpha = 0f), background)))
                .clearAndSetSemantics { },
        )
        Hairline(Modifier.align(Alignment.BottomCenter))
    }
}

@Composable
private fun LoadingFeed() {
    SkeletonFeed()
}

@Composable
private fun PostRow(item: Consultation, onOpen: () -> Unit, onToggleSupport: () -> Unit, onHidden: (String) -> Unit) {
    val palette = LocalPalette.current
    val time = relativeTimeText(item.createdAt)
    var menuOpen by remember { androidx.compose.runtime.mutableStateOf(false) }
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
    Column(Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 6.dp)) {
        Column(Modifier.fillMaxWidth().clickable(onClick = onOpen).padding(start = PostInset)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(
                    categoryIcon(item.categoryIcon),
                    contentDescription = null,
                    Modifier.size(20.dp),
                    tint = parseCategoryColor(item.categoryColor, palette.textSecondary),
                )
                Text(
                    item.categoryName,
                    style = MaterialTheme.typography.bodyMedium.copy(fontSize = 13.sp),
                    color = palette.textSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                Text("·", style = MaterialTheme.typography.bodyMedium.copy(fontSize = 13.sp), color = palette.textTertiary)
                Text(time, style = MaterialTheme.typography.bodyMedium.copy(fontSize = 13.sp), color = palette.textSecondary, maxLines = 1)
                Spacer(Modifier.weight(1f))
                StatusPill(item.statusValue, neutral = true)
                Icon(
                    Icons.Filled.MoreHoriz,
                    contentDescription = stringResource(R.string.safety_ui_menu_label),
                    Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .clickable(role = Role.Button) { menuOpen = true }
                        .padding(14.dp),
                    tint = palette.textTertiary,
                )
            }
            Text(
                item.title,
                style = MaterialTheme.typography.titleMedium.copy(fontSize = 17.sp, fontWeight = FontWeight.SemiBold),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.fillMaxWidth().padding(end = PostInset),
            )
        }
        val photos = item.photos.orEmpty()
        if (photos.isNotEmpty()) {
            PostPhotos(photos, onOpen = { viewerStart = it }, modifier = Modifier.padding(start = PostInset, top = 10.dp))
        }
        ActionsRow(item, onOpen, onToggleSupport, Modifier.padding(start = PostInset - 14.dp, end = PostInset - 14.dp))
    }
    Hairline()
}

/** Heart with its count, the comment icon, then share at the far end. */
@Composable
private fun ActionsRow(item: Consultation, onReply: () -> Unit, onToggleSupport: () -> Unit, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    // X's action row: every icon in the secondary grey; only a given heart turns red.
    val ink = LocalPalette.current.textSecondary
    val shareLabel = stringResource(R.string.common_share)
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        SupportIcon(item.supported, onToggleSupport, count = item.supportCount.toInt())
        IconTarget(Icons.Outlined.ChatBubbleOutline, stringResource(R.string.consultations_timeline), ink, onReply)
        Spacer(Modifier.weight(1f))
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
internal fun SupportIcon(supported: Boolean, onToggle: () -> Unit, count: Int = 0) {
    val haptics = LocalHapticFeedback.current
    val reduced = LocalReducedMotion.current
    // Red when you have supported, the secondary label colour otherwise; filled vs outline also carries the state.
    val ink = if (supported) RutaHighlight.support() else LocalPalette.current.textSecondary
    val scale = remember { Animatable(1f) }
    val first = remember { booleanArrayOf(true) }
    LaunchedEffect(supported) {
        if (first[0]) { first[0] = false; return@LaunchedEffect }
        if (!reduced) {
            scale.animateTo(1.3f, tween(90))
            scale.animateTo(1f, spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMedium))
        }
    }
    val label = if (count > 0) pluralStringResource(R.plurals.consultations_supports, count, count) else stringResource(if (supported) R.string.consultations_supported else R.string.consultations_support)
    Row(
        Modifier
            .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
            .clip(RoundedCornerShape(24.dp))
            .toggleable(value = supported, role = Role.Checkbox, interactionSource = remember { MutableInteractionSource() }, indication = androidx.compose.material3.ripple()) {
                haptics.performHapticFeedback(if (supported) HapticFeedbackType.ToggleOff else HapticFeedbackType.ToggleOn)
                onToggle()
            }
            .semantics { contentDescription = label }
            .padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(
            if (supported) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
            contentDescription = null,
            Modifier.size(20.dp).scale(scale.value),
            tint = ink,
        )
        if (count > 0) {
            Text(count.toString(), style = MaterialTheme.typography.bodyMedium, color = LocalPalette.current.textSecondary, modifier = Modifier.clearAndSetSemantics { })
        }
    }
}

/** Column maths for the post layout, shared with the composer and the contributions rows. */
val PostInset = 16.dp
val PostAvatar = 40.dp
val PostGap = 12.dp
val PostColumn = PostInset + PostAvatar + PostGap


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
