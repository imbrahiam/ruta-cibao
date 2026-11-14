package rutacibao.android.feature.comments

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.PersonOutline
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.offset
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.foundation.layout.Spacer
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.material.icons.filled.Verified
import androidx.compose.foundation.clickable
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import rutacibao.android.R
import rutacibao.android.feature.auth.SignInDialog
import rutacibao.android.feature.map.absoluteUrl
import rutacibao.android.ui.SkeletonFeed
import rutacibao.android.ui.Hairline
import rutacibao.android.ui.LocalAppGraph
import rutacibao.android.ui.LocalPalette
import rutacibao.android.ui.relativeTimeText
import rutacibao.api.generated.SafetyReportInput
import rutacibao.data.Comment
import rutacibao.presentation.UiError
import rutacibao.presentation.comments.CommentSubject
import rutacibao.presentation.comments.CommentsUiState
import rutacibao.presentation.comments.CommentsViewModel

/** Flat, real comments: no invented likes, nested replies or additional backend actions. [empty] is null when official replies already fill the thread. */
fun LazyListScope.commentThread(state: CommentsUiState, vm: CommentsViewModel, empty: String?) {
    if (empty != null && state.items.isEmpty() && !state.loading && state.loadError == null) {
        item(key = "comments:empty") {
            Text(empty, style = MaterialTheme.typography.bodyMedium, color = LocalPalette.current.textTertiary, textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 32.dp))
        }
    }
    items(state.items, key = { "comment:${it.id}" }) { comment ->
        CommentRow(comment, state.workingCommentId != null, vm)
    }
    if (state.loading) {
        item(key = "comments:loading") { SkeletonFeed(count = if (state.items.isEmpty()) 3 else 1) }
    }
    item(key = "comments:footer") {
        Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
            if (state.loading) {
                // The skeleton above stands in.
            } else if (state.loadError != null) {
                ThreadLoadError(state.loadError!!, vm::retryLoad)
            } else if (state.canLoadMore) {
                TextButton(onClick = vm::loadMore, modifier = Modifier.defaultMinSize(minHeight = 48.dp)) {
                    Text(stringResource(R.string.comments_more))
                }
            }
            state.actionError?.let { CommentError(it, stringResource(R.string.comments_action_failed), vm::retryAction) }
        }
    }
}

/** The thread's heading in X's "Relevant" style: bold, grey (mirrors iOS). */
@Composable
fun CommentsHeader(title: String, @Suppress("UNUSED_PARAMETER") total: Int) {
    Text(
        title,
        style = MaterialTheme.typography.titleSmall.copy(fontSize = 15.sp, fontWeight = FontWeight.Bold),
        color = LocalPalette.current.textSecondary,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp).padding(top = 16.dp, bottom = 8.dp).semantics { heading() },
    )
}

/**
 * X's reply row, shared by residents and the ayuntamiento (mirrors iOS): 40dp avatar, bold name,
 * then in grey the handle slot ("Oficial" for the ayuntamiento, after X's blue seal) and the age;
 * the text at 15sp under it; a rule.
 */
