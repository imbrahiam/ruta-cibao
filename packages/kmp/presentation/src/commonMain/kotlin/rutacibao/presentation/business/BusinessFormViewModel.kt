package rutacibao.presentation.business

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.zacsweers.metro.Inject
import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import rutacibao.data.BusinessRepository
import rutacibao.presentation.UiError

public enum class BusinessFormMode { Claim, Edit }

public enum class BusinessFormProblem { Phone, Whatsapp, Evidence }

public sealed interface BusinessSubmit {
    public data object Idle : BusinessSubmit
    public data object Submitting : BusinessSubmit
    public data object Done : BusinessSubmit
    public data class Failed(val error: UiError) : BusinessSubmit
}

public data class BusinessFormUiState(
    val mode: BusinessFormMode = BusinessFormMode.Claim,
    val phone: String = "",
    val whatsapp: String = "",
    val hours: String = "",
    /** Claim mode only. */
    val evidence: String = "",
    val problems: Set<BusinessFormProblem> = emptySet(),
    val submit: BusinessSubmit = BusinessSubmit.Idle,
) {
    val submitting: Boolean get() = submit is BusinessSubmit.Submitting
}

/** One form for claiming a business and for the owner's later edits. */
@OptIn(ExperimentalUuidApi::class)
@Inject
public class BusinessFormViewModel(private val repository: BusinessRepository) : ViewModel() {
    private val _state = MutableStateFlow(BusinessFormUiState())
    public val state: StateFlow<BusinessFormUiState> = _state.asStateFlow()
    private var placeId: String? = null

    /** A new attempt keeps its id through retries, so a repeated tap can't send twice. */
    private var requestId = Uuid.random().toString()

    public fun start(placeId: String, mode: BusinessFormMode, contact: Contact?) {
        if (this.placeId == placeId && _state.value.mode == mode) return
        this.placeId = placeId
        requestId = Uuid.random().toString()
        _state.value = BusinessFormUiState(
            mode = mode,
            phone = contact?.phone.orEmpty(),
            whatsapp = contact?.whatsapp.orEmpty(),
            hours = contact?.hours.orEmpty(),
        )
    }

    public fun updatePhone(value: String) { edit { it.copy(phone = value.take(24)) } }
    public fun updateWhatsapp(value: String) { edit { it.copy(whatsapp = value.take(24)) } }
    public fun updateHours(value: String) { edit { it.copy(hours = value.take(240)) } }
    public fun updateEvidence(value: String) { edit { it.copy(evidence = value.take(600)) } }

    private fun edit(change: (BusinessFormUiState) -> BusinessFormUiState) {
        _state.update { change(it).copy(problems = emptySet(), submit = if (it.submitting) it.submit else BusinessSubmit.Idle) }
    }

    public fun submit() {
        val s = _state.value
        val id = placeId ?: return
        if (s.submitting) return
        val problems = problemsOf(s)
        if (problems.isNotEmpty()) {
            _state.update { it.copy(problems = problems) }
            return
        }
        _state.update { it.copy(submit = BusinessSubmit.Submitting, problems = emptySet()) }
        viewModelScope.launch {
            runCatching {
                when (s.mode) {
                    BusinessFormMode.Claim -> repository.claim(requestId, id, s.evidence, s.phone, s.whatsapp, s.hours)
                    BusinessFormMode.Edit -> repository.update(requestId, id, s.phone, s.whatsapp, s.hours)
                }
            }
                .onSuccess { _state.update { it.copy(submit = BusinessSubmit.Done) } }
                .onFailure { e -> _state.update { it.copy(submit = BusinessSubmit.Failed(UiError.from(e))) } }
        }
    }

    public companion object {
        internal fun problemsOf(s: BusinessFormUiState): Set<BusinessFormProblem> = buildSet {
            if (s.phone.isNotBlank() && !isCompletePhone(s.phone)) add(BusinessFormProblem.Phone)
            if (s.whatsapp.isNotBlank() && !isCompletePhone(s.whatsapp)) add(BusinessFormProblem.Whatsapp)
            if (s.mode == BusinessFormMode.Claim && s.evidence.trim().length < 20) add(BusinessFormProblem.Evidence)
        }

        /** Mirrors `isCompletePhone` in `@ruta/shared/phone`: 10 digits, area code 809/829/849. */
        internal fun isCompletePhone(input: String): Boolean {
            var digits = input.filter(Char::isDigit)
            if (digits.length > 10 && digits.startsWith("1")) digits = digits.drop(1)
            digits = digits.take(10)
            return digits.length == 10 && digits.take(3) in setOf("809", "829", "849")
        }
    }
}
