package rutacibao.presentation.map

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.zacsweers.metro.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import rutacibao.api.generated.PlacesDetailOutput
import rutacibao.api.generated.PlacesConfirmInput
import rutacibao.api.generated.PlacesReportInput
import kotlin.uuid.Uuid
import kotlin.uuid.ExperimentalUuidApi
import rutacibao.api.generated.RoutesBrowseOutput
import rutacibao.data.AccountRepository
import rutacibao.data.BusinessRepository
import rutacibao.data.MapPlace
import rutacibao.data.Bbox
import rutacibao.data.PlacesRepository
import rutacibao.data.Session
import rutacibao.data.TrafficRepository
import rutacibao.presentation.UiError
import rutacibao.presentation.business.BusinessState

/** A category chip: what the filter row shows, with how many places it holds. */
public data class MapCategory(
    val id: String,
    val name: String,
    val color: String,
    val icon: String,
    val count: Int,
)

/** The sheet for a selected place: the pin's data at once, the detail when it lands. */
public data class PlaceSheet(
    val place: MapPlace,
    val detail: PlacesDetailOutput? = null,
    val loading: Boolean = true,
    val error: UiError? = null,
    val saved: Boolean = false,
    val business: BusinessState = BusinessState.NotABusiness,
    val confirming: Boolean = false,
    val feedbackError: UiError? = null,
    val report: PlaceReportState? = null,
    val cached: Boolean = false,
)

public data class PlaceReportState(
    val requestId: String,
    val reason: PlacesReportInput.Reason = PlacesReportInput.Reason.IncorrectInformation,
    val details: String = "",
    val submitting: Boolean = false,
    val sent: Boolean = false,
    val queued: Boolean = false,
    val invalidDetails: Boolean = false,
    val error: UiError? = null,
)

/** What the map has open. One thing at a time: a place, a route or a traffic notice. */
public sealed interface MapSelection {
    public data object None : MapSelection
    public data class Place(val sheet: PlaceSheet) : MapSelection
    public data class Route(val route: RoutesBrowseOutput.Item) : MapSelection
    public data class Traffic(val id: String) : MapSelection
}

public data class MapUiState(
    val phase: Phase = Phase.Loading,
    val all: List<MapPlace> = emptyList(),
    val categories: List<MapCategory> = emptyList(),
    /** The chosen categories; they stack. Empty (and no routes) = everything. */
    val selectedCategories: Set<String> = emptySet(),
    /** Published eco routes, drawn as lines. */
    val routes: List<RoutesBrowseOutput.Item> = emptyList(),
    /** The "Rutas" chip, which stacks with the categories like any other. */
    val routesSelected: Boolean = false,
    /** Municipality names by id, for search. */
    val municipalities: Map<String, String> = emptyMap(),
    val selection: MapSelection = MapSelection.None,
    /** Live road reports around the viewport. */
    val traffic: List<TrafficNotice> = emptyList(),
    /** Why the last "still there / it's over" answer was rolled back. */
    val trafficError: UiError? = null,
    val error: UiError? = null,
    val linkError: UiError? = null,
    val signInRequested: Boolean = false,
) {
    public enum class Phase { Loading, Ready, Failed }

    val sheet: PlaceSheet? get() = (selection as? MapSelection.Place)?.sheet

    val route: RoutesBrowseOutput.Item? get() = (selection as? MapSelection.Route)?.route

    val selectedTraffic: TrafficNotice?
        get() = (selection as? MapSelection.Traffic)?.let { open -> traffic.firstOrNull { it.id == open.id } }

    /** Any chip on: the map shows only what's chosen. */
    val filtering: Boolean get() = selectedCategories.isNotEmpty() || routesSelected

    /** The pins to draw: those in the chosen categories, or everything. */
    val places: List<MapPlace>
        get() = if (!filtering) all else all.filter { it.categoryId in selectedCategories }

    /** The routes to draw: with no filter, or when "Rutas" is one of the chips. */
    val visibleRoutes: List<RoutesBrowseOutput.Item>
        get() = if (!filtering || routesSelected) routes else emptyList()

    internal fun selecting(sheet: PlaceSheet): MapUiState = copy(selection = MapSelection.Place(sheet), trafficError = null)

    internal fun selecting(route: RoutesBrowseOutput.Item): MapUiState = copy(selection = MapSelection.Route(route), trafficError = null)

    internal fun selectingTraffic(id: String): MapUiState = copy(selection = MapSelection.Traffic(id), trafficError = null)

    internal fun clearingSelection(): MapUiState = copy(selection = MapSelection.None)

    internal fun updatingSheet(placeId: String, change: (PlaceSheet) -> PlaceSheet): MapUiState {
        val open = sheet ?: return this
        return if (open.place.id != placeId) this else copy(selection = MapSelection.Place(change(open)))
    }

    /** A notice that left the map (cleared, expired) cannot stay open. */
    internal fun withTraffic(list: List<TrafficNotice>): MapUiState {
        val open = selection as? MapSelection.Traffic
        val stale = open != null && list.none { it.id == open.id }
        return copy(traffic = list, selection = if (stale) MapSelection.None else selection)
    }
}

