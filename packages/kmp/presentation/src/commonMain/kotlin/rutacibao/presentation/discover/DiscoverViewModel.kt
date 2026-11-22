package rutacibao.presentation.discover

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.zacsweers.metro.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import rutacibao.api.generated.MunicipalitiesListItem
import rutacibao.api.generated.PlacesCategoriesItem
import rutacibao.api.generated.RoutesBrowseOutput
import rutacibao.data.ConsultationsRepository
import rutacibao.data.DiscoverPlace
import rutacibao.data.PlacesRepository
import rutacibao.presentation.UiError

/** The feed's shelves, in order. Titles come from the catalogue (`discover.*`). */
public enum class ShelfId { Todo, Eat, Shop, Stay, Services }

public data class Shelf(val id: ShelfId, val places: List<DiscoverPlace>)

public data class DiscoverUiState(
    val loading: Boolean = true,
    val municipalities: List<MunicipalitiesListItem> = emptyList(),
    /** Null for the whole province. */
    val municipalityId: String? = null,
    val categories: List<PlacesCategoriesItem> = emptyList(),
    val routes: List<RoutesBrowseOutput.Item> = emptyList(),
    val shelves: List<Shelf> = emptyList(),
    /** A category opened from the shortcuts: its whole list. */
    val category: PlacesCategoriesItem? = null,
    val categoryPlaces: List<DiscoverPlace>? = null,
    val categoryError: UiError? = null,
    val error: UiError? = null,
) {
    val isEmpty: Boolean get() = !loading && routes.isEmpty() && shelves.isEmpty()
}

/**
 * Places worth a visit, browsed without the map: shelves of cards by what you
 * would go for (things to do, eating, the day's shopping, a bed, the useful
 * services), the eco routes, and a shortcut per kind of place.
 */
@Inject
public class DiscoverViewModel(
    private val places: PlacesRepository,
    private val consultations: ConsultationsRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(DiscoverUiState())
    public val state: StateFlow<DiscoverUiState> = _state.asStateFlow()
    private var categoryJob: Job? = null
    private var feedJob: Job? = null

    init { load() }

    public fun refresh() { load() }

    public fun selectMunicipality(id: String?) {
        if (_state.value.municipalityId == id) return
        _state.update { it.copy(municipalityId = id, loading = true, routes = emptyList(), shelves = emptyList(), error = null) }
        load()
    }

    public fun openCategory(category: PlacesCategoriesItem) {
        categoryJob?.cancel()
        _state.update { it.copy(category = category, categoryPlaces = null, categoryError = null) }
        val municipality = _state.value.municipalityId
        categoryJob = viewModelScope.launch {
            try {
                val list = places.browse(category.id, municipality, 48)
                _state.update { it.copy(categoryPlaces = pictured(list)) }
            } catch (cancelled: kotlinx.coroutines.CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                _state.update { it.copy(categoryError = UiError.from(error)) }
            }
        }
    }

    public fun closeCategory() {
        categoryJob?.cancel()
        _state.update { it.copy(category = null, categoryPlaces = null, categoryError = null) }
    }

    private fun load() {
        feedJob?.cancel()
        val municipality = _state.value.municipalityId
        feedJob = viewModelScope.launch {
            runCatching {
                coroutineScope {
                    val municipalities = async { runCatching { consultations.municipalities() }.getOrDefault(_state.value.municipalities) }
                    val categories = async { runCatching { places.placeCategories() } }
                    val routes = async { runCatching { places.routes() }.getOrDefault(emptyList()) }
                    val towns = municipalities.await()
                    val shelves = SHELVES.map { (id, kinds) ->
                        async {
                            val found = kinds.map { kind -> async { runCatching { places.browse(kind, municipality, 10) }.getOrDefault(emptyList()) } }.awaitAll()
                            Shelf(id, pictured(interleave(found)).take(12))
                        }
                    }.awaitAll().filter { it.places.isNotEmpty() }
                    val allRoutes = routes.await()
                    val categoryResult = categories.await()
                    if (allRoutes.isEmpty() && shelves.isEmpty()) categoryResult.getOrThrow()
                    _state.update {
                        it.copy(
                            loading = false,
                            municipalities = towns,
                            categories = categoryResult.getOrDefault(it.categories),
                            routes = if (municipality == null) allRoutes else allRoutes.filter { r -> r.municipalityId == municipality },
                            shelves = shelves,
                            error = null,
                        )
                    }
                }
            }.onFailure { e ->
                val error = UiError.from(e)
                _state.update { it.copy(loading = false, error = error) }
            }
        }
    }

    private companion object {
        /** Which kinds of place fill each shelf. Kinds with nothing published simply add nothing. */
        val SHELVES = listOf(
            ShelfId.Todo to listOf("cultura", "parque", "balneario", "deporte", "religion"),
            ShelfId.Eat to listOf("comedor", "bar"),
            ShelfId.Shop to listOf("colmado", "farmacia", "ferreteria", "agro"),
            ShelfId.Stay to listOf("hospedaje"),
            ShelfId.Services to listOf("banco", "combustible", "salud", "taller", "transporte"),
        )

        /** One of each kind in turn, so a shelf is not ten of the same. */
        fun interleave(lists: List<List<DiscoverPlace>>): List<DiscoverPlace> {
            val out = mutableListOf<DiscoverPlace>()
            var index = 0
            while (lists.any { index < it.size }) {
                lists.forEach { list -> list.getOrNull(index)?.let(out::add) }
                index++
            }
            return out
        }

        /** Pictures lead: a card with a photo invites a visit more than a glyph does. */
        fun pictured(list: List<DiscoverPlace>): List<DiscoverPlace> = list.sortedBy { if (it.imageUrl != null) 0 else 1 }
    }
}
