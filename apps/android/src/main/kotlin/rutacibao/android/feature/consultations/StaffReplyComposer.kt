package rutacibao.android.feature.consultations

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import rutacibao.android.R
import rutacibao.android.feature.comments.CommentComposer
import rutacibao.android.feature.comments.CommentLimits
import rutacibao.android.feature.comments.ComposerToolbar
import rutacibao.android.feature.comments.ReplyField
import rutacibao.android.feature.comments.ComposerSurface
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.PersonOutline
import androidx.compose.runtime.remember
import androidx.compose.ui.unit.sp
import rutacibao.android.ui.Hairline
import rutacibao.android.ui.LocalPalette
import rutacibao.api.generated.ConsultationsRespondInput.StatusAfter
import rutacibao.presentation.comments.CommentsUiState
import rutacibao.presentation.comments.CommentsViewModel
import rutacibao.presentation.consultations.ConsultationDetailUiState
import rutacibao.presentation.consultations.ConsultationDetailViewModel
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.ui.focus.focusRequester
import rutacibao.android.feature.comments.ReplyPill

private fun StatusAfter.label(): Int = when (this) {
    StatusAfter.InReview -> R.string.consultations_status_label_in_review
    StatusAfter.Answered -> R.string.consultations_status_label_answered
    StatusAfter.Resolved -> R.string.consultations_status_label_resolved
    StatusAfter.Rejected -> R.string.consultations_status_label_rejected
}


/**
 * The composer under the thread (mirrors iOS): at rest one floating capsule over the tab bar;
 * writing happens in its own full-screen reply view, so the keyboard never pushes the bar up.
 * Each mode keeps its own draft; a sent reply closes the view, a failed one keeps it open.
 */
@Composable
fun ConsultationComposer(
    state: ConsultationDetailUiState,
    vm: ConsultationDetailViewModel,
    comments: CommentsUiState,
    commentsVm: CommentsViewModel,
    open: Boolean,
    onOpenChange: (Boolean) -> Unit,
) {
    var official by rememberSaveable(state.detail?.id) { mutableStateOf(true) }
    var text by rememberSaveable(state.detail?.id) { mutableStateOf("") }
    var status by rememberSaveable(state.detail?.id) { mutableStateOf(StatusAfter.Answered) }
    val asStaff = state.canRespond && official
    val canReply = state.canRespond || comments.signedIn
    LaunchedEffect(state.replySent) {
        if (state.replySent) {
            text = ""
            onOpenChange(false)
            vm.replySentHandled()
        }
    }
    val wasSending = remember { booleanArrayOf(false) }
    LaunchedEffect(comments.sending) {
        if (wasSending[0] && !comments.sending && comments.sendError == null) onOpenChange(false)
        wasSending[0] = comments.sending
    }
    Column(Modifier.fillMaxWidth()) {
        ReplyCapsule(
            label = stringResource(
                when {
                    !canReply -> R.string.comments_sign_in_to_comment
                    asStaff -> R.string.comments_reply_placeholder
                    else -> R.string.comments_placeholder
                },
            ),
            signIn = !canReply,
        ) { if (canReply) onOpenChange(true) else commentsVm.requestSignIn() }
    }
    val detail = state.detail
    if (open && detail != null) {
        ReplyDialog(
            detail = detail,
            state = state,
            comments = comments,
            asStaff = asStaff,
            text = if (asStaff) text else comments.draft,
            onTextChange = { if (asStaff) text = it else commentsVm.updateDraft(it) },
            official = official,
            onOfficialChange = { official = it },
            status = status,
            onStatusChange = { status = it },
            onSend = { if (asStaff) vm.respond(text, status) else commentsVm.send() },
            onClose = { onOpenChange(false) },
        )
    }
}

/** The resting composer: one floating capsule that opens the reply view (or asks to sign in, with an arrow). */
@Composable
private fun ReplyCapsule(label: String, signIn: Boolean, onClick: () -> Unit) {
    val palette = LocalPalette.current
    ComposerSurface(expanded = false) {
        Row(
            Modifier.fillMaxWidth().defaultMinSize(minHeight = 40.dp).clip(CircleShape)
                .clickable(role = Role.Button, onClick = onClick).padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(label, style = MaterialTheme.typography.bodyLarge.copy(fontSize = 17.sp), color = palette.textSecondary, maxLines = 1, modifier = Modifier.weight(1f))
            if (signIn) Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, tint = palette.textSecondary, modifier = Modifier.size(20.dp))
        }
    }
}

