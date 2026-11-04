package rutacibao.android.feature.map

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Surface
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import java.util.UUID
import rutacibao.android.R
import rutacibao.android.feature.contribute.FieldBox
import rutacibao.android.feature.contribute.Problem
import rutacibao.android.feature.contribute.SendError
import rutacibao.android.feature.contribute.SubmitBar
import rutacibao.android.ui.LocalAppGraph
import rutacibao.android.ui.PushedScreen
import rutacibao.presentation.business.BusinessFormMode
import rutacibao.presentation.business.BusinessFormProblem
import rutacibao.presentation.business.BusinessSubmit
import rutacibao.presentation.business.Contact

/** Claiming a business and the owner's later edits share this one form. */
@Composable
fun BusinessFormDialog(
    placeId: String,
    mode: BusinessFormMode,
    contact: Contact?,
    onDone: () -> Unit,
    onDismiss: () -> Unit,
) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        val graph = LocalAppGraph.current
        val key = remember { UUID.randomUUID().toString() }
        val vm: rutacibao.presentation.business.BusinessFormViewModel = viewModel(key = key) {
            graph.viewModels.businessForm().also { it.start(placeId, mode, contact) }
        }
        val state by vm.state.collectAsStateWithLifecycle()
        var phone by rememberSaveable { mutableStateOf(contact?.phone.orEmpty()) }
        var whatsapp by rememberSaveable { mutableStateOf(contact?.whatsapp.orEmpty()) }
        var hours by rememberSaveable { mutableStateOf(contact?.hours.orEmpty()) }
        var evidence by rememberSaveable { mutableStateOf("") }
        val claiming = mode == BusinessFormMode.Claim
        LaunchedEffect(state.submit) {
            if (state.submit is BusinessSubmit.Done) {
                onDone()
                onDismiss()
            }
        }
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            PushedScreen(
                title = stringResource(if (claiming) R.string.place_claim_action else R.string.place_edit_business),
                onBack = onDismiss,
                bottomBar = {
                    SubmitBar(
                        stringResource(if (claiming) R.string.place_claim_submit else R.string.place_business_save),
                        state.submitting,
                        !state.submitting,
                        vm::submit,
                    )
                },
            ) { padding ->
                Column(
                    Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(18.dp),
                ) {
                    if (claiming) {
                        FieldBox(evidence, { evidence = it.take(600); vm.updateEvidence(it) }, stringResource(R.string.place_claim_evidence), minLines = 4)
                        Problem(BusinessFormProblem.Evidence in state.problems, stringResource(R.string.place_business_evidence_short))
                    }
                    FieldBox(phone, { phone = it.take(24); vm.updatePhone(it) }, stringResource(R.string.place_claim_phone), keyboardType = KeyboardType.Phone)
                    Problem(BusinessFormProblem.Phone in state.problems, stringResource(R.string.place_business_phone_invalid))
                    FieldBox(whatsapp, { whatsapp = it.take(24); vm.updateWhatsapp(it) }, stringResource(R.string.place_whatsapp), keyboardType = KeyboardType.Phone)
                    Problem(BusinessFormProblem.Whatsapp in state.problems, stringResource(R.string.place_business_phone_invalid))
                    FieldBox(hours, { hours = it.take(240); vm.updateHours(it) }, stringResource(R.string.place_hours))
                    (state.submit as? BusinessSubmit.Failed)?.let { SendError(it.error) }
                }
            }
        }
    }
}
