package rutacibao.android.feature.gestion

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import rutacibao.android.R
import rutacibao.android.feature.auth.CodeCells
import rutacibao.android.ui.LocalPalette
import rutacibao.android.ui.PrimaryButton
import rutacibao.presentation.gestion.StepUpError
import rutacibao.presentation.gestion.StepUpState

/**
 * The second-factor prompt for staff actions. Six digits auto-submit; a recovery code has its
 * own field and button. The shared gate replays whatever was held back once the code is accepted.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StepUpSheet(
    state: StepUpState,
    onVerify: (String) -> Unit,
    onUseRecovery: (Boolean) -> Unit,
    onDismiss: () -> Unit,
) {
    if (state is StepUpState.None) return
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(
            Modifier.fillMaxWidth().imePadding().navigationBarsPadding().padding(horizontal = 24.dp).padding(bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                stringResource(R.string.gestion_step_up_title),
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier.semantics { heading() },
            )
            when (state) {
                StepUpState.EnrollOnWeb -> Text(
                    stringResource(R.string.gestion_enroll_on_web),
                    style = MaterialTheme.typography.bodyLarge,
                    color = LocalPalette.current.textSecondary,
                )
                is StepUpState.Asking -> Entry(state.recovery, state.error, busy = false, onVerify, onUseRecovery)
                is StepUpState.Verifying -> Entry(state.recovery, null, busy = true, onVerify, onUseRecovery)
                StepUpState.None -> Unit
            }
        }
    }
}

@Composable
private fun Entry(
    recovery: Boolean,
    error: StepUpError?,
    busy: Boolean,
    onVerify: (String) -> Unit,
    onUseRecovery: (Boolean) -> Unit,
) {
    val palette = LocalPalette.current
    var code by remember(recovery) { mutableStateOf("") }
    val focus = remember(recovery) { FocusRequester() }
    LaunchedEffect(recovery) { focus.requestFocus() }
    LaunchedEffect(error) { if (error != null && !recovery) code = "" }

    Text(stringResource(R.string.gestion_step_up_body), style = MaterialTheme.typography.bodyLarge, color = palette.textSecondary)
    if (recovery) {
        OutlinedTextField(
            value = code,
            onValueChange = { code = it },
            label = { Text(stringResource(R.string.gestion_recovery_code)) },
            singleLine = true,
            isError = error != null,
            enabled = !busy,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii, imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { if (code.trim().length >= 6) onVerify(code) }),
            modifier = Modifier.fillMaxWidth().focusRequester(focus),
        )
        PrimaryButton(
            stringResource(R.string.common_continue),
            { onVerify(code) },
            Modifier.fillMaxWidth(),
            enabled = !busy && code.trim().length >= 6,
            busy = busy,
        )
    } else {
        CodeCells(
            code = code,
            error = error != null,
            focus = focus,
            onCode = { raw ->
                if (busy) return@CodeCells
                val digits = raw.filter(Char::isDigit).take(6)
                code = digits
                if (digits.length == 6) onVerify(digits)
            },
        )
    }
    if (error != null) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.ErrorOutline, contentDescription = null, Modifier.size(18.dp), tint = palette.dangerInk)
            Text(
                stringResource(if (error == StepUpError.Offline) R.string.common_offline_body else R.string.gestion_step_up_invalid),
                style = MaterialTheme.typography.bodyMedium,
                color = palette.dangerInk,
            )
        }
    }
    TextButton(
        onClick = { onUseRecovery(!recovery) },
        enabled = !busy,
        modifier = Modifier.defaultMinSize(minHeight = 48.dp),
    ) {
        Text(stringResource(if (recovery) R.string.gestion_use_authenticator else R.string.gestion_use_recovery))
    }
}
