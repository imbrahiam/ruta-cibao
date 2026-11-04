package rutacibao.presentation.safety

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.zacsweers.metro.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import rutacibao.api.ApiError
import rutacibao.api.generated.SafetyReportInput
import rutacibao.data.Session
import rutacibao.data.SafetyRepository
import rutacibao.presentation.UiError

public typealias ReportReason = SafetyReportInput.Reason

public data class SafetyUiState(
    val working: Boolean = false,
    val reported: Boolean = false,
    val hidden: Boolean = false,
    /** `own_content`, `no_author`…: the catalogue has a line for each (`safety.errors.*`). */
    val errorCode: String? = null,
    val error: UiError? = null,
    val signInRequested: Boolean = false,
)

/** The "…" menu's actions on a consultation. */
@Inject
public class SafetyViewModel(private val safety: SafetyRepository, private val session: Session) : ViewModel() {
    private val _state = MutableStateFlow(SafetyUiState())
    public val state: StateFlow<SafetyUiState> = _state.asStateFlow()

    public val reasons: List<ReportReason> = ReportReason.entries

    public fun report(consultationId: String, reason: ReportReason, details: String?) {
        run { safety.reportConsultation(consultationId, reason, details); _state.update { it.copy(reported = true) } }
    }

    public fun hideAuthor(consultationId: String) {
        run { safety.hideAuthorOfConsultation(consultationId); _state.update { it.copy(hidden = true) } }
    }

    public fun reset() { _state.value = SafetyUiState() }
    public fun signInHandled() { _state.update { it.copy(signInRequested = false) } }

    private fun run(block: suspend () -> Unit) {
        if (_state.value.working) return
        if (!session.isSignedIn.value) {
            _state.update { it.copy(signInRequested = true) }
            return
        }
        _state.update { it.copy(working = true, error = null, errorCode = null) }
        viewModelScope.launch {
            runCatching { block() }
                .onSuccess { _state.update { it.copy(working = false) } }
                .onFailure { e ->
                    _state.update {
                        it.copy(
                            working = false,
                            errorCode = (e as? ApiError)?.let { a -> (a.data?.toString() ?: "").let { d -> SAFETY_CODES.firstOrNull { c -> c in d || c.uppercase() in a.code } } },
                            error = UiError.from(e),
                        )
                    }
                }
        }
    }

    private companion object {
        val SAFETY_CODES = listOf("own_content", "no_author", "not_found")
    }
}
