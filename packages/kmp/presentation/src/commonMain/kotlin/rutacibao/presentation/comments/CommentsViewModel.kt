package rutacibao.presentation.comments

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.zacsweers.metro.Inject
import kotlinx.coroutines.Job
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
    val signedIn: Boolean = false,
    val sending: Boolean = false,
    val loadError: UiError? = null,
    val sendError: UiError? = null,
    val actionError: UiError? = null,
    val workingCommentId: String? = null,
    val signInRequested: Boolean = false,
    /** A report went in; the screen thanks the person once. */
    val reported: Boolean = false,
) {
    val canSend: Boolean get() = draft.trim().isNotEmpty() && draft.length <= MAX_LENGTH && !sending
    val canLoadMore: Boolean get() = !loading && loadError == null && items.size < total

    public companion object {
        public const val MAX_LENGTH: Int = 500
    }
}

/** One public thread: consultation comments oldest first, place experiences newest first. */
@Inject
public class CommentsViewModel(
    private val repository: CommentsRepository,
    private val session: Session,
) : ViewModel() {
    private val _state = MutableStateFlow(CommentsUiState(signedIn = session.isSignedIn.value))
    public val state: StateFlow<CommentsUiState> = _state.asStateFlow()

    private var kind: CommentSubject? = null
    private var ref: String? = null
    private var fetchJob: Job? = null
    private var failedLoadReset: Boolean = true
    /** Server offset excludes a newly sent consultation that is not part of the loaded pages. */
    private var loadedCount: Int = 0
    private var pendingRequestId: String? = null
    private var failedAction: CommentAction? = null

    init {
        viewModelScope.launch {
            session.isSignedIn.collect { signedIn ->
                if (_state.value.signedIn != signedIn) {
                    _state.update { it.copy(signedIn = signedIn) }
                    // Refresh isMine after sign-in/sign-out without throwing away a draft.
                    refresh()
                }
            }
        }
    }

    /** Idempotent: each screen owns one subject-specific instance. */
    public fun load(kind: CommentSubject, ref: String) {
        if (this.kind == kind && this.ref == ref) return
        fetchJob?.cancel()
        this.kind = kind
        this.ref = ref
        loadedCount = 0
        pendingRequestId = null
        failedAction = null
        _state.value = CommentsUiState(signedIn = session.isSignedIn.value)
        fetch(reset = true)
    }

    public fun refresh(): Unit = fetch(reset = true)
    public fun retryLoad(): Unit = fetch(reset = failedLoadReset)
    public fun loadMore() { if (_state.value.canLoadMore) fetch(reset = false) }
    public fun requestSignIn() { _state.update { it.copy(signInRequested = true) } }

    public fun updateDraft(value: String) {
        if (_state.value.sending) return
        val draft = value.take(CommentsUiState.MAX_LENGTH)
        if (draft != _state.value.draft) pendingRequestId = null
        _state.update { it.copy(draft = draft, sendError = null) }
    }

    public fun send() {
        val kind = kind ?: return
        val ref = ref ?: return
        val s = _state.value
        if (!s.canSend) return
        if (!session.isSignedIn.value) {
            requestSignIn()
            return
        }
        val requestId = pendingRequestId ?: repository.newRequestId().also { pendingRequestId = it }
        _state.update { it.copy(sending = true, sendError = null) }
        viewModelScope.launch {
            runCatching { repository.create(kind, ref, s.draft.trim(), requestId) }
                .onSuccess { comment ->
                    pendingRequestId = null
                    val alreadyLoaded = _state.value.items.any { it.id == comment.id }
                    if (!alreadyLoaded && kind == CommentSubject.Place) loadedCount += 1
                    _state.update {
                        val items = if (alreadyLoaded) it.items else if (kind == CommentSubject.Consultation) it.items + comment else listOf(comment) + it.items
                        it.copy(sending = false, draft = "", items = items, total = it.total + if (alreadyLoaded) 0 else 1)
                    }
                }
                .onFailure { e -> _state.update { it.copy(sending = false, sendError = UiError.from(e)) } }
        }
    }

    public fun delete(id: String): Unit = perform(CommentAction(id, null))
    public fun report(id: String, reason: SafetyReportInput.Reason): Unit = perform(CommentAction(id, reason))
    public fun retryAction() { failedAction?.let(::perform) }

    private fun perform(action: CommentAction) {
        if (_state.value.workingCommentId != null) return
        if (!session.isSignedIn.value) {
            requestSignIn()
            return
        }
        failedAction = null
        _state.update { it.copy(workingCommentId = action.id, actionError = null) }
        viewModelScope.launch {
            runCatching {
                if (action.reason == null) repository.delete(action.id) else repository.report(action.id, action.reason)
            }.onSuccess {
                if (action.reason == null) {
                    val index = _state.value.items.indexOfFirst { it.id == action.id }
                    if (index in 0 until loadedCount) loadedCount = (loadedCount - 1).coerceAtLeast(0)
                    _state.update { s -> s.copy(workingCommentId = null, items = s.items.filterNot { it.id == action.id }, total = (s.total - 1).coerceAtLeast(0)) }
                } else {
                    _state.update { it.copy(workingCommentId = null, reported = true) }
                }
            }.onFailure { e ->
                failedAction = action
                _state.update { it.copy(workingCommentId = null, actionError = UiError.from(e)) }
            }
        }
    }

    public fun reportHandled() { _state.update { it.copy(reported = false) } }
    public fun signInHandled() { _state.update { it.copy(signInRequested = false) } }

    private fun fetch(reset: Boolean) {
        val kind = kind ?: return
        val ref = ref ?: return
        if (!reset && _state.value.loading) return
        fetchJob?.cancel()
        val offset = if (reset) 0 else loadedCount
        failedLoadReset = reset
        _state.update { it.copy(loading = true, loadError = null) }
        fetchJob = viewModelScope.launch {
            runCatching { repository.list(kind, ref, offset, PAGE) }
                .onSuccess { page ->
                    loadedCount = offset + page.items.size
                    _state.update {
                        val items = if (reset) page.items else (it.items + page.items).distinctBy { item -> item.id }.let { merged ->
                            if (kind == CommentSubject.Consultation) merged.sortedBy { item -> item.createdAt } else merged
                        }
                        it.copy(loading = false, items = items, total = page.total.toInt(), loadError = null)
                    }
                }
                .onFailure { e -> _state.update { it.copy(loading = false, loadError = UiError.from(e)) } }
        }
    }

    private data class CommentAction(val id: String, val reason: SafetyReportInput.Reason?)

    private companion object {
        const val PAGE = 20
    }
}