/**
 * Writing a reply, as X and Threads do it (mirrors iOS's reply sheet): "Cancelar" and the accent
 * "Responder" pill on top; the post with its author's photo and a thread line running down to
 * yours; the field, focused; and above the keyboard the staff's tools and the character ring.
 */
@Composable
private fun ReplyDialog(
    detail: rutacibao.presentation.consultations.ConsultationDetail,
    state: ConsultationDetailUiState,
    comments: CommentsUiState,
    asStaff: Boolean,
    text: String,
    onTextChange: (String) -> Unit,
    official: Boolean,
    onOfficialChange: (Boolean) -> Unit,
    status: StatusAfter,
    onStatusChange: (StatusAfter) -> Unit,
    onSend: () -> Unit,
    onClose: () -> Unit,
) {
    val palette = LocalPalette.current
    val limit = if (asStaff) CommentLimits.OFFICIAL_REPLY else CommentLimits.COMMENT
    val sending = if (asStaff) state.replying else comments.sending
    val canSend = if (asStaff) text.isNotBlank() && text.length <= limit else comments.canSend
    val author = detail.openedBy ?: if (detail.isMine) stringResource(R.string.consultations_you) else detail.categoryName
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
    LaunchedEffect(official) { runCatching { focus.requestFocus() } }
    androidx.compose.ui.window.Dialog(
        onDismissRequest = onClose,
        properties = androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        androidx.compose.material3.Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            Column(Modifier.fillMaxSize().systemBarsPadding().imePadding()) {
                Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    TextButton(onClick = onClose, modifier = Modifier.defaultMinSize(minHeight = 48.dp)) {
                        Text(stringResource(R.string.common_cancel), style = MaterialTheme.typography.bodyLarge.copy(fontSize = 17.sp), color = palette.text)
                    }
                    Spacer(Modifier.weight(1f))
                    ReplyPill(canSend, sending, onSend)
                }
                Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp)) {
                    // The post, and the thread line from its author down to you.
                    Row(Modifier.height(androidx.compose.foundation.layout.IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            rutacibao.android.feature.comments.ThreadAvatar(author, detail.openedByImage, size = 40.dp)
                            Box(Modifier.width(2.dp).weight(1f).clip(CircleShape).background(palette.fillPressed))
                        }
                        Column(Modifier.weight(1f).padding(bottom = 18.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(
                                author + " · " + rutacibao.android.ui.relativeTimeText(detail.createdAt),
                                style = MaterialTheme.typography.bodyMedium.copy(fontSize = 15.sp, fontWeight = FontWeight.Bold),
                                maxLines = 1,
                            )
                            Text(detail.title, style = MaterialTheme.typography.bodyMedium.copy(fontSize = 15.sp, fontWeight = FontWeight.SemiBold))
                            Text(detail.body, style = MaterialTheme.typography.bodyMedium.copy(fontSize = 15.sp, lineHeight = 20.sp), maxLines = 4, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                            val name = detail.openedBy
                            if (!detail.isMine && name != null) {
                                Box(Modifier.padding(top = 8.dp)) { rutacibao.android.feature.comments.ReplyingToLine(name) }
                            }
                        }
                    }
                    // You: who answers, and the field.
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(Modifier.size(40.dp).background(palette.fill, CircleShape), contentAlignment = Alignment.Center) {
                            Icon(if (asStaff) Icons.Filled.AccountBalance else Icons.Filled.PersonOutline, contentDescription = null, Modifier.size(20.dp), tint = palette.text)
                        }
                        val placeholder = stringResource(if (asStaff) R.string.comments_reply_placeholder else R.string.comments_placeholder)
                        androidx.compose.foundation.text.BasicTextField(
                            value = text,
                            onValueChange = onTextChange,
                            enabled = !sending,
                            textStyle = MaterialTheme.typography.bodyLarge.copy(fontSize = 17.sp, color = MaterialTheme.colorScheme.onSurface),
                            cursorBrush = androidx.compose.ui.graphics.SolidColor(palette.accentInk),
                            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(capitalization = androidx.compose.ui.text.input.KeyboardCapitalization.Sentences),
                            modifier = Modifier.weight(1f).padding(top = 9.dp).focusRequester(focus).semantics { contentDescription = placeholder },
                            decorationBox = { inner ->
                                if (text.isEmpty()) Text(placeholder, style = MaterialTheme.typography.bodyLarge.copy(fontSize = 17.sp), color = palette.textSecondary)
                                inner()
                            },
                        )
                    }
                    ReplyErrors(state, comments, asStaff, onSend)
                }
                // Above the keyboard: the staff's tools and the ring.
                Hairline()
                Row(
                    Modifier.fillMaxWidth().defaultMinSize(minHeight = 48.dp).padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    if (state.canRespond) {
                        ModeTool(official, !sending, onOfficialChange)
                        if (asStaff) StatusTool(status, state.replyStatuses, !sending, onStatusChange)
                    }
                    Spacer(Modifier.weight(1f))
                    if (text.isNotEmpty()) rutacibao.android.feature.comments.CharacterRing(text.length, limit)
                }
            }
        }
    }
}

