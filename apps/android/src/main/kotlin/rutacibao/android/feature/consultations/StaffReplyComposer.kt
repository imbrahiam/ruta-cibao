package rutacibao.android.feature.consultations

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import rutacibao.android.R
import rutacibao.android.ui.LocalPalette
import rutacibao.api.generated.ConsultationsRespondInput.StatusAfter
import rutacibao.presentation.consultations.ConsultationDetailUiState
import rutacibao.presentation.consultations.ConsultationDetailViewModel

private fun StatusAfter.label(): Int = when (this) {
    StatusAfter.InReview -> R.string.consultations_status_label_in_review
    StatusAfter.Answered -> R.string.consultations_status_label_answered
    StatusAfter.Resolved -> R.string.consultations_status_label_resolved
    StatusAfter.Rejected -> R.string.consultations_status_label_rejected
}

/**
 * The bar staff answer from: the status the case is left in, then the public reply. It paints its
 * own surface and a top divider, so the thread never shows through behind the field.
 */
@Composable
fun StaffReplyComposer(state: ConsultationDetailUiState, vm: ConsultationDetailViewModel) {
    val palette = LocalPalette.current
    var text by rememberSaveable { mutableStateOf("") }
    var status by rememberSaveable { mutableStateOf(StatusAfter.Answered) }
    var menu by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(state.replySent) {
        if (state.replySent) {
            text = ""
            vm.replySentHandled()
        }
    }

    val replyLabel = stringResource(R.string.gestion_reply_title)
    val statusLabel = stringResource(R.string.gestion_reply_status)
    val statusName = stringResource(status.label())
    Column(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surfaceContainer).imePadding()) {
        HorizontalDivider(thickness = 0.5.dp, color = MaterialTheme.colorScheme.outlineVariant)
        Column(Modifier.padding(horizontal = 12.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Box {
                Row(
                    Modifier
                        .defaultMinSize(minHeight = 48.dp)
                        .clip(CircleShape)
                        .background(palette.inset)
                        .clickable(role = Role.DropdownList) { menu = true }
                        .semantics { contentDescription = statusLabel; stateDescription = statusName }
                        .padding(start = 16.dp, end = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(statusName, style = MaterialTheme.typography.labelLarge)
                    Icon(Icons.Filled.ArrowDropDown, contentDescription = null)
                }
                DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                    state.replyStatuses.forEach { option ->
                        DropdownMenuItem(
                            text = { Text(stringResource(option.label())) },
                            onClick = { status = option; menu = false },
                            modifier = Modifier.defaultMinSize(minHeight = 48.dp),
                        )
                    }
                }
            }
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(
                    Modifier
                        .weight(1f)
                        .defaultMinSize(minHeight = 48.dp)
                        .clip(RoundedCornerShape(24.dp))
                        .background(palette.inset)
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    Alignment.CenterStart,
                ) {
                    BasicTextField(
                        value = text,
                        onValueChange = { text = it },
                        textStyle = MaterialTheme.typography.bodyLarge.copy(color = MaterialTheme.colorScheme.onSurface),
                        cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
                        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                        maxLines = 5,
                        modifier = Modifier.fillMaxWidth().semantics { contentDescription = replyLabel },
                        decorationBox = { inner ->
                            if (text.isEmpty()) Text(replyLabel, style = MaterialTheme.typography.bodyLarge, color = palette.textTertiary)
                            inner()
                        },
                    )
                }
                FilledIconButton(
                    onClick = { vm.respond(text, status) },
                    enabled = !state.replying && text.isNotBlank(),
                    modifier = Modifier.size(48.dp),
                ) {
                    if (state.replying) {
                        CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
                    } else {
                        Icon(Icons.AutoMirrored.Filled.Send, contentDescription = stringResource(R.string.gestion_reply_send))
                    }
                }
            }
            state.replyError?.let { error ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.ErrorOutline, contentDescription = null, Modifier.size(18.dp), tint = palette.dangerInk)
                    Text(
                        stringResource(if (error == ConsultationDetailUiState.ReplyError.TooShort) R.string.gestion_reply_too_short else R.string.common_error_body),
                        style = MaterialTheme.typography.bodyMedium,
                        color = palette.dangerInk,
                    )
                }
            }
        }
    }
}
