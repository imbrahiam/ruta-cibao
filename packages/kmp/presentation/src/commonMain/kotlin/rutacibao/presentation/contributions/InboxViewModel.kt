package rutacibao.presentation.contributions

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.zacsweers.metro.Inject
import kotlin.time.Instant
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonPrimitive
import rutacibao.api.generated.NotificationsMarkReadInput
import rutacibao.api.generated.RutaApi
import rutacibao.data.Session
import rutacibao.presentation.UiError

/**
 * A notice from the server. It names a catalogue key (`notifications.*`) and
 * its params: the copy lives in the catalogue, never in the message.
 */
public data class Notice(
    val id: String,
    val messageKey: String,
    /** Primitive params as text, ready for the platform formatter. */
    val params: Map<String, String>,
    /** In-app target, e.g. `/consultas/<slug>`. */
    val href: String?,
    val unread: Boolean,
    val createdAt: Instant,
) {
    /** The consultation this notice is about, when its link points at one. */
    val consultationSlug: String?
        get() = href?.removePrefix("/consultas/")?.takeIf { href.startsWith("/consultas/") && it.isNotBlank() }
}

public data class InboxUiState(
    val phase: Phase = Phase.Loading,
    val items: List<Notice> = emptyList(),
    val unread: Int = 0,
    val error: UiError? = null,
) {
    public enum class Phase { Loading, Ready, Empty, Failed }
}

@Inject
public class InboxViewModel(private val api: RutaApi, private val session: Session) : ViewModel() {
    private val _state = MutableStateFlow(InboxUiState())
    public val state: StateFlow<InboxUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            session.isSignedIn.collect { signedIn -> if (signedIn) load() else _state.update { InboxUiState(phase = InboxUiState.Phase.Empty) } }
        }
    }

    public fun refresh() { viewModelScope.launch { load() } }

    /** Optimistic; one id, or all when null. */
    public fun markRead(id: String?) {
        _state.update { s ->
            val items = s.items.map { if (id == null || it.id == id) it.copy(unread = false) else it }
            s.copy(items = items, unread = items.count { it.unread })
        }
        viewModelScope.launch { runCatching { api.notifications.markRead(NotificationsMarkReadInput(id = id)) } }
    }

    private suspend fun load() {
        runCatching { api.notifications.list() }
            .onSuccess { out ->
                val items = out.items.map { n ->
                    Notice(
                        id = n.id,
                        messageKey = n.messageKey,
                        params = n.params.mapValues { (_, v) -> (v as? JsonPrimitive)?.content ?: v.toString() },
                        href = n.href,
                        unread = n.readAt == null,
                        createdAt = n.createdAt,
                    )
                }
                _state.update {
                    InboxUiState(
                        phase = if (items.isEmpty()) InboxUiState.Phase.Empty else InboxUiState.Phase.Ready,
                        items = items,
                        unread = out.unread.toInt(),
                    )
                }
            }
            .onFailure { e -> _state.update { it.copy(phase = if (it.items.isEmpty()) InboxUiState.Phase.Failed else it.phase, error = UiError.from(e)) } }
    }
}