@Inject
public class MapViewModel(
    private val repository: PlacesRepository,
    private val account: AccountRepository,
    private val businesses: BusinessRepository,
    private val traffic: TrafficRepository,
    private val session: Session,
) : ViewModel() {
    private val _state = MutableStateFlow(MapUiState())
    public val state: StateFlow<MapUiState> = _state.asStateFlow()
    private val trafficLayer = TrafficLayer(traffic, viewModelScope)
    private var detailJob: Job? = null
    private var businessJob: Job? = null
    private var linkJob: Job? = null

    /** Ids the person has saved, so a sheet opens with the right bookmark. */
    private var pendingSaveId: String? = null
    private var savedIds: Set<String> = emptySet()

    init {
        load()
        viewModelScope.launch {
            trafficLayer.notices.collect { list -> _state.update { it.withTraffic(list) } }
        }
        viewModelScope.launch {
            session.isSignedIn.collect { signedIn ->
                savedIds = if (signedIn) runCatching { account.saved().map { it.id }.toSet() }.getOrDefault(emptySet()) else emptySet()
                _state.update { s -> s.sheet?.let { open -> s.updatingSheet(open.place.id) { it.copy(saved = open.place.id in savedIds) } } ?: s }
                refreshBusiness()
            }
        }
    }

    public fun retry() {
        _state.update { it.copy(phase = MapUiState.Phase.Loading, error = null) }
        load()
    }

    /** Toggles one category in or out of the filter. */
    public fun toggleCategory(id: String) {
        _state.update { s ->
            val next = if (id in s.selectedCategories) s.selectedCategories - id else s.selectedCategories + id
            s.copy(selectedCategories = next).hidingWhatsFilteredOut()
        }
    }

    /** Toggles the "Rutas" chip. */
    public fun toggleRoutes() {
        _state.update { s -> s.copy(routesSelected = !s.routesSelected).hidingWhatsFilteredOut() }
    }

    /** Every chip off: the whole map again. */
    public fun clearFilters() {
        _state.update { it.copy(selectedCategories = emptySet(), routesSelected = false) }
    }

    /** A sheet for something the filter now hides would point at nothing. */
    private fun MapUiState.hidingWhatsFilteredOut(): MapUiState {
        val hidden = sheet?.let { open -> places.none { it.id == open.place.id } } == true ||
            route?.let { open -> visibleRoutes.none { it.id == open.id } } == true
        return if (hidden) clearingSelection() else this
    }

    /** Resolve links independently of browse-page and current-viewport limits. */
    public fun openPlace(slug: String) {
        linkJob?.cancel()
        detailJob?.cancel()
        _state.update { it.copy(linkError = null) }
        linkJob = viewModelScope.launch {
            runCatching { repository.detail(slug) }.onSuccess { detail ->
                val place = MapPlace(
                    detail.id, detail.slug, detail.name, detail.category.id, detail.category.name,
                    detail.municipality.id, detail.category.color, detail.category.icon,
                    detail.location.lat, detail.location.lng, detail.photos.firstOrNull() ?: detail.imageUrl,
                )
                _state.update { s ->
                    s.copy(phase = MapUiState.Phase.Ready, all = s.all.filterNot { it.id == place.id } + place)
                        .selecting(PlaceSheet(place, detail = detail, loading = false, saved = place.id in savedIds, cached = repository.isDetailCached(slug)))
                }
                refreshBusiness()
            }.onFailure { error ->
                if (error is kotlin.coroutines.cancellation.CancellationException) throw error
                _state.update { it.copy(linkError = UiError.from(error)) }
            }
        }
    }

    public fun openRoute(id: String) {
        linkJob?.cancel()
        detailJob?.cancel()
        _state.update { it.copy(linkError = null) }
        linkJob = viewModelScope.launch {
            runCatching { repository.route(id) }.onSuccess { route ->
                _state.update { s -> s.copy(routes = s.routes.filterNot { it.id == id } + route).selecting(route) }
            }.onFailure { error ->
                if (error is kotlin.coroutines.cancellation.CancellationException) throw error
                _state.update { it.copy(linkError = UiError.from(error)) }
            }
        }
    }

    public fun openTraffic(id: String) {
        linkJob?.cancel()
        detailJob?.cancel()
        _state.update { it.copy(linkError = null) }
        linkJob = viewModelScope.launch {
            runCatching { traffic.detail(id) }.onSuccess { detail ->
                val notice = TrafficNotice.from(detail)
                trafficLayer.includeLinked(notice)
                _state.update { s -> s.copy(traffic = s.traffic.filterNot { it.id == id } + notice).selectingTraffic(id) }
            }.onFailure { error ->
                if (error is kotlin.coroutines.cancellation.CancellationException) throw error
                _state.update { it.copy(linkError = UiError.from(error)) }
            }
        }
    }

    public fun linkErrorHandled() { _state.update { it.copy(linkError = null) } }

    public fun selectRoute(id: String) {
        val route = _state.value.routes.firstOrNull { it.id == id } ?: return
        detailJob?.cancel()
        businessJob?.cancel()
        _state.update { it.selecting(route) }
    }

    public fun dismissRoute() {
        _state.update { if (it.route != null) it.clearingSelection() else it }
    }

    public fun select(placeId: String) {
        val place = _state.value.all.firstOrNull { it.id == placeId } ?: return
        if (_state.value.sheet?.place?.id == placeId) return
        _state.update { it.selecting(PlaceSheet(place, saved = placeId in savedIds)) }
        detailJob?.cancel()
        refreshBusiness()
        detailJob = viewModelScope.launch {
            runCatching { repository.detail(place.slug) }
                .onSuccess { detail ->
                    _state.update { s -> s.updatingSheet(placeId) { it.copy(detail = detail, loading = false, cached = repository.isDetailCached(place.slug)) } }
                }
                .onFailure { error ->
                    _state.update { s -> s.updatingSheet(placeId) { it.copy(loading = false, error = UiError.from(error)) } }
                }
        }
    }

    /**
     * Loads who owns the open place. It's an extra: a failure leaves the sheet
     * as a plain place rather than breaking it.
     */
    public fun refreshBusiness() {
        val placeId = _state.value.sheet?.place?.id ?: return
        businessJob?.cancel()
        businessJob = viewModelScope.launch {
            val business = runCatching { businesses.claimState(placeId) }
                .map { BusinessState.from(it, session.isSignedIn.value) }
                .getOrDefault(BusinessState.NotABusiness)
            _state.update { s -> s.updatingSheet(placeId) { it.copy(business = business) } }
        }
    }

    /** "¿Es tu negocio?" while signed out asks for sign-in first. Returns whether the form may open. */
    public fun requestClaim(): Boolean {
        if (session.isSignedIn.value) return true
        _state.update { it.copy(signInRequested = true) }
        return false
    }

    public fun dismissSheet() {
        detailJob?.cancel()
        businessJob?.cancel()
        _state.update { if (it.sheet != null) it.clearingSelection() else it }
    }

    /** Opens a traffic notice's sheet, closing whatever else was open. */
    public fun selectTraffic(id: String) {
        if (_state.value.traffic.none { it.id == id }) return
        detailJob?.cancel()
        businessJob?.cancel()
        _state.update { it.selectingTraffic(id) }
    }

    public fun dismissTraffic() {
        _state.update { if (it.selection is MapSelection.Traffic) it.clearingSelection() else it }
    }

    /** The map settled on a new viewport; loads the notices around it. */
    public fun onViewportChanged(west: Double, south: Double, east: Double, north: Double) {
        trafficLayer.viewportChanged(Bbox(west, south, east, north))
    }

    /** True while the map is on screen: notices refresh every minute. */
    public fun setMapVisible(visible: Boolean) {
        trafficLayer.setVisible(visible)
    }

    /** "Sigue ahí" / "Ya no está". Signed out it asks for sign-in; a refusal rolls the counts back. */
    public fun confirmTraffic(verdict: TrafficVerdict) {
        val open = _state.value.selectedTraffic ?: return
        if (!session.isSignedIn.value) {
            _state.update { it.copy(signInRequested = true) }
            return
        }
        viewModelScope.launch {
            val failure = trafficLayer.confirm(open.id, verdict) ?: return@launch
            _state.update { it.copy(trafficError = failure, signInRequested = failure == UiError.SignedOut) }
        }
    }

    /** Confirmation is a per-person upsert; only publish the server's resulting trust. */
    public fun confirmPlace(verdict: PlacesConfirmInput.Verdict) {
        val open = _state.value.sheet ?: return
        if (open.confirming || open.cached || open.detail?.isMine != false) return
        if (!requestClaim()) return
        _state.update { it.updatingSheet(open.place.id) { s -> s.copy(confirming = true, feedbackError = null) } }
        viewModelScope.launch {
            runCatching { repository.confirm(open.place.id, verdict) }
                .onSuccess { result ->
                    _state.update { state ->
                        state.updatingSheet(open.place.id) { s ->
                            val detail = s.detail ?: return@updatingSheet s.copy(confirming = false)
                            s.copy(
                                confirming = false,
                                detail = detail.copy(
                                    myVerdict = PlacesDetailOutput.MyVerdict.valueOf(verdict.name),
                                    trust = PlacesDetailOutput.Trust(
                                        PlacesDetailOutput.Trust.State.valueOf(result.state.name),
                                        result.confirmations, result.doubts, result.ageDays,
                                    ),
                                ),
                            )
                        }
                    }
                }
                .onFailure { error ->
                    val failure = UiError.from(error)
                    _state.update { state ->
                        state.updatingSheet(open.place.id) { it.copy(confirming = false, feedbackError = failure) }
                            .copy(signInRequested = failure == UiError.SignedOut)
                    }
                }
        }
    }

    @OptIn(ExperimentalUuidApi::class)
    public fun openPlaceReport() {
        val open = _state.value.sheet ?: return
        if (!requestClaim()) return
        _state.update {
            it.updatingSheet(open.place.id) { s ->
                s.copy(report = s.report ?: PlaceReportState(requestId = Uuid.random().toString()))
            }
        }
    }

    public fun closePlaceReport() {
        val open = _state.value.sheet ?: return
        if (open.report?.submitting == true) return
        _state.update { it.updatingSheet(open.place.id) { s -> s.copy(report = null) } }
    }

    public fun updatePlaceReportReason(reason: PlacesReportInput.Reason) {
        val open = _state.value.sheet ?: return
        _state.update { it.updatingSheet(open.place.id) { s ->
            s.copy(report = s.report?.copy(reason = reason, invalidDetails = false, error = null))
        } }
    }

    public fun updatePlaceReportDetails(value: String) {
        val open = _state.value.sheet ?: return
        _state.update { it.updatingSheet(open.place.id) { s ->
            s.copy(report = s.report?.copy(details = value.take(500), invalidDetails = false, error = null))
        } }
    }

    public fun submitPlaceReport() {
        val open = _state.value.sheet ?: return
        val report = open.report ?: return
        if (report.submitting || report.sent) return
        if (!requestClaim()) return
        if (report.reason == PlacesReportInput.Reason.Other && report.details.trim().length < 10) {
            _state.update { it.updatingSheet(open.place.id) { s -> s.copy(report = report.copy(invalidDetails = true)) } }
            return
        }
        _state.update { it.updatingSheet(open.place.id) { s -> s.copy(report = report.copy(submitting = true, error = null)) } }
        viewModelScope.launch {
            runCatching {
                repository.report(PlacesReportInput(
                    placeId = open.place.id, requestId = report.requestId,
                    reason = report.reason, details = report.details.trim().ifEmpty { null },
                ))
            }.onSuccess { delivery ->
                _state.update { it.updatingSheet(open.place.id) { s ->
                    s.copy(report = report.copy(submitting = false, sent = true, queued = delivery.queued))
                } }
            }.onFailure { error ->
                val failure = UiError.from(error)
                _state.update { it.updatingSheet(open.place.id) { s ->
                    s.copy(report = report.copy(submitting = false, error = failure))
                }.copy(signInRequested = failure == UiError.SignedOut) }
            }
        }
    }

    /** Resume the save from the same detail after its sign-in cover closes. */
    public fun finishPlaceSignIn() {
        val id = pendingSaveId
        pendingSaveId = null
        val open = _state.value.sheet ?: return
        if (open.place.id == id && session.isSignedIn.value && !open.saved) {
            setSaved(open, next = true)
        }
    }

    /** Optimistic save; signed out it asks for sign-in first. */
    public fun toggleSaved() {
        val sheet = _state.value.sheet ?: return
        if (!session.isSignedIn.value) {
            pendingSaveId = sheet.place.id
            _state.update { it.copy(signInRequested = true) }
            return
        }
        setSaved(sheet, next = !sheet.saved)
    }

    private fun setSaved(sheet: PlaceSheet, next: Boolean) {
        savedIds = if (next) savedIds + sheet.place.id else savedIds - sheet.place.id
        _state.update { it.updatingSheet(sheet.place.id) { open -> open.copy(saved = next) } }
        viewModelScope.launch {
            runCatching { repository.setSaved(sheet.place.id, next) }.onFailure { error ->
                savedIds = if (next) savedIds - sheet.place.id else savedIds + sheet.place.id
                _state.update { s ->
                    s.updatingSheet(sheet.place.id) { it.copy(saved = !next) }
                        .copy(signInRequested = UiError.from(error) == UiError.SignedOut)
                }
            }
        }
    }

    public fun trafficErrorShown() {
        _state.update { it.copy(trafficError = null) }
    }

    public fun signInHandled() {
        _state.update { it.copy(signInRequested = false) }
    }

    private fun load() {
        // Routes and names are extras: the map still opens without them.
        viewModelScope.launch {
            val routes = runCatching { repository.routes() }.getOrDefault(emptyList())
            _state.update { state ->
                val linked = state.route?.takeIf { open -> routes.none { it.id == open.id } }
                state.copy(routes = if (linked == null) routes else routes + linked)
            }
        }
        viewModelScope.launch {
            val names = runCatching { repository.municipalityNames() }.getOrDefault(emptyMap())
            _state.update { it.copy(municipalities = names) }
        }
        viewModelScope.launch {
            runCatching { repository.mapPlaces() }
                .onSuccess { places ->
                    val categories = places.groupBy { it.categoryId }.map { (id, group) ->
                        val first = group.first()
                        MapCategory(id, first.categoryName, first.color, first.icon, group.size)
                    }.sortedByDescending { it.count }
                    _state.update { state ->
                        val linked = state.sheet?.place?.takeIf { open -> places.none { it.id == open.id } }
                        state.copy(phase = MapUiState.Phase.Ready, all = if (linked == null) places else places + linked, categories = categories, error = null)
                    }
                }
                .onFailure { error ->
                    _state.update { it.copy(phase = MapUiState.Phase.Failed, error = UiError.from(error)) }
                }
        }
    }
}
