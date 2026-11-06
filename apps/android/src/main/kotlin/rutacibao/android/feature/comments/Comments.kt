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
import androidx.compose.ui.focus.onFocusChanged
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

/** Flat, real comments: no invented likes, nested replies or additional backend actions. */
fun LazyListScope.commentThread(state: CommentsUiState, vm: CommentsViewModel, empty: String) {
    if (state.items.isEmpty() && !state.loading && state.loadError == null) {
        item(key = "comments:empty") {
            Text(empty, style = MaterialTheme.typography.bodyMedium, color = LocalPalette.current.textTertiary,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 28.dp))
        }
    }
    items(state.items, key = { "comment:${it.id}" }) { comment ->
        CommentRow(comment, state.workingCommentId != null, vm)
        Hairline()
    }
    if (state.loading) {
        item(key = "comments:loading") { SkeletonFeed(count = if (state.items.isEmpty()) 3 else 1) }
    }
    item(key = "comments:footer") {
        Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
            if (state.loading) {
                // The skeleton above stands in.
            } else if (state.loadError != null) {
                CommentError(state.loadError!!, stringResource(R.string.common_error_body), vm::retryLoad)
            } else if (state.canLoadMore) {
                TextButton(onClick = vm::loadMore, modifier = Modifier.defaultMinSize(minHeight = 48.dp)) {
                    Text(stringResource(R.string.comments_more))
                }
            }
            state.actionError?.let { CommentError(it, stringResource(R.string.comments_action_failed), vm::retryAction) }
        }
    }
}

@Composable
fun CommentsHeader(title: String, total: Int) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(top = 18.dp, bottom = 8.dp).semantics { heading() },
        horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f, fill = false))
        if (total > 0) Text(total.toString(), style = MaterialTheme.typography.titleMedium, color = LocalPalette.current.textTertiary)
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
    // X's reply row (mirrors iOS): 40dp avatar, bold name and grey age on one line at the
    // same size, the text under it, a full-width hairline below.
    Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 4.dp, top = 14.dp, bottom = 14.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        ThreadAvatar(comment.author, comment.authorImage, size = 40.dp)
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.Top) {
                Row(Modifier.weight(1f).padding(top = 1.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(comment.author, style = MaterialTheme.typography.titleSmall.copy(fontSize = 15.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold), maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                    Text("· " + relativeTimeText(comment.createdAt), style = MaterialTheme.typography.bodyMedium.copy(fontSize = 15.sp), color = LocalPalette.current.textTertiary, maxLines = 1)
                }
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
            }
            SelectionContainer { Text(comment.body, style = MaterialTheme.typography.bodyLarge.copy(fontSize = 16.sp, lineHeight = 22.sp), modifier = Modifier.padding(top = 3.dp, end = 12.dp)) }
        }
    }
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

/**
 * X's reply bar (mirrors iOS): a quiet grey pill at rest; focused or holding a draft it names
 * who you answer and shows the send button. The caller owns the anchored surface and insets.
 */
@Composable
fun CommentComposer(
    state: CommentsUiState,
    vm: CommentsViewModel,
    placeholder: String,
    signInLabel: String,
    /** Shown above the field while composing: "Respondiendo a …". */
    replyingTo: String? = null,
    /** Leads the field (staff's "who answers" chip), so the composer stays one row. */
    leading: (@Composable () -> Unit)? = null,
) {
    var focused by remember { mutableStateOf(false) }
    val expanded = focused || state.draft.isNotEmpty()
    val palette = LocalPalette.current
    Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        if (!state.signedIn) {
            Row(
                Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp).clip(RoundedCornerShape(24.dp)).background(palette.inset)
                    .clickable(onClick = vm::requestSignIn).padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(signInLabel, style = MaterialTheme.typography.bodyLarge, color = palette.textSecondary, modifier = Modifier.weight(1f))
                Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, tint = palette.textSecondary, modifier = Modifier.size(20.dp))
            }
        } else {
            if (expanded && replyingTo != null) {
                Text(
                    stringResource(R.string.comments_replying_to, replyingTo),
                    style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp),
                    color = palette.textTertiary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(start = if (leading == null) 16.dp else 0.dp),
                )
            }
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (leading != null) leading()
                Row(
                    Modifier.weight(1f).defaultMinSize(minHeight = 48.dp).clip(RoundedCornerShape(24.dp)).background(palette.inset),
                    verticalAlignment = Alignment.Bottom,
                ) {
                    Box(Modifier.weight(1f).padding(start = 16.dp, end = if (expanded) 4.dp else 16.dp, top = 13.dp, bottom = 13.dp), contentAlignment = Alignment.CenterStart) {
                        BasicTextField(
                            value = state.draft,
                            onValueChange = vm::updateDraft,
                            enabled = !state.sending,
                            textStyle = MaterialTheme.typography.bodyLarge.copy(color = MaterialTheme.colorScheme.onSurface),
                            cursorBrush = SolidColor(palette.text),
                            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                            maxLines = 5,
                            modifier = Modifier.fillMaxWidth().heightIn(max = 144.dp).onFocusChanged { focused = it.isFocused }
                                .semantics { contentDescription = placeholder },
                            decorationBox = { inner ->
                                if (state.draft.isEmpty()) Text(placeholder, style = MaterialTheme.typography.bodyLarge, color = palette.textTertiary)
                                inner()
                            },
                        )
                    }
                    if (expanded) {
                        FilledIconButton(
                            onClick = vm::send,
                            enabled = state.canSend,
                            modifier = Modifier.padding(4.dp).size(40.dp),
                            colors = IconButtonDefaults.filledIconButtonColors(
                                containerColor = palette.accent,
                                contentColor = palette.onAccent,
                                disabledContainerColor = palette.accent.copy(alpha = 0.35f),
                                disabledContentColor = palette.onAccent,
                            ),
                        ) {
                            if (state.sending) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = palette.onAccent)
                            else Icon(Icons.Filled.ArrowUpward, contentDescription = stringResource(R.string.comments_send), modifier = Modifier.size(20.dp))
                        }
                    }
                }
            }
        }
        state.sendError?.let { CommentError(it, stringResource(R.string.comments_send_failed), vm::send) }
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
            Column(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface)) {
                Hairline()
                CommentComposer(state, vm, stringResource(R.string.comments_experience_placeholder), stringResource(R.string.comments_sign_in_to_experience))
            }
        }
    }
    CommentDialogs(state, vm)
}