@Composable
fun ReplyRow(
    name: String,
    age: String,
    body: String,
    avatar: @Composable () -> Unit,
    official: Boolean = false,
    trailing: (@Composable () -> Unit)? = null,
) {
    val palette = LocalPalette.current
    Column {
        Row(Modifier.fillMaxWidth().padding(start = 12.dp, end = if (trailing != null) 2.dp else 12.dp, top = 12.dp, bottom = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            avatar()
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.Top) {
                    Row(Modifier.weight(1f).padding(top = 1.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text(name, style = MaterialTheme.typography.titleSmall.copy(fontSize = 15.sp, fontWeight = FontWeight.Bold), maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                        if (official) {
                            Icon(Icons.Filled.Verified, contentDescription = null, Modifier.size(16.dp), tint = palette.accentInk)
                            Text(stringResource(R.string.comments_official_badge), style = MaterialTheme.typography.bodyMedium.copy(fontSize = 15.sp), color = palette.textSecondary, maxLines = 1)
                        }
                        Text("· $age", style = MaterialTheme.typography.bodyMedium.copy(fontSize = 15.sp), color = palette.textSecondary, maxLines = 1)
                    }
                    trailing?.invoke()
                }
                SelectionContainer { Text(body, style = MaterialTheme.typography.bodyMedium.copy(fontSize = 15.sp, lineHeight = 20.sp), modifier = Modifier.padding(top = 2.dp, end = if (trailing != null) 12.dp else 0.dp)) }
            }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(palette.hairline))
    }
}

/** X's "Uh oh, an error was encountered / Try again": centred, bold, one action. */
@Composable
private fun ThreadLoadError(error: UiError, retry: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().padding(top = 24.dp, bottom = 8.dp).semantics { liveRegion = LiveRegionMode.Polite },
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            stringResource(if (error == UiError.Offline) R.string.common_offline else R.string.common_error_title),
            style = MaterialTheme.typography.titleSmall.copy(fontSize = 15.sp, fontWeight = FontWeight.Bold),
        )
        TextButton(onClick = retry, modifier = Modifier.defaultMinSize(minHeight = 48.dp)) {
            Text(stringResource(R.string.common_retry), color = LocalPalette.current.textSecondary)
        }
    }
}

@Composable
fun ThreadAvatar(name: String?, image: String?, modifier: Modifier = Modifier, size: Dp = 36.dp) {
    Box(modifier.size(size).clip(CircleShape).background(LocalPalette.current.fill), contentAlignment = Alignment.Center) {
        if (name.isNullOrBlank()) {
            Icon(Icons.Filled.PersonOutline, contentDescription = null, modifier = Modifier.size(size * 0.55f), tint = LocalPalette.current.textSecondary)
        } else {
            val initials = name.trim().split(Regex("\\s+")).take(2).joinToString("") { it.take(1) }.uppercase()
            Text(
                initials,
                style = MaterialTheme.typography.labelLarge.copy(fontSize = (size.value * 0.36f).sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold),
                color = LocalPalette.current.text,
            )
        }
        if (!image.isNullOrBlank()) AsyncImage(model = absoluteUrl(image), contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.matchParentSize())
    }
}

