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
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilledIconButton
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
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import rutacibao.android.R
import rutacibao.android.feature.comments.CommentComposer
import rutacibao.android.ui.Hairline
import rutacibao.android.ui.LocalPalette
import rutacibao.api.generated.ConsultationsRespondInput.StatusAfter
import rutacibao.presentation.comments.CommentsUiState
import rutacibao.presentation.comments.CommentsViewModel
import rutacibao.presentation.consultations.ConsultationDetailUiState
import rutacibao.presentation.consultations.ConsultationDetailViewModel

private fun StatusAfter.label(): Int = when (this) {
    StatusAfter.InReview -> R.string.consultations_status_label_in_review
    StatusAfter.Answered -> R.string.consultations_status_label_answered
    StatusAfter.Resolved -> R.string.consultations_status_label_resolved
    StatusAfter.Rejected -> R.string.consultations_status_label_rejected
}

/** A solid bottom bar shared by participants and staff. Each mode keeps its own draft. */
@Composable
fun ConsultationComposer(
    state: ConsultationDetailUiState,
    vm: ConsultationDetailViewModel,
    comments: CommentsUiState,
    commentsVm: CommentsViewModel,
) {
    var official by rememberSaveable(state.detail?.id) { mutableStateOf(false) }
    var text by rememberSaveable(state.detail?.id) { mutableStateOf("") }
    var status by rememberSaveable(state.detail?.id) { mutableStateOf(StatusAfter.Answered) }
    var modeMenu by rememberSaveable { mutableStateOf(false) }
    val busy = state.replying || comments.sending
    LaunchedEffect(state.replySent) {
        if (state.replySent) {
            text = ""
            vm.replySentHandled()
        }
    }
    Column(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface).imePadding()) {
        Hairline()
        if (state.canRespond) {
            Box(Modifier.padding(horizontal = 12.dp)) {
                TextButton(onClick = { modeMenu = true }, enabled = !busy, modifier = Modifier.defaultMinSize(minHeight = 48.dp)) {
                    Text(stringResource(R.string.comments_composer_mode) + " · " + stringResource(if (official) R.string.comments_official_mode else R.string.comments_participant_mode),
                        modifier = Modifier.weight(1f, fill = false), style = MaterialTheme.typography.labelLarge)
                    Icon(Icons.Filled.ArrowDropDown, contentDescription = null)
                }
                DropdownMenu(expanded = modeMenu, onDismissRequest = { modeMenu = false }) {
                    DropdownMenuItem(text = { Text(stringResource(R.string.comments_participant_mode)) },
                        onClick = { official = false; modeMenu = false }, modifier = Modifier.defaultMinSize(minHeight = 48.dp))
                    DropdownMenuItem(text = { Text(stringResource(R.string.comments_official_mode)) },
                        onClick = { official = true; modeMenu = false }, modifier = Modifier.defaultMinSize(minHeight = 48.dp))
                }
            }
        }
        if (state.canRespond && official) {
            StaffReplyComposer(state, vm, text, { text = it }, status, { status = it })
        } else {
            CommentComposer(comments, commentsVm, stringResource(R.string.comments_placeholder), stringResource(R.string.comments_sign_in_to_comment))
        }
    }
}

/** Official status is visible in words and only in official mode; the input never overlays the thread. */
@Composable
private fun StaffReplyComposer(
    state: ConsultationDetailUiState,
    vm: ConsultationDetailViewModel,
    text: String,
    onTextChange: (String) -> Unit,
    status: StatusAfter,
    onStatusChange: (StatusAfter) -> Unit,
) {
    val palette = LocalPalette.current
    var menu by rememberSaveable { mutableStateOf(false) }
    val replyLabel = stringResource(R.string.gestion_reply_title)
    val statusLabel = stringResource(R.string.comments_status_after)
    val statusName = stringResource(status.label())
    Column(Modifier.padding(horizontal = 12.dp).padding(bottom = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Box {
            Column(Modifier.defaultMinSize(minHeight = 48.dp).clip(RoundedCornerShape(16.dp)).background(palette.inset)
                .clickable(enabled = !state.replying, role = Role.DropdownList) { menu = true }
                .semantics { contentDescription = statusLabel; stateDescription = statusName }
                .padding(horizontal = 12.dp, vertical = 8.dp)) {
                Text(statusLabel, style = MaterialTheme.typography.labelMedium, color = palette.textSecondary)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(statusName, style = MaterialTheme.typography.labelLarge, modifier = Modifier.weight(1f, fill = false))
                    Icon(Icons.Filled.ArrowDropDown, contentDescription = null)
                }
            }
            DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                state.replyStatuses.forEach { option ->
                    DropdownMenuItem(text = { Text(stringResource(option.label())) }, onClick = { onStatusChange(option); menu = false },
                        modifier = Modifier.defaultMinSize(minHeight = 48.dp))
                }
            }
        }
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.padding(bottom = 8.dp).size(32.dp).background(MaterialTheme.colorScheme.primaryContainer, CircleShape), contentAlignment = Alignment.Center) {
                Icon(Icons.Filled.AccountBalance, contentDescription = null, modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.onPrimaryContainer)
            }
            Box(Modifier.weight(1f).defaultMinSize(minHeight = 48.dp).clip(RoundedCornerShape(24.dp)).background(palette.inset)
                .padding(horizontal = 16.dp, vertical = 12.dp), contentAlignment = Alignment.CenterStart) {
                BasicTextField(
                    value = text,
                    onValueChange = onTextChange,
                    enabled = !state.replying,
                    textStyle = MaterialTheme.typography.bodyLarge.copy(color = MaterialTheme.colorScheme.onSurface),
                    cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                    maxLines = 5,
                    modifier = Modifier.fillMaxWidth().heightIn(max = 144.dp).semantics { contentDescription = replyLabel },
                    decorationBox = { inner ->
                        if (text.isEmpty()) Text(replyLabel, style = MaterialTheme.typography.bodyLarge, color = palette.textTertiary)
                        inner()
                    },
                )
            }
            FilledIconButton(onClick = { vm.respond(text, status) }, enabled = !state.replying && text.isNotBlank(), modifier = Modifier.size(48.dp)) {
                if (state.replying) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
                else Icon(Icons.AutoMirrored.Filled.Send, contentDescription = stringResource(R.string.gestion_reply_send))
            }
        }
        state.replyError?.let { error ->
            Column(Modifier.semantics { liveRegion = LiveRegionMode.Polite }) {
                Text(stringResource(if (error == ConsultationDetailUiState.ReplyError.TooShort) R.string.gestion_reply_too_short else R.string.comments_official_reply_failed),
                    style = MaterialTheme.typography.bodyMedium, color = palette.dangerInk)
                if (error == ConsultationDetailUiState.ReplyError.Failed) {
                    TextButton(onClick = { vm.respond(text, status) }, enabled = !state.replying, modifier = Modifier.defaultMinSize(minHeight = 48.dp)) {
                        Text(stringResource(R.string.common_retry))
                    }
                }
            }
        }
    }
}
