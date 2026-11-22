package rutacibao.presentation.consultations

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.zacsweers.metro.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import rutacibao.api.generated.ConsultationsBrowseInput
import rutacibao.api.generated.ConsultationsBrowseOutput
import rutacibao.data.ConsultationsRepository
import rutacibao.data.SafetyRepository
import rutacibao.data.Session
import rutacibao.presentation.UiError

public typealias Consultation = ConsultationsBrowseOutput.Item
public typealias ConsultationStatus = ConsultationsBrowseInput.Status

public data class ConsultationsUiState(
    val items: List<Consultation> = emptyList(),
    val total: Long = 0,
    /** null = every status. */
    val status: ConsultationStatus? = null,
    val phase: Phase = Phase.Loading,
    val loadingMore: Boolean = false,
    val refreshing: Boolean = false,
    /** Set when the last load failed; items already shown stay on screen. */
    val error: UiError? = null,
    /** A signed-out tap on "apoyar" asks the UI to present sign-in. */
    val signInRequested: Boolean = false,
    /** Rows read from the server so far; hidden authors' cases make it larger than `items`. */
    val loaded: Long = 0,
) {
    public enum class Phase { Loading, Ready, Empty, Failed }

    val canLoadMore: Boolean get() = phase == Phase.Ready && loaded < total && !loadingMore
    val filters: List<ConsultationStatus?> get() = listOf(null) + ConsultationStatus.entries
}

/** The public list of cases opened with the ayuntamientos, filterable by status. */
@Inject
public class ConsultationsViewModel(
    private val repository: ConsultationsRepository,
    private val safety: SafetyRepository,
    private val session: Session,
) : ViewModel() {
    /** Cases by authors the person chose to hide: filtered out of every page. */
    private var hidden: Set<String> = emptySet()

    /** After "Ocultar a este autor": drop the case now, refresh the hidden set. */
    public fun hiddenChanged(consultationId: String) {
        hidden = hidden + consultationId
        _state.update { s -> s.copy(items = s.items.filterNot { it.id == consultationId }) }
        viewModelScope.launch { hidden = hidden + runCatching { safety.hiddenConsultations() }.getOrDefault(emptySet()) }
    }
    private val _state = MutableStateFlow(ConsultationsUiState())
    public val state: StateFlow<ConsultationsUiState> = _state.asStateFlow()

    private var job: Job? = null

    init {
        load(reset = true)
    }

    public fun refresh() {
        _state.update { it.copy(refreshing = true) }
        load(reset = true)
    }

    public fun retry(): Unit = load(reset = _state.value.items.isEmpty())

    public fun selectStatus(status: ConsultationStatus?) {
        if (status == _state.value.status) return
        _state.update { ConsultationsUiState(status = status) }
        load(reset = true)
    }

    /**
     * Optimistic: the count moves on tap and rolls back if the server says no.
     * Signed out, it asks for sign-in instead.
     */
    public fun toggleSupport(id: String) {
        if (!session.isSignedIn.value) {
            _state.update { it.copy(signInRequested = true) }
            return
        }
        val item = _state.value.items.firstOrNull { it.id == id } ?: return
        val next = !item.supported
        replace(id) { it.copy(supported = next, supportCount = (it.supportCount + if (next) 1 else -1).coerceAtLeast(0)) }
        viewModelScope.launch {
            runCatching { repository.support(id, next) }
                .onSuccess { out -> replace(id) { it.copy(supported = out.supported, supportCount = out.supportCount) } }
                .onFailure { error ->
                    replace(id) { item }
                    val kind = UiError.from(error)
                    _state.update { it.copy(signInRequested = kind == UiError.SignedOut) }
                }
        }
    }

    public fun signInHandled() {
        _state.update { it.copy(signInRequested = false) }
    }

    private fun replace(id: String, transform: (Consultation) -> Consultation) {
        _state.update { s -> s.copy(items = s.items.map { if (it.id == id) transform(it) else it }) }
    }

    public fun loadMore() {
        if (_state.value.canLoadMore) load(reset = false)
    }

    private fun load(reset: Boolean) {
        job?.cancel()
        job = viewModelScope.launch {
            val current = _state.value
            if (!reset) _state.update { it.copy(loadingMore = true) }
            if (reset && session.isSignedIn.value) {
                hidden = runCatching { safety.hiddenConsultations() }.getOrDefault(hidden)
            }
            runCatching {
                // The server's offset, not what is shown: hidden cases were read too.
                repository.browse(current.status, offset = if (reset) 0 else current.loaded.toInt(), limit = PAGE)
            }.onSuccess { page ->
                _state.update {
                    val fresh = page.items.filterNot { item -> item.id in hidden }
                    // A case opened between pages shifts the next page onto one already
                    // shown; a repeated id would crash a keyed list.
                    val items = if (reset) fresh else (it.items + fresh).distinctBy { item -> item.id }
                    it.copy(
                        items = items,
                        total = page.total,
                        loaded = (if (reset) 0L else current.loaded) + page.items.size,
                        phase = if (items.isEmpty()) ConsultationsUiState.Phase.Empty else ConsultationsUiState.Phase.Ready,
                        loadingMore = false,
                        refreshing = false,
                        error = null,
                    )
                }
            }.onFailure { error ->
                val kind = UiError.from(error)
                _state.update {
                    it.copy(
                        phase = if (it.items.isEmpty()) ConsultationsUiState.Phase.Failed else it.phase,
                        loadingMore = false,
                        refreshing = false,
                        error = kind,
                    )
                }
            }
        }
    }

    private companion object {
        const val PAGE = 20
    }
}

/**
 * The contract repeats the status enum per shape, so the generator emits one
 * Kotlin enum per place. Screens use [ConsultationStatus] everywhere.
 */
public val Consultation.statusValue: ConsultationStatus
    get() = ConsultationStatus.valueOf(status.name)
