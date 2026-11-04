package rutacibao.presentation.contributions

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.zacsweers.metro.Inject
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import rutacibao.api.generated.PlacesContributionsItem
import rutacibao.data.ConsultationsRepository
import rutacibao.data.ContributionsRepository
import rutacibao.data.Session
import rutacibao.presentation.UiError

public typealias Contribution = PlacesContributionsItem

public data class ContributionsUiState(
    val signedIn: Boolean = false,
    val phase: Phase = Phase.Loading,
    val items: List<PlacesContributionsItem> = emptyList(),
    /** Consultation id → slug, so a case in the list can open its thread. */
    val consultationSlugs: Map<String, String> = emptyMap(),
    val refreshing: Boolean = false,
    val error: UiError? = null,
) {
    public enum class Phase { Loading, Ready, Empty, Failed }

    public fun slugFor(item: PlacesContributionsItem): String? =
        if (item.kind == PlacesContributionsItem.Kind.Consultation) consultationSlugs[item.id] else null
}

/** What you've given the province, newest first. Follows the session. */
@Inject
public class ContributionsViewModel(
    private val contributions: ContributionsRepository,
    private val consultations: ConsultationsRepository,
    private val session: Session,
) : ViewModel() {
    private val _state = MutableStateFlow(ContributionsUiState(signedIn = session.isSignedIn.value))
    public val state: StateFlow<ContributionsUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            session.isSignedIn.collect { signedIn ->
                _state.update { ContributionsUiState(signedIn = signedIn, phase = if (signedIn) ContributionsUiState.Phase.Loading else ContributionsUiState.Phase.Empty) }
                if (signedIn) load()
            }
        }
    }

    public fun refresh() {
        if (!session.isSignedIn.value) return
        _state.update { it.copy(refreshing = true) }
        viewModelScope.launch { load() }
    }

    public fun retry() {
        _state.update { it.copy(phase = ContributionsUiState.Phase.Loading, error = null) }
        viewModelScope.launch { load() }
    }

    private suspend fun load() {
        runCatching {
            kotlinx.coroutines.coroutineScope {
                val items = async { contributions.mine() }
                val mine = async { runCatching { consultations.mine().items }.getOrDefault(emptyList()) }
                items.await() to mine.await().associate { it.id to it.slug }
            }
        }.onSuccess { (items, slugs) ->
            _state.update {
                it.copy(
                    phase = if (items.isEmpty()) ContributionsUiState.Phase.Empty else ContributionsUiState.Phase.Ready,
                    items = items.sortedByDescending { item -> item.createdAt },
                    consultationSlugs = slugs,
                    refreshing = false,
                    error = null,
                )
            }
        }.onFailure { e ->
            _state.update {
                it.copy(
                    phase = if (it.items.isEmpty()) ContributionsUiState.Phase.Failed else it.phase,
                    refreshing = false,
                    error = UiError.from(e),
                )
            }
        }
    }
}
