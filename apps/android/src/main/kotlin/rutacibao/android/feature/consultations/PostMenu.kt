package rutacibao.android.feature.consultations

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.delay
import java.util.UUID
import rutacibao.android.R
import rutacibao.android.feature.auth.SignInDialog
import rutacibao.android.ui.LocalAppGraph
import rutacibao.android.ui.LocalPalette
import rutacibao.presentation.safety.ReportReason
import rutacibao.presentation.safety.SafetyViewModel

private const val StepActions = 0
private const val StepReasons = 1
private const val StepDetails = 2

/** The post's "…" sheet, Threads-style: grouped actions, Report apart and red, then the reasons as a list. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PostMenuSheet(consultationId: String, slug: String, title: String, onHidden: () -> Unit, onDismiss: () -> Unit) {
    val graph = LocalAppGraph.current
    val key = remember { UUID.randomUUID().toString() }
    val vm: SafetyViewModel = viewModel(key = key) { graph.viewModels.safety() }
    val state by vm.state.collectAsStateWithLifecycle()
    var step by rememberSaveable { mutableIntStateOf(StepActions) }
    var confirmingHide by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = step != StepActions)

    DisposableEffect(vm) { onDispose { vm.reset() } }
    LaunchedEffect(state.hidden) {
        if (state.hidden) {
            onHidden()
            onDismiss()
        }
    }
    LaunchedEffect(state.reported) {
        if (state.reported) {
            delay(1800)
            onDismiss()
        }
    }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = MaterialTheme.colorScheme.background) {
        Box(Modifier.navigationBarsPadding()) {
            when {
                state.reported -> ReportSent()
                step == StepActions -> Actions(
                    errorCode = state.errorCode,
                    onShare = { onDismiss(); shareText(context, title, slug) },
                    onHide = { confirmingHide = true },
                    onReport = { step = StepReasons },
                )
                step == StepReasons -> Reasons(
                    reasons = vm.reasons,
                    working = state.working,
                    errorCode = state.errorCode,
                    onPick = { reason ->
                        if (reason == ReportReason.Other) step = StepDetails else vm.report(consultationId, reason, null)
                    },
                )
                else -> Details(working = state.working, errorCode = state.errorCode) { vm.report(consultationId, ReportReason.Other, it) }
            }
        }
    }

    if (confirmingHide) {
        AlertDialog(
            onDismissRequest = { confirmingHide = false },
            title = { Text(stringResource(R.string.safety_block_title)) },
            text = { Text(stringResource(R.string.safety_block_body)) },
            confirmButton = {
                TextButton(onClick = { confirmingHide = false; vm.hideAuthor(consultationId) }) {
                    Text(stringResource(R.string.safety_block_confirm), color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = { TextButton(onClick = { confirmingHide = false }) { Text(stringResource(R.string.common_cancel)) } },
        )
    }
    if (state.signInRequested) SignInDialog(onDismiss = vm::signInHandled)
}

@Composable
private fun Actions(errorCode: String?, onShare: () -> Unit, onHide: () -> Unit, onReport: () -> Unit) {
    val danger = MaterialTheme.colorScheme.error
    Column(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        MenuGroup {
            MenuRow(stringResource(R.string.common_share), Icons.Outlined.Share, onClick = onShare)
        }
        MenuGroup {
            MenuRow(stringResource(R.string.safety_block_action), Icons.Outlined.VisibilityOff, onClick = onHide)
            HorizontalDivider(Modifier.padding(start = 16.dp), color = MaterialTheme.colorScheme.outlineVariant)
            MenuRow(stringResource(R.string.safety_report_action), Icons.Outlined.Flag, tint = danger, onClick = onReport)
        }
        ErrorLine(errorCode)
    }
}

@Composable
private fun ErrorLine(code: String?) {
    if (code == null) return
    Text(safetyError(code), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(horizontal = 4.dp))
}

@Composable
private fun safetyError(code: String): String = stringResource(
    when (code) {
        "own_content" -> R.string.safety_errors_own_content
        "no_author" -> R.string.safety_errors_no_author
        "not_found" -> R.string.safety_errors_not_found
        else -> R.string.safety_errors_generic
    },
)

@Composable
private fun MenuGroup(content: @Composable () -> Unit) {
    Column(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(16.dp))) { content() }
}

@Composable
private fun MenuRow(title: String, icon: androidx.compose.ui.graphics.vector.ImageVector, tint: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.onSurface, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().defaultMinSize(minHeight = 56.dp).clickable(onClick = onClick).padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(title, style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium), color = tint, modifier = Modifier.weight(1f))
        Icon(icon, contentDescription = null, Modifier.size(22.dp), tint = tint)
    }
}

@Composable
private fun Reasons(reasons: List<ReportReason>, working: Boolean, errorCode: String?, onPick: (ReportReason) -> Unit) {
    val palette = LocalPalette.current
    Column(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(Modifier.padding(horizontal = 4.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(stringResource(R.string.safety_report_reason_label), style = MaterialTheme.typography.titleMedium)
            Text(stringResource(R.string.safety_report_subtitle), style = MaterialTheme.typography.bodyMedium, color = palette.textSecondary)
        }
        MenuGroup {
            reasons.forEachIndexed { index, reason ->
                if (index > 0) HorizontalDivider(Modifier.padding(start = 16.dp), color = MaterialTheme.colorScheme.outlineVariant)
                Row(
                    Modifier.fillMaxWidth().defaultMinSize(minHeight = 56.dp)
                        .clickable(enabled = !working) { onPick(reason) }.padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(stringResource(reasonLabel(reason)), style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                    Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, contentDescription = null, tint = palette.textTertiary)
                }
            }
        }
        ErrorLine(errorCode)
    }
}

private fun reasonLabel(reason: ReportReason): Int = when (reason) {
    ReportReason.Abuse -> R.string.safety_reasons_abuse
    ReportReason.PersonalInformation -> R.string.safety_reasons_personal_information
    ReportReason.Unsafe -> R.string.safety_reasons_unsafe
    ReportReason.Other -> R.string.safety_reasons_other
}

@Composable
private fun Details(working: Boolean, errorCode: String?, onSubmit: (String) -> Unit) {
    var details by rememberSaveable { mutableStateOf("") }
    Column(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(stringResource(R.string.safety_reasons_other), style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(horizontal = 4.dp))
        OutlinedTextField(
            value = details,
            onValueChange = { details = it.take(500) },
            label = { Text(stringResource(R.string.safety_report_details_label)) },
            supportingText = { Text(stringResource(R.string.safety_report_details_hint)) },
            minLines = 4,
            maxLines = 8,
            keyboardOptions = KeyboardOptions.Default,
            modifier = Modifier.fillMaxWidth(),
        )
        ErrorLine(errorCode)
        Button(onClick = { onSubmit(details) }, enabled = !working, modifier = Modifier.fillMaxWidth().height(52.dp)) {
            Text(stringResource(R.string.safety_report_submit))
        }
    }
}

@Composable
private fun ReportSent() {
    val palette = LocalPalette.current
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 32.dp, vertical = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(Icons.Filled.CheckCircle, contentDescription = null, Modifier.size(56.dp), tint = palette.success)
        Text(stringResource(R.string.safety_report_sent), style = MaterialTheme.typography.titleLarge)
        Text(stringResource(R.string.safety_report_sent_hint), style = MaterialTheme.typography.bodyMedium, color = palette.textSecondary, textAlign = TextAlign.Center)
        Spacer(Modifier.height(4.dp))
    }
}
