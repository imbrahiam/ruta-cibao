package rutacibao.presentation.contribute

import rutacibao.data.ContributionsRepository
import rutacibao.api.generated.PlacesContributionsItem
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.zacsweers.metro.Inject
import kotlin.time.Clock
import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import rutacibao.api.ApiError
import rutacibao.api.generated.PlacesCategoriesItem
import rutacibao.api.generated.PlacesSubmitInput
import rutacibao.api.generated.TrafficCategoriesItem
import rutacibao.api.generated.TrafficReportInput
import rutacibao.data.ContributeRepository
import rutacibao.presentation.UiError

// ---------------------------------------------------------------- road report

public data class TrafficReportUiState(
    val categories: List<TrafficCategoriesItem> = emptyList(),
    val categoryId: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val description: String = "",
    val sending: Boolean = false,
    val sent: Boolean = false,
    /** Someone reported the same thing nearby (`DUPLICATE`): confirm it on the map instead. */
    val duplicate: Boolean = false,
    val error: UiError? = null,
) {
    val canSend: Boolean get() = !sending && categoryId != null && latitude != null && longitude != null
}

/** "Reportar la vía": what, where (a point), and an optional detail. */
@OptIn(ExperimentalUuidApi::class)
@Inject
public class TrafficReportViewModel(private val repository: ContributeRepository) : ViewModel() {
    private val _state = MutableStateFlow(TrafficReportUiState())
    public val state: StateFlow<TrafficReportUiState> = _state.asStateFlow()
    private val requestId = Uuid.random().toString()

    init {
        viewModelScope.launch {
            runCatching { repository.trafficCategories() }
                .onSuccess { c -> _state.update { it.copy(categories = c) } }
                .onFailure { e -> _state.update { it.copy(error = UiError.from(e)) } }
        }
    }

    public fun selectCategory(id: String) { _state.update { it.copy(categoryId = id, error = null) } }
    public fun setLocation(latitude: Double, longitude: Double) { _state.update { it.copy(latitude = latitude, longitude = longitude, error = null) } }
    public fun updateDescription(value: String) { _state.update { it.copy(description = value.take(280)) } }

    public fun send() {
        val s = _state.value
        if (!s.canSend) return
        _state.update { it.copy(sending = true, error = null, duplicate = false) }
        viewModelScope.launch {
            val input = TrafficReportInput(
                requestId = requestId,
                categoryId = s.categoryId!!,
                observedAt = Clock.System.now(),
                location = TrafficReportInput.Location(lng = s.longitude!!, lat = s.latitude!!),
                shape = TrafficReportInput.Shape.Point,
                description = s.description.trim().ifEmpty { null },
            )
            runCatching { repository.reportTraffic(input) }
                .onSuccess { _state.update { it.copy(sending = false, sent = true) } }
                .onFailure { e ->
                    _state.update {
                        it.copy(
                            sending = false,
                            duplicate = e is ApiError && "DUPLICATE" in e.code,
                            error = if (e is ApiError && "DUPLICATE" in e.code) null else UiError.from(e),
                        )
                    }
                }
        }
    }
}

// ---------------------------------------------------------------- place suggestion

public data class SuggestPlaceUiState(
    val categories: List<PlacesCategoriesItem> = emptyList(),
    val categoryId: String? = null,
    val name: String = "",
    val description: String = "",
    val address: String = "",
    val latitude: Double? = null,
    val longitude: Double? = null,
    val sending: Boolean = false,
    val sent: Boolean = false,
    val problems: Set<Problem> = emptySet(),
    val error: UiError? = null,
    /** A suggestion of theirs is still in review: one at a time (server-enforced). */
    val pendingLimit: Boolean = false,
    /** Photos attached so far (the bytes stay in the view model). */
    val photoCount: Int = 0,
    /** Photos that didn't make it after the place was sent. */
    val photosFailed: Int = 0,
) {
    val canAddPhoto: Boolean get() = photoCount < MAX_PHOTOS

    public companion object {
        /** The server keeps at most three photos in review per person and place. */
        public const val MAX_PHOTOS: Int = 3
    }

    public enum class Problem { Category, Name, Description, Location }

    val descriptionLength: Int get() = description.trim().length

    internal fun problemsNow(): Set<Problem> = buildSet {
        if (categoryId == null) add(Problem.Category)
        if (name.trim().length !in 3..100) add(Problem.Name)
        if (description.trim().length !in 20..600) add(Problem.Description)
        if (latitude == null || longitude == null) add(Problem.Location)
    }
}

