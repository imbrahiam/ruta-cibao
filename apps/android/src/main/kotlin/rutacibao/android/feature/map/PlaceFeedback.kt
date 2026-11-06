package rutacibao.android.feature.map

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.outlined.Cancel
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.WifiOff
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.selection.selectable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import rutacibao.android.R
import rutacibao.android.feature.contribute.FieldBox
import rutacibao.android.feature.contribute.Problem
import rutacibao.android.feature.contribute.SendError
import rutacibao.android.feature.contribute.SubmitBar
import rutacibao.android.ui.Notice
import rutacibao.android.ui.LocalPalette
import rutacibao.android.ui.PushedScreen
import rutacibao.api.generated.PlacesConfirmInput
import rutacibao.api.generated.PlacesDetailOutput
import rutacibao.api.generated.PlacesReportInput
import rutacibao.presentation.map.PlaceReportState
import rutacibao.presentation.map.PlaceSheet

@Composable
internal fun PlaceFeedback(sheet: PlaceSheet, onConfirm: (PlacesConfirmInput.Verdict) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        val detail = sheet.detail
        if (sheet.cached) {
            Notice(Icons.Outlined.WifiOff, stringResource(R.string.common_offline), stringResource(R.string.offline_map_note), LocalPalette.current.textSecondary)
        } else if (detail != null && !detail.isMine) {
            Text(stringResource(R.string.place_still_there), style = MaterialTheme.typography.titleMedium)
            val exists = detail.myVerdict == PlacesDetailOutput.MyVerdict.Exists
            val gone = detail.myVerdict == PlacesDetailOutput.MyVerdict.Gone
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Answer(
                    stringResource(R.string.place_exists), null, exists, !sheet.confirming, Modifier.weight(1f),
                    if (exists) Icons.Filled.CheckCircle else Icons.Outlined.CheckCircle,
                ) { onConfirm(PlacesConfirmInput.Verdict.Exists) }
                Answer(
                    stringResource(R.string.place_gone), null, gone, !sheet.confirming, Modifier.weight(1f),
                    if (gone) Icons.Filled.Cancel else Icons.Outlined.Cancel,
                ) { onConfirm(PlacesConfirmInput.Verdict.Gone) }
            }
        }
        sheet.feedbackError?.let { SendError(it) }
    }
}

@Composable
internal fun PlaceReportDialog(
    report: PlaceReportState,
    onReason: (PlacesReportInput.Reason) -> Unit,
    onDetails: (String) -> Unit,
    onSubmit: () -> Unit,
    onDismiss: () -> Unit,
) {
    Dialog(
        onDismissRequest = { if (!report.submitting) onDismiss() },
        properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            PushedScreen(
                title = stringResource(R.string.place_report_title),
                onBack = { if (!report.submitting) onDismiss() },
                bottomBar = {
                    if (!report.sent) SubmitBar(stringResource(R.string.safety_report_submit), report.submitting, !report.submitting, onSubmit)
                },
            ) { padding ->
                Column(
                    Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    if (report.sent) {
                        Icon(if (report.queued) Icons.Outlined.WifiOff else Icons.Outlined.CheckCircle, contentDescription = null)
                        Text(stringResource(if (report.queued) R.string.offline_queued_toast else R.string.place_report_sent), style = MaterialTheme.typography.titleLarge)
                        Text(stringResource(if (report.queued) R.string.offline_queued_toast_body else R.string.place_report_sent_body))
                        OutlinedButton(onClick = onDismiss) { Text(stringResource(R.string.common_close)) }
                    } else {
                        PlacesReportInput.Reason.entries.forEach { reason ->
                            Row(
                                Modifier.fillMaxWidth().heightIn(min = 48.dp).selectable(
                                    selected = report.reason == reason, enabled = !report.submitting,
                                    role = Role.RadioButton, onClick = { onReason(reason) },
                                ),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                RadioButton(selected = report.reason == reason, onClick = null)
                                Text(stringResource(placeReasonLabel(reason)), Modifier.padding(start = 12.dp))
                            }
                        }
                        FieldBox(report.details, onDetails, stringResource(R.string.place_report_details), minLines = 4)
                        Problem(report.invalidDetails, stringResource(R.string.place_report_details_required))
                        report.error?.let { SendError(it) }
                    }
                }
            }
        }
    }
}

private fun placeReasonLabel(reason: PlacesReportInput.Reason): Int = when (reason) {
    PlacesReportInput.Reason.IncorrectInformation -> R.string.place_reasons_incorrect_information
    PlacesReportInput.Reason.Closed -> R.string.place_reasons_closed
    PlacesReportInput.Reason.Duplicate -> R.string.place_reasons_duplicate
    PlacesReportInput.Reason.WrongLocation -> R.string.place_reasons_wrong_location
    PlacesReportInput.Reason.Other -> R.string.place_reasons_other
}
