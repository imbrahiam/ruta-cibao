package rutacibao.presentation.gestion

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.zacsweers.metro.Inject
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import rutacibao.api.generated.ModerationCountsOutput
import rutacibao.api.generated.ReportsListItem
import rutacibao.core.AppConfig
import rutacibao.data.StaffSource
import rutacibao.presentation.UiError

public data class KindCount(val kind: ReviewKind, val count: Int)

/** A reject (or any verdict that needs a reason) waiting for its note. */
public data class NoteRequest(val item: ReviewItem, val verdict: Verdict, val tooShort: Boolean = false)

public enum class PdfState { Idle, Loading, Unavailable }

public data class GestionUiState(
    val phase: Phase = Phase.Loading,
    val counts: List<KindCount> = emptyList(),
    /** null = every kind. */
    val filter: ReviewKind? = null,
    val items: List<ReviewItem> = emptyList(),
    /** Cards whose decision is on its way to the server. */
    val inFlight: Set<String> = emptySet(),
    val noteFor: NoteRequest? = null,
    val latestReport: ReportsListItem? = null,
    val pdf: PdfState = PdfState.Idle,
    /** Set once the signed link is ready; the screen downloads it, then calls [GestionViewModel.pdfHandled]. */
    val pdfUrl: String? = null,
    val stepUp: StepUpState = StepUpState.None,
    val refreshing: Boolean = false,
    val error: UiError? = null,
) {
    public enum class Phase { Loading, Ready, Empty, Failed }

    /** The filter chips: only kinds that still have something waiting. */
    val filters: List<KindCount> get() = counts.filter { it.count > 0 }

    val total: Int get() = counts.sumOf { it.count }

    val visibleItems: List<ReviewItem> get() = if (filter == null) items else items.filter { it.kind == filter }
}

