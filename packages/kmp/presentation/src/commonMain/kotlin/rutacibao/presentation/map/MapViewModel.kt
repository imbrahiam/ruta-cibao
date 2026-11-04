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
    traffic: TrafficRepository,
    private val session: Session,
) : ViewModel() {
    private val _state = MutableStateFlow(MapUiState())
    public val state: StateFlow<MapUiState> = _state.asStateFlow()
    private val trafficLayer = TrafficLayer(traffic, viewModelScope)
    private var detailJob: Job? = null
    private var businessJob: Job? = null

    /** Ids the person has saved, so a sheet opens with the right bookmark. */
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
                    _state.update { s -> s.updatingSheet(placeId) { it.copy(detail = detail, loading = false) } }
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

    /** Optimistic save; signed out it asks for sign-in instead. */
    public fun toggleSaved() {
        val sheet = _state.value.sheet ?: return
        if (!session.isSignedIn.value) {
            _state.update { it.copy(signInRequested = true) }
            return
        }
        val next = !sheet.saved
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
            _state.update { it.copy(routes = routes) }
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
                    _state.update { it.copy(phase = MapUiState.Phase.Ready, all = places, categories = categories, error = null) }
                }
                .onFailure { error ->
                    _state.update { it.copy(phase = MapUiState.Phase.Failed, error = UiError.from(error)) }
                }
        }
    }
}