@Composable
private fun CommentRow(comment: Comment, working: Boolean, vm: CommentsViewModel) {
    var menu by remember(comment.id) { mutableStateOf(false) }
    var reporting by remember(comment.id) { mutableStateOf(false) }
    var deleting by remember(comment.id) { mutableStateOf(false) }
    ReplyRow(
        name = comment.author,
        age = relativeTimeText(comment.createdAt),
        body = comment.body,
        avatar = { ThreadAvatar(comment.author, comment.authorImage, size = 40.dp) },
        trailing = {
            Box(Modifier.offset(y = (-12).dp).height(24.dp), contentAlignment = Alignment.TopCenter) {
                IconButton(onClick = { menu = true }, enabled = !working, modifier = Modifier.size(48.dp)) {
                    Icon(Icons.Filled.MoreHoriz, contentDescription = stringResource(R.string.comments_options), tint = LocalPalette.current.textTertiary)
                }
                DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                    DropdownMenuItem(
                        text = { Text(stringResource(if (comment.isMine) R.string.comments_delete else R.string.comments_report)) },
                        onClick = { menu = false; if (comment.isMine) deleting = true else reporting = true },
                        modifier = Modifier.defaultMinSize(minHeight = 48.dp),
                    )
                }
            }
        },
    )
    if (deleting) AlertDialog(
        onDismissRequest = { deleting = false },
        title = { Text(stringResource(R.string.comments_delete)) },
        text = { Text(comment.body, modifier = Modifier.verticalScroll(rememberScrollState())) },
        confirmButton = { TextButton(onClick = { deleting = false; vm.delete(comment.id) }) { Text(stringResource(R.string.comments_delete)) } },
        dismissButton = { TextButton(onClick = { deleting = false }) { Text(stringResource(R.string.common_cancel)) } },
    )
    if (reporting) AlertDialog(
        onDismissRequest = { reporting = false },
        title = { Text(stringResource(R.string.comments_report)) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                SafetyReportInput.Reason.entries.forEach { reason ->
                    TextButton(onClick = { reporting = false; vm.report(comment.id, reason) }, modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp)) {
                        Text(stringResource(when (reason) {
                            SafetyReportInput.Reason.Abuse -> R.string.safety_reasons_abuse
                            SafetyReportInput.Reason.PersonalInformation -> R.string.safety_reasons_personal_information
                            SafetyReportInput.Reason.Unsafe -> R.string.safety_reasons_unsafe
                            SafetyReportInput.Reason.Other -> R.string.safety_reasons_other
                        }))
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = { TextButton(onClick = { reporting = false }) { Text(stringResource(R.string.common_cancel)) } },
    )
}

/** One geometry for both composers (resident and staff). */
val ComposerHeight = 40.dp

/** The server's limits, so the ring fills where the server would refuse. */
object CommentLimits {
    const val COMMENT = 500
    const val OFFICIAL_REPLY = 2_000
}

/**
 * X's reply bar (mirrors iOS). At rest: one grey pill. Writing: "Respondiendo a" with the name in
 * blue above the pill, and under it X's toolbar: tools on the left (staff's mode), the character
 * ring and the blue "Responder" pill on the right. The caller owns the anchored surface.
 */
@Composable
fun CommentComposer(
    state: CommentsUiState,
    vm: CommentsViewModel,
    placeholder: String,
    signInLabel: String,
    /** Shown above the field while composing: "Respondiendo a …". */
    replyingTo: String? = null,
    /** Staff's "who answers" menu, shown in the toolbar while writing. */
    tools: (@Composable () -> Unit)? = null,
    /** Lets the post's reply button jump straight into the field. */
    focusRequester: FocusRequester? = null,
) {
    var focused by remember { mutableStateOf(false) }
    val expanded = focused || state.draft.isNotEmpty()
    val palette = LocalPalette.current
    ComposerSurface(expanded = expanded && state.signedIn) {
        state.sendError?.let { CommentError(it, stringResource(R.string.comments_send_failed), vm::send) }
        if (!state.signedIn) {
            Row(
                Modifier.fillMaxWidth().defaultMinSize(minHeight = ComposerHeight).clip(CircleShape)
                    .clickable(onClick = vm::requestSignIn).padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(signInLabel, style = MaterialTheme.typography.bodyLarge.copy(fontSize = 17.sp), color = palette.textSecondary, modifier = Modifier.weight(1f))
                Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, tint = palette.textSecondary, modifier = Modifier.size(20.dp))
            }
        } else {
            if (expanded && replyingTo != null) ReplyingToLine(replyingTo)
            ReplyField(
                value = state.draft,
                onValueChange = vm::updateDraft,
                placeholder = placeholder,
                sending = state.sending,
                onFocusChange = { focused = it },
                focusRequester = focusRequester,
                inset = if (expanded) 4.dp else 12.dp,
            )
            if (expanded) {
                ComposerToolbar(
                    tools = tools,
                    count = state.draft.length,
                    limit = CommentLimits.COMMENT,
                    canSend = state.canSend,
                    sending = state.sending,
                    onSend = vm::send,
                )
            }
        }
    }
}

/** "Respondiendo a Franklin": grey, the name in X's blue. */
@Composable
fun ReplyingToLine(name: String) {
    val palette = LocalPalette.current
    val line = stringResource(R.string.comments_replying_to, name)
    val at = line.lastIndexOf(name)
    Text(
        buildAnnotatedString {
            withStyle(SpanStyle(color = palette.textSecondary)) { append(if (at >= 0) line.substring(0, at) else line) }
            if (at >= 0) {
                withStyle(SpanStyle(color = palette.accentInk)) { append(name) }
                withStyle(SpanStyle(color = palette.textSecondary)) { append(line.substring(at + name.length)) }
            }
        },
        style = MaterialTheme.typography.bodyMedium.copy(fontSize = 15.sp),
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        modifier = Modifier.padding(start = 4.dp),
    )
}

