package rutacibao.presentation.comments

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.zacsweers.metro.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import rutacibao.api.generated.CommentsListInput
import rutacibao.api.generated.SafetyReportInput
import rutacibao.data.Comment
import rutacibao.data.CommentsRepository
import rutacibao.data.Session
import rutacibao.presentation.UiError

public typealias CommentSubject = CommentsListInput.Kind

public data class CommentsUiState(
    val loading: Boolean = true,
    val items: List<Comment> = emptyList(),
    val total: Int = 0,
    val draft: String = "",
    val sending: Boolean = false,
    val error: UiError? = null,
    val signInRequested: Boolean = false,
    /** A report went in; the screen thanks the person once. */
    val reported: Boolean = false,
) {
    val canSend: Boolean get() = draft.trim().isNotEmpty() && draft.length <= MAX_LENGTH && !sending
    val canLoadMore: Boolean get() = !loading && items.size < total

    public companion object {
        public const val MAX_LENGTH: Int = 500
    }
}

/**
 * One thread: comments under a consultation, or experiences of a place.
 * Anybody reads; writing asks a signed-out person to sign in first.
 */
@Inject
public class CommentsViewModel(
    private val repository: CommentsRepository,
    private val session: Session,
) : ViewModel() {
    private val _state = MutableStateFlow(CommentsUiState())
    public val state: StateFlow<CommentsUiState> = _state.asStateFlow()

    private var kind: CommentSubject? = null
    private var ref: String? = null
    /** Kept across retries of one send, so a dead-zone resend lands once. */
    private var pendingRequestId: String? = null

    /** Idempotent: the screen calls it on appear. */
    public fun load(kind: CommentSubject, ref: String) {
        if (this.kind == kind && this.ref == ref) return
        this.kind = kind
        this.ref = ref
        fetch(reset = true)
    }

    public fun refresh(): Unit = fetch(reset = true)

    public fun loadMore() { if (_state.value.canLoadMore) fetch(reset = false) }

    public fun updateDraft(value: String) {
        _state.update { it.copy(draft = value.take(CommentsUiState.MAX_LENGTH), error = null) }
    }

    public fun send() {
        val kind = kind ?: return
        val ref = ref ?: return
        val s = _state.value
        if (!s.canSend) return
        if (!session.isSignedIn.value) {
            _state.update { it.copy(signInRequested = true) }
            return
        }
        val requestId = pendingRequestId ?: repository.newRequestId().also { pendingRequestId = it }
        _state.update { it.copy(sending = true, error = null) }
        viewModelScope.launch {
            runCatching { repository.create(kind, ref, s.draft.trim(), requestId) }
                .onSuccess { comment ->
                    pendingRequestId = null
                    _state.update {
                        // A thread reads oldest first, experiences newest first.
                        val items = if (kind == CommentSubject.Consultation) it.items + comment else listOf(comment) + it.items
                        it.copy(sending = false, draft = "", items = items, total = it.total + 1)
                    }
                }
                .onFailure { e -> _state.update { it.copy(sending = false, error = UiError.from(e)) } }
        }
    }

    public fun delete(id: String) {
        viewModelScope.launch {
            runCatching { repository.delete(id) }
                .onSuccess { _state.update { s -> s.copy(items = s.items.filterNot { it.id == id }, total = (s.total - 1).coerceAtLeast(0)) } }
                .onFailure { e -> _state.update { it.copy(error = UiError.from(e)) } }
        }
    }

    public fun report(id: String, reason: SafetyReportInput.Reason) {
        if (!session.isSignedIn.value) {
            _state.update { it.copy(signInRequested = true) }
            return
        }
        viewModelScope.launch {
            runCatching { repository.report(id, reason) }
                .onSuccess { _state.update { it.copy(reported = true) } }
                .onFailure { e -> _state.update { it.copy(error = UiError.from(e)) } }
        }
    }

    public fun reportHandled() { _state.update { it.copy(reported = false) } }
    public fun signInHandled() { _state.update { it.copy(signInRequested = false) } }

    private fun fetch(reset: Boolean) {
        val kind = kind ?: return
        val ref = ref ?: return
        val offset = if (reset) 0 else _state.value.items.size
        _state.update { it.copy(loading = true) }
        viewModelScope.launch {
            runCatching { repository.list(kind, ref, offset, PAGE) }
                .onSuccess { page ->
                    _state.update {
                        it.copy(
                            loading = false,
                            items = if (reset) page.items else it.items + page.items,
                            total = page.total.toInt(),
                            error = null,
                        )
                    }
                }
                .onFailure { e -> _state.update { it.copy(loading = false, error = UiError.from(e)) } }
        }
    }

    private companion object {
        const val PAGE = 20
    }
}
