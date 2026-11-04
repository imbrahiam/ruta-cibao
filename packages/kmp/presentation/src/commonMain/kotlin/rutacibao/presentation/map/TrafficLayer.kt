package rutacibao.presentation.map

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import rutacibao.api.generated.TrafficActiveItem
import rutacibao.api.generated.TrafficConfirmOutput
import rutacibao.data.Bbox
import rutacibao.data.TrafficSource
import rutacibao.presentation.UiError

/**
 * The live road reports around the viewport. Fetches the viewport grown by
 * [PADDING] and keeps it until the viewport leaves it, so small pans cost
 * nothing. Failing soft: a failed fetch keeps the last list.
 */
internal class TrafficLayer(
    private val source: TrafficSource,
    private val scope: CoroutineScope,
    private val debounceMillis: Long = 400,
    private val refreshMillis: Long = 60_000,
) {
    private val _notices = MutableStateFlow<List<TrafficNotice>>(emptyList())
    val notices: StateFlow<List<TrafficNotice>> = _notices.asStateFlow()

    private var fetched: Bbox? = null
    private var debounce: Job? = null
    private var refresh: Job? = null

    /** Answers in flight: a refresh must not undo them before the server replies. */
    private val pending = mutableMapOf<String, TrafficNotice>()

    fun viewportChanged(box: Bbox) {
        if (fetched?.contains(box) == true) return
        debounce?.cancel()
        debounce = scope.launch {
            delay(debounceMillis)
            fetch(box.padded(PADDING))
        }
    }

    /** Cancel the old viewport before a linked notice moves the camera. */
    fun includeLinked(notice: TrafficNotice) {
        debounce?.cancel()
        fetched = null
        _notices.update { list -> list.filterNot { it.id == notice.id } + notice }
    }

    /** Refreshes every minute while the map is on screen. */
    fun setVisible(visible: Boolean) {
        refresh?.cancel()
        refresh = if (!visible) null else scope.launch {
            while (true) {
                delay(refreshMillis)
                fetched?.let { fetch(it) }
            }
        }
    }

    private suspend fun fetch(box: Bbox) {
        val items = try {
            source.active(box, LIMIT)
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            return
        }
        fetched = box
        val fresh = items.filter { it.state == TrafficActiveItem.State.Active }.map(TrafficNotice::from)
        _notices.value = fresh.map { pending[it.id] ?: it }
    }

    /**
     * Applies the answer at once and rolls it back if the server refuses.
     * A report the neighbours cleared leaves the map. Returns the failure, if any.
     */
    suspend fun confirm(id: String, verdict: TrafficVerdict): UiError? {
        val before = _notices.value.firstOrNull { it.id == id } ?: return null
        if (!before.canConfirm || before.myVerdict == verdict) return null
        val optimistic = before.voting(verdict)
        pending[id] = optimistic
        replace(optimistic)
        return try {
            val out = source.confirm(id, TrafficNotice.api(verdict))
            pending.remove(id)
            settle(optimistic, out)
            null
        } catch (e: CancellationException) {
            pending.remove(id)
            replace(before)
            throw e
        } catch (e: Exception) {
            pending.remove(id)
            replace(before)
            UiError.from(e)
        }
    }

    private fun settle(notice: TrafficNotice, out: TrafficConfirmOutput) {
        if (out.status == TrafficConfirmOutput.Status.Cleared) {
            _notices.update { list -> list.filterNot { it.id == notice.id } }
        } else {
            replace(notice.copy(stillCount = out.stillCount.toInt(), clearedCount = out.clearedCount.toInt()))
        }
    }

    private fun replace(notice: TrafficNotice) {
        _notices.update { list -> list.map { if (it.id == notice.id) notice else it } }
    }

    companion object {
        const val PADDING = 0.25
        const val LIMIT = 100
    }
}