/**
 * The composer floating over the thread, just above the tab bar (mirrors iOS's Liquid Glass
 * capsule): the tab bar's own translucent surface, rule and shadow. At rest a 48dp capsule; while
 * writing it grows into a card holding the context line, the field and the toolbar.
 */
@Composable
fun ComposerSurface(expanded: Boolean, content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit) {
    val palette = LocalPalette.current
    androidx.compose.material3.Surface(
        modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, bottom = 8.dp),
        shape = RoundedCornerShape(24.dp),
        color = palette.glass,
        shadowElevation = 10.dp,
        border = androidx.compose.foundation.BorderStroke(0.5.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(
            Modifier.fillMaxWidth().padding(horizontal = if (expanded) 12.dp else 4.dp, vertical = if (expanded) 10.dp else 4.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            content = content,
        )
    }
}

/** The field inside the floating surface: 17sp text, grows to five lines. */
@Composable
fun ReplyField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    sending: Boolean,
    onFocusChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    focusRequester: FocusRequester? = null,
    /** 12dp in the capsule, 4dp in the open card (the card adds its own 12, lining up with the toolbar). */
    inset: androidx.compose.ui.unit.Dp = 12.dp,
) {
    val palette = LocalPalette.current
    Box(
        modifier.fillMaxWidth().defaultMinSize(minHeight = ComposerHeight)
            .padding(horizontal = inset, vertical = 9.dp),
        contentAlignment = Alignment.CenterStart,
    ) {
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            enabled = !sending,
            textStyle = MaterialTheme.typography.bodyLarge.copy(fontSize = 17.sp, color = MaterialTheme.colorScheme.onSurface),
            cursorBrush = SolidColor(palette.accentInk),
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
            maxLines = 5,
            modifier = Modifier.fillMaxWidth().heightIn(max = 144.dp)
                .then(if (focusRequester != null) Modifier.focusRequester(focusRequester) else Modifier)
                .onFocusChanged { onFocusChange(it.isFocused) }
                .semantics { contentDescription = placeholder },
            decorationBox = { inner ->
                if (value.isEmpty()) Text(placeholder, style = MaterialTheme.typography.bodyLarge.copy(fontSize = 17.sp), color = palette.textSecondary)
                inner()
            },
        )
    }
}

/** X's composer toolbar (mirrors iOS): tools on the left in blue, the ring that fills toward the limit, the blue "Responder" pill. */
@Composable
fun ComposerToolbar(
    tools: (@Composable () -> Unit)?,
    count: Int,
    limit: Int,
    canSend: Boolean,
    sending: Boolean,
    onSend: () -> Unit,
) {
    val palette = LocalPalette.current
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        tools?.invoke()
        Spacer(Modifier.weight(1f))
        if (count > 0) CharacterRing(count, limit)
        ReplyPill(canSend, sending, onSend)
    }
}

/** X's "Reply" pill in the accent, its label in `onAccent`; half-strength until there is something to send. */
@Composable
fun ReplyPill(canSend: Boolean, sending: Boolean, onSend: () -> Unit) {
    val palette = LocalPalette.current
    val active = canSend && !sending
    Box(
        Modifier
            .defaultMinSize(minHeight = 48.dp)
            .clip(CircleShape)
            .clickable(enabled = active, role = Role.Button, onClick = onSend),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            Modifier.clip(CircleShape).background(palette.accent.copy(alpha = if (canSend || sending) 1f else 0.5f))
                .defaultMinSize(minHeight = 34.dp).padding(horizontal = 16.dp),
            contentAlignment = Alignment.Center,
        ) {
            if (sending) CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = palette.onAccent)
            else Text(stringResource(R.string.comments_reply_placeholder), style = MaterialTheme.typography.labelLarge.copy(fontSize = 15.sp, fontWeight = FontWeight.Bold), color = palette.onAccent)
        }
    }
}