@Composable
private fun ReplyErrors(state: ConsultationDetailUiState, comments: CommentsUiState, asStaff: Boolean, retry: () -> Unit) {
    val palette = LocalPalette.current
    val message = when {
        asStaff && state.replyError == ConsultationDetailUiState.ReplyError.TooShort -> R.string.gestion_reply_too_short
        asStaff && state.replyError != null -> R.string.comments_official_reply_failed
        !asStaff && comments.sendError != null -> R.string.comments_send_failed
        else -> null
    } ?: return
    Column(Modifier.padding(start = 48.dp, top = 8.dp).semantics { liveRegion = LiveRegionMode.Polite }) {
        Text(stringResource(message), style = MaterialTheme.typography.bodyMedium, color = palette.dangerInk)
        if (message != R.string.gestion_reply_too_short) {
            TextButton(onClick = retry, modifier = Modifier.defaultMinSize(minHeight = 48.dp)) { Text(stringResource(R.string.common_retry)) }
        }
    }
}

/** A tool in X's composer toolbar: a blue glyph (a word only where the glyph can't say it) and a chevron. */
@Composable
private fun ToolLabel(icon: ImageVector, title: String?, enabled: Boolean, description: String, value: String, onClick: () -> Unit) {
    val palette = LocalPalette.current
    Row(
        Modifier.defaultMinSize(minWidth = 48.dp, minHeight = 48.dp).clip(RoundedCornerShape(8.dp))
            .clickable(enabled = enabled, role = Role.DropdownList, onClick = onClick)
            .semantics(mergeDescendants = true) { contentDescription = description; stateDescription = value },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(icon, contentDescription = null, Modifier.size(20.dp), tint = palette.accentInk)
        if (title != null) Text(title, style = MaterialTheme.typography.labelLarge.copy(fontSize = 15.sp, fontWeight = FontWeight.SemiBold), color = palette.accentInk, maxLines = 1)
        Icon(Icons.Filled.KeyboardArrowDown, contentDescription = null, Modifier.size(16.dp), tint = palette.accentInk)
    }
}

/** Who answers: a resident's comment or the ayuntamiento's official reply. */
@Composable
private fun ModeTool(official: Boolean, enabled: Boolean, onOfficialChange: (Boolean) -> Unit) {
    var open by remember { mutableStateOf(false) }
    val who = stringResource(if (official) R.string.consultations_municipality else R.string.comments_participant_mode)
    Box {
        ToolLabel(if (official) Icons.Filled.AccountBalance else Icons.Filled.PersonOutline, null, enabled, stringResource(R.string.comments_composer_mode), who) { open = true }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            DropdownMenuItem(text = { Text(stringResource(R.string.comments_participant_mode)) },
                leadingIcon = { Icon(Icons.Filled.PersonOutline, contentDescription = null) },
                onClick = { onOfficialChange(false); open = false }, modifier = Modifier.defaultMinSize(minHeight = 48.dp))
            DropdownMenuItem(text = { Text(stringResource(R.string.consultations_municipality)) },
                leadingIcon = { Icon(Icons.Filled.AccountBalance, contentDescription = null) },
                onClick = { onOfficialChange(true); open = false }, modifier = Modifier.defaultMinSize(minHeight = 48.dp))
        }
    }
}

/** The status the case is left in after the official reply. */
@Composable
private fun StatusTool(status: StatusAfter, statuses: List<StatusAfter>, enabled: Boolean, onStatusChange: (StatusAfter) -> Unit) {
    var open by remember { mutableStateOf(false) }
    val value = stringResource(status.label())
    Box {
        ToolLabel(Icons.Outlined.Flag, value, enabled, stringResource(R.string.comments_status_after), value) { open = true }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            statuses.forEach { option ->
                DropdownMenuItem(
                    text = { Text(stringResource(option.label()), fontWeight = if (option == status) FontWeight.Bold else FontWeight.Normal) },
                    onClick = { onStatusChange(option); open = false },
                    modifier = Modifier.defaultMinSize(minHeight = 48.dp),
                )
            }
        }
    }
}