/** "Sugerir un lugar": reviewed by municipal staff before it's published. */
@OptIn(ExperimentalUuidApi::class)
@Inject
public class SuggestPlaceViewModel(
    private val repository: ContributeRepository,
    private val contributions: ContributionsRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(SuggestPlaceUiState())
    public val state: StateFlow<SuggestPlaceUiState> = _state.asStateFlow()
    private val requestId = Uuid.random().toString()
    private val photos = mutableListOf<ByteArray>()

    init {
        viewModelScope.launch {
            runCatching { repository.placeCategories() }
                .onSuccess { c -> _state.update { it.copy(categories = c) } }
                .onFailure { e -> _state.update { it.copy(error = UiError.from(e)) } }
        }
        // Say so up front, rather than after the form is filled in.
        viewModelScope.launch {
            val waiting = runCatching { contributions.mine() }.getOrDefault(emptyList()).any {
                it.kind == PlacesContributionsItem.Kind.Place && it.status == PlacesContributionsItem.Status.Pending
            }
            if (waiting) _state.update { it.copy(pendingLimit = true) }
        }
    }

    public fun selectCategory(id: String) { edit { copy(categoryId = id) } }
    public fun updateName(value: String) { edit { copy(name = value.take(100)) } }
    public fun updateDescription(value: String) { edit { copy(description = value.take(600)) } }
    public fun updateAddress(value: String) { edit { copy(address = value.take(240)) } }
    public fun setLocation(latitude: Double, longitude: Double) { edit { copy(latitude = latitude, longitude = longitude) } }

    /** A JPEG from the camera or the library, already downscaled by the app. */
    public fun addPhoto(jpeg: ByteArray) {
        if (photos.size >= SuggestPlaceUiState.MAX_PHOTOS || _state.value.sending) return
        photos += jpeg
        _state.update { it.copy(photoCount = photos.size) }
    }

    public fun removePhoto(index: Int) {
        if (index !in photos.indices || _state.value.sending) return
        photos.removeAt(index)
        _state.update { it.copy(photoCount = photos.size) }
    }

    public fun send() {
        val s = _state.value
        if (s.sending) return
        val problems = s.problemsNow()
        if (problems.isNotEmpty()) {
            _state.update { it.copy(problems = problems) }
            return
        }
        _state.update { it.copy(sending = true, error = null) }
        viewModelScope.launch {
            val input = PlacesSubmitInput(
                requestId = requestId,
                name = s.name.trim(),
                description = s.description.trim(),
                address = s.address.trim().ifEmpty { null },
                categoryId = s.categoryId!!,
                location = PlacesSubmitInput.Location(lng = s.longitude!!, lat = s.latitude!!),
                locationSource = PlacesSubmitInput.LocationSource.Map,
            )
            runCatching { repository.submitPlace(input) }
                .onSuccess { placeId ->
                    // The place is in either way; a photo that fails is counted, not fatal.
                    var failed = 0
                    for (jpeg in photos.toList()) {
                        runCatching { repository.uploadPlacePhoto(placeId, jpeg) }.onFailure { failed++ }
                    }
                    _state.update { it.copy(sending = false, sent = true, photosFailed = failed) }
                }
                .onFailure { e ->
                    val limited = e is ApiError && e.data?.toString()?.contains("pending_limit") == true
                    _state.update { it.copy(sending = false, pendingLimit = limited, error = if (limited) null else UiError.from(e)) }
                }
        }
    }

    private fun edit(change: SuggestPlaceUiState.() -> SuggestPlaceUiState) {
        _state.update { old ->
            val next = old.change()
            next.copy(problems = old.problems intersect next.problemsNow(), error = null)
        }
    }
}