/** X's character ring (mirrors iOS): fills in blue; in the last 20 it shows what's left (amber), past the limit red. */
@Composable
fun CharacterRing(count: Int, limit: Int) {
    val palette = LocalPalette.current
    val left = limit - count
    val near = left <= 20
    val ink = when { left < 0 -> palette.danger; near -> palette.warning; else -> palette.accentInk }
    val label = pluralStringResource(R.plurals.comments_characters_left, maxOf(0, left), maxOf(0, left))
    val track = palette.fill
    Box(
        Modifier.size(if (near) 28.dp else 22.dp).clearAndSetSemantics { contentDescription = label }
            .drawBehind {
                val stroke = 2.dp.toPx()
                drawArc(track, 0f, 360f, false, style = androidx.compose.ui.graphics.drawscope.Stroke(stroke))
                drawArc(ink, -90f, 360f * minOf(1f, count.toFloat() / limit), false, style = androidx.compose.ui.graphics.drawscope.Stroke(stroke, cap = androidx.compose.ui.graphics.StrokeCap.Round))
            },
        contentAlignment = Alignment.Center,
    ) {
        if (near) Text(left.toString(), style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp), color = if (left < 0) palette.danger else palette.textSecondary)
    }
}

@Composable
private fun CommentError(error: UiError, fallback: String, retry: () -> Unit) {
    Column(Modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite }) {
        Text(stringResourceOrFallback(error, fallback), style = MaterialTheme.typography.bodyMedium, color = LocalPalette.current.dangerInk)
        TextButton(onClick = retry, modifier = Modifier.defaultMinSize(minHeight = 48.dp)) { Text(stringResource(R.string.common_retry)) }
    }
}

@Composable
private fun stringResourceOrFallback(error: UiError, fallback: String): String = when (error) {
    UiError.Offline -> stringResource(R.string.common_offline)
    UiError.SignedOut -> stringResource(R.string.comments_sign_in_to_comment)
    else -> fallback
}

@Composable
fun CommentDialogs(state: CommentsUiState, vm: CommentsViewModel) {
    if (state.signInRequested) SignInDialog(onDismiss = vm::signInHandled)
    if (state.reported) AlertDialog(
        onDismissRequest = vm::reportHandled,
        text = { Text(stringResource(R.string.comments_reported)) },
        confirmButton = { TextButton(onClick = vm::reportHandled) { Text(stringResource(R.string.common_close)) } },
    )
}

/** Parent opens this from a place's Experiences action; placeSlug is the public place slug, not its id. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlaceExperiencesSheet(placeSlug: String, placeName: String, onDismiss: () -> Unit) {
    val graph = LocalAppGraph.current
    val vm: CommentsViewModel = viewModel(key = "place-comments:$placeSlug") {
        graph.viewModels.comments().also { it.load(CommentSubject.Place, placeSlug) }
    }
    val state by vm.state.collectAsStateWithLifecycle()
    val empty = stringResource(R.string.comments_empty_experiences)
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = MaterialTheme.colorScheme.background) {
        Column(Modifier.fillMaxWidth().fillMaxHeight(0.92f)) {
            Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 4.dp), verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f).padding(vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(stringResource(R.string.comments_experiences), style = MaterialTheme.typography.titleLarge, modifier = Modifier.semantics { heading() })
                    Text(placeName, style = MaterialTheme.typography.bodyMedium, color = LocalPalette.current.textSecondary)
                }
                IconButton(onClick = onDismiss, modifier = Modifier.size(48.dp)) { Icon(Icons.Filled.Close, contentDescription = stringResource(R.string.common_close)) }
            }
            LazyColumn(Modifier.weight(1f)) {
                commentThread(state, vm, empty = empty)
            }
            CommentComposer(state, vm, stringResource(R.string.comments_experience_placeholder), stringResource(R.string.comments_sign_in_to_experience))
        }
    }
    CommentDialogs(state, vm)
}
