package rutacibao.presentation.consultations

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.zacsweers.metro.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import rutacibao.api.generated.ConsultationsDetailOutput
import rutacibao.api.generated.ConsultationsRespondInput
import rutacibao.api.generated.MeGetOutput
import rutacibao.data.ConsultationsRepository
import rutacibao.data.Session
import rutacibao.data.StaffSource
import rutacibao.presentation.UiError
import rutacibao.presentation.gestion.GateOutcome
import rutacibao.presentation.gestion.MIN_NOTE_LENGTH
import rutacibao.presentation.gestion.StepUpGate
import rutacibao.presentation.gestion.StepUpState

public typealias ConsultationDetail = ConsultationsDetailOutput
public typealias ConsultationResponse = ConsultationsDetailOutput.Response

public data class ConsultationDetailUiState(
    val phase: Phase = Phase.Loading,
    val detail: ConsultationDetail? = null,
    val error: UiError? = null,
    val signInRequested: Boolean = false,
    /** A pull-to-refresh is in flight (the system spinner waits on it). */
    val refreshing: Boolean = false,
    /** The signed-in person is staff and may answer as the ayuntamiento. */
    val canRespond: Boolean = false,
    val replying: Boolean = false,
    val replyError: ReplyError? = null,
    /** The last reply went through; the composer clears its field, then calls [ConsultationDetailViewModel.replySentHandled]. */
    val replySent: Boolean = false,
    val stepUp: StepUpState = StepUpState.None,
) {
    public enum class Phase { Loading, Ready, NotFound, Failed }

    public enum class ReplyError { TooShort, Failed }

    /** The statuses a reply can leave the case in. */
    val replyStatuses: List<ConsultationsRespondInput.StatusAfter> get() = ConsultationsRespondInput.StatusAfter.entries
}

/** One case and the ayuntamiento's replies, oldest first, like a thread. */
@Inject
public class ConsultationDetailViewModel(
    private val repository: ConsultationsRepository,
    private val session: Session,
    private val staff: StaffSource,
) : ViewModel() {
    private val _state = MutableStateFlow(ConsultationDetailUiState())
    public val state: StateFlow<ConsultationDetailUiState> = _state.asStateFlow()
    private var slug: String? = null
    private val gate = StepUpGate(staff) { step -> _state.update { it.copy(stepUp = step) } }

    /** Idempotent: the screen calls it on appear; a second call is a no-op. */
    public fun load(slug: String) {
        if (this.slug == slug) return
        this.slug = slug
        fetch()
        if (session.isSignedIn.value) {
            viewModelScope.launch {
                val role = runCatching { staff.staffRole() }.getOrNull()
                _state.update { it.copy(canRespond = role != null && role != MeGetOutput.StaffRole.None) }
            }
        }
    }

    /** Staff only: answer as the ayuntamiento and move the case to [statusAfter]. */
    public fun respond(body: String, statusAfter: ConsultationsRespondInput.StatusAfter) {
        val state = _state.value
        val id = state.detail?.id ?: return
        if (!state.canRespond || state.replying) return
        val text = body.trim()
        if (text.length < MIN_NOTE_LENGTH) {
            _state.update { it.copy(replyError = ConsultationDetailUiState.ReplyError.TooShort) }
            return
        }
        viewModelScope.launch { send(id, text, statusAfter) }
    }

    public fun replySentHandled() {
        _state.update { it.copy(replySent = false) }
    }

    public fun useRecoveryCode(recovery: Boolean): Unit = gate.useRecovery(recovery)

    public fun dismissStepUp(): Unit = gate.dismiss()

    public fun verifyStepUp(code: String) {
        viewModelScope.launch { gate.verify(code) }
    }

    private suspend fun send(id: String, text: String, statusAfter: ConsultationsRespondInput.StatusAfter) {
        _state.update { it.copy(replying = true, replyError = null) }
        val outcome = gate.run(replay = { send(id, text, statusAfter) }) { staff.respond(id, text, statusAfter) }
        when (outcome) {
            GateOutcome.Done -> {
                _state.update { it.copy(replying = false, replySent = true) }
                fetch()
            }
            GateOutcome.Blocked -> _state.update { it.copy(replying = false) }
            is GateOutcome.Failed -> _state.update {
                it.copy(replying = false, replyError = ConsultationDetailUiState.ReplyError.Failed)
            }
        }
    }

    public fun retry() {
        _state.update { it.copy(phase = ConsultationDetailUiState.Phase.Loading, error = null) }
        fetch()
    }

    public fun refresh() {
        _state.update { it.copy(refreshing = true) }
        fetch()
    }

    public fun toggleSupport() {
        if (!session.isSignedIn.value) {
            _state.update { it.copy(signInRequested = true) }
            return
        }
        val current = _state.value.detail ?: return
        val next = !current.supported
        _state.update {
            it.copy(detail = current.copy(supported = next, supportCount = (current.supportCount + if (next) 1 else -1).coerceAtLeast(0)))
        }
        viewModelScope.launch {
            runCatching { repository.support(current.id, next) }
                .onSuccess { out ->
                    _state.update { s -> s.copy(detail = s.detail?.copy(supported = out.supported, supportCount = out.supportCount)) }
                }
                .onFailure { error ->
                    _state.update { it.copy(detail = current, signInRequested = UiError.from(error) == UiError.SignedOut) }
                }
        }
    }

    public fun signInHandled() {
        _state.update { it.copy(signInRequested = false) }
    }

    private fun fetch() {
        val slug = slug ?: return
        viewModelScope.launch {
            runCatching { repository.detail(slug) }
                .onSuccess { detail ->
                    _state.update { it.copy(phase = ConsultationDetailUiState.Phase.Ready, detail = detail, error = null, refreshing = false) }
                }
                .onFailure { error ->
                    val kind = UiError.from(error)
                    _state.update {
                        it.copy(
                            phase = when {
                                it.detail != null -> it.phase
                                kind == UiError.NotFound -> ConsultationDetailUiState.Phase.NotFound
                                else -> ConsultationDetailUiState.Phase.Failed
                            },
                            error = kind,
                            refreshing = false,
                        )
                    }
                }
        }
    }
}

/** The case's status as the shared enum (the contract repeats it per shape). */
public val ConsultationDetail.statusValue: ConsultationStatus
    get() = ConsultationStatus.valueOf(status.name)

/** The status a reply moved the case to. */
public val ConsultationResponse.statusAfterValue: ConsultationStatus
    get() = ConsultationStatus.valueOf(statusAfter.name)