/** The staff desk: one mixed queue, approve / reject, the latest weekly report. */
@Inject
public class GestionViewModel(
    private val staff: StaffSource,
    private val config: AppConfig,
) : ViewModel() {
    private val _state = MutableStateFlow(GestionUiState())
    public val state: StateFlow<GestionUiState> = _state.asStateFlow()

    private val gate = StepUpGate(staff) { step -> _state.update { it.copy(stepUp = step) } }

    init {
        viewModelScope.launch { load(refreshing = false) }
    }

    public fun refresh() {
        _state.update { it.copy(refreshing = true) }
        viewModelScope.launch { load(refreshing = true) }
    }

    public fun retry() {
        _state.update { it.copy(phase = GestionUiState.Phase.Loading, error = null) }
        viewModelScope.launch { load(refreshing = false) }
    }

    public fun select(kind: ReviewKind?) {
        _state.update { it.copy(filter = kind) }
    }

    /** Approve or reject [item]; a verdict that needs a reason opens the note sheet first. */
    public fun decide(item: ReviewItem, verdict: Verdict) {
        if (item.id in _state.value.inFlight) return
        if (item.kind.needsNote(verdict)) {
            _state.update { it.copy(noteFor = NoteRequest(item, verdict)) }
            return
        }
        viewModelScope.launch { decideNow(item, verdict, null) }
    }

    public fun submitNote(note: String) {
        val request = _state.value.noteFor ?: return
        val clean = note.trim()
        if (clean.length < MIN_NOTE_LENGTH) {
            _state.update { it.copy(noteFor = request.copy(tooShort = true)) }
            return
        }
        _state.update { it.copy(noteFor = null) }
        viewModelScope.launch { decideNow(request.item, request.verdict, clean) }
    }

    public fun dismissNote() {
        _state.update { it.copy(noteFor = null) }
    }

    public fun errorHandled() {
        _state.update { it.copy(error = null) }
    }

    public fun openReport() {
        val report = _state.value.latestReport ?: return
        if (_state.value.pdf == PdfState.Loading) return
        _state.update { it.copy(pdf = PdfState.Loading) }
        viewModelScope.launch { fetchPdf(report.id) }
    }

    /** A shared weekly report must open that report, not whichever is latest. */
    public fun openLinkedReport(reportId: String) {
        if (_state.value.pdf == PdfState.Loading) return
        _state.update { it.copy(pdf = PdfState.Loading) }
        viewModelScope.launch { fetchPdf(reportId) }
    }

    public fun pdfHandled() {
        _state.update { it.copy(pdf = PdfState.Idle, pdfUrl = null) }
    }

    public fun useRecoveryCode(recovery: Boolean): Unit = gate.useRecovery(recovery)

    public fun dismissStepUp(): Unit = gate.dismiss()

    public fun verifyStepUp(code: String) {
        viewModelScope.launch { gate.verify(code) }
    }

    private suspend fun fetchPdf(reportId: String) {
        val outcome = gate.run(replay = { fetchPdf(reportId) }) {
            val url = staff.reportPdfUrl(reportId)
            _state.update { if (url == null) it.copy(pdf = PdfState.Unavailable) else it.copy(pdf = PdfState.Idle, pdfUrl = url) }
        }
        when (outcome) {
            is GateOutcome.Failed -> _state.update { it.copy(pdf = PdfState.Unavailable) }
            GateOutcome.Blocked -> _state.update { it.copy(pdf = PdfState.Idle) }
            GateOutcome.Done -> Unit
        }
    }

    /** Takes the card off the list at once and puts it back if the server says no. */
    private suspend fun decideNow(item: ReviewItem, verdict: Verdict, note: String?) {
        _state.update { s ->
            s.copy(
                inFlight = s.inFlight + item.id,
                items = s.items.filterNot { it.id == item.id },
                counts = s.counts.adjust(item.kind, -1),
            )
        }
        val outcome = gate.run(replay = { decideNow(item, verdict, note) }) { item.kind.decide(staff, item.id, verdict, note) }
        _state.update { s ->
            val settled = s.copy(inFlight = s.inFlight - item.id)
            when (outcome) {
                GateOutcome.Done -> settled.copy(phase = if (settled.total == 0) GestionUiState.Phase.Empty else settled.phase)
                GateOutcome.Blocked -> settled.restore(item)
                is GateOutcome.Failed -> settled.restore(item).copy(error = UiError.from(outcome.error))
            }
        }
    }

    private fun GestionUiState.restore(item: ReviewItem): GestionUiState =
        copy(items = (items + item).sortedByDescending { it.createdAt }, counts = counts.adjust(item.kind, +1))

    private fun List<KindCount>.adjust(kind: ReviewKind, by: Int): List<KindCount> =
        map { if (it.kind == kind) it.copy(count = (it.count + by).coerceAtLeast(0)) else it }

    private suspend fun load(refreshing: Boolean) {
        val outcome = gate.run(replay = { load(refreshing) }) {
            val (counts, items, report) = coroutineScope {
                val counts = staff.counts().toKindCounts()
                val queues = counts.filter { it.count > 0 }.map { c ->
                    async { staff.queue(c.kind.queue, PAGE).toItems(config).filter { it.kind == c.kind } }
                }
                val report = async { runCatching { staff.reports() }.getOrDefault(emptyList()) }
                Triple(counts, queues.flatMap { it.await() }.sortedByDescending { it.createdAt }, report.await())
            }
            val latest = report.filter { it.status == ReportsListItem.Status.Ready }.maxByOrNull { it.periodEnd }
            _state.update {
                it.copy(
                    phase = if (items.isEmpty()) GestionUiState.Phase.Empty else GestionUiState.Phase.Ready,
                    counts = counts,
                    filter = it.filter?.takeIf { f -> counts.any { c -> c.kind == f && c.count > 0 } },
                    items = items,
                    latestReport = latest,
                    refreshing = false,
                    error = null,
                )
            }
        }
        when (outcome) {
            GateOutcome.Done -> Unit
            GateOutcome.Blocked -> _state.update {
                it.copy(refreshing = false, phase = if (it.counts.isEmpty()) GestionUiState.Phase.Failed else it.phase)
            }
            is GateOutcome.Failed -> _state.update {
                it.copy(
                    phase = if (it.items.isEmpty() && it.counts.isEmpty()) GestionUiState.Phase.Failed else it.phase,
                    refreshing = false,
                    error = UiError.from(outcome.error),
                )
            }
        }
    }

    private companion object {
        const val PAGE = 20
    }
}

internal fun ModerationCountsOutput.toKindCounts(): List<KindCount> =
    ReviewKind.entries.map { KindCount(it, it.count(this)) }
