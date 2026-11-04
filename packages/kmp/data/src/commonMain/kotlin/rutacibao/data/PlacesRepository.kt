package rutacibao.data

import rutacibao.api.generated.RoutesBrowseOutput
import rutacibao.api.generated.RoutesBrowseInput
import dev.zacsweers.metro.Inject
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.isSuccess
import kotlinx.serialization.Serializable
import rutacibao.api.ApiError
import rutacibao.api.ApiTransport
import rutacibao.api.generated.PlacesDetailInput
import rutacibao.api.generated.PlacesDetailOutput
import rutacibao.api.generated.PlacesToggleSavedInput
import rutacibao.api.generated.RutaApi
import rutacibao.core.AppConfig

/** A place as the map draws it: enough for a pin and a sheet's first frame. */
public data class MapPlace(
    val id: String,
    val slug: String,
    val name: String,
    val categoryId: String,
    val categoryName: String,
    val municipalityId: String,
    val color: String,
    val icon: String,
    val latitude: Double,
    val longitude: Double,
    /** Absolute URL, or null when the place has no picture. */
    val thumbnailUrl: String?,
)

/**
 * Places for the map. The collection comes from `/api/places/geojson`, a
 * cached GeoJSON route outside the oRPC contract, so its (small, stable)
 * shape is modelled here by hand. Details go through the generated client.
 */
@Inject
public class PlacesRepository(
    private val client: HttpClient,
    private val api: RutaApi,
    private val config: AppConfig,
    private val offline: OfflineRepository,
) {
    private val cachedDetails = mutableSetOf<String>()
    public fun isDetailCached(slug: String): Boolean = slug in cachedDetails
    public suspend fun mapPlaces(): List<MapPlace> = try {
        val response = client.get(config.absolute("/api/places/geojson"))
        val text = response.bodyAsText()
        if (!response.status.isSuccess()) throw ApiError(response.status.value, "HTTP_${response.status.value}", "geojson")
        ApiTransport.DefaultJson.decodeFromString(Collection.serializer(), text).features.map { f ->
            val p = f.properties
            MapPlace(
                id = p.id, slug = p.slug, name = p.name,
                categoryId = p.category, categoryName = p.categoryName, municipalityId = p.municipality,
                color = p.color, icon = p.icon,
                latitude = f.geometry.coordinates[1], longitude = f.geometry.coordinates[0],
                thumbnailUrl = p.thumbnailUrl?.let(config::absolute),
            )
        }
    } catch (error: Exception) {
        val snapshot = fallback(error)
        snapshot.places.map { place ->
            MapPlace(place.id, place.slug, place.name, place.category.id, place.category.name,
                place.municipality.id, place.category.color, place.category.icon, place.location.lat, place.location.lng, null)
        }
    }

    /** Published eco routes (hiking, cycling), with their paths, for the map. */
    public suspend fun routes(): List<RoutesBrowseOutput.Item> = try {
        api.routes.browse(RoutesBrowseInput(limit = 100)).items
    } catch (error: Exception) { fallback(error).routes }

    /** Exact lookup: a shared route can be beyond the first browse page. */
    public suspend fun route(id: String): RoutesBrowseOutput.Item {
        val detail = try { api.routes.detail(rutacibao.api.generated.RoutesDetailInput(id)) }
        catch (error: Exception) { return fallback(error).routes.firstOrNull { it.id == id } ?: throw error }
        if (detail.status != rutacibao.api.generated.RoutesDetailOutput.Status.Published) throw ApiError(404, "NOT_FOUND", "route")
        return RoutesBrowseOutput.Item(
            id = detail.id, name = detail.name, description = detail.description,
            categoryId = detail.categoryId, categoryName = detail.categoryName,
            municipalityId = detail.municipalityId, municipalityName = detail.municipalityName,
            path = detail.path.map { RoutesBrowseOutput.Item.PathItem(it.lng, it.lat) },
            difficulty = RoutesBrowseOutput.Item.Difficulty.valueOf(detail.difficulty.name),
            durationMinutes = detail.durationMinutes, distanceMeters = detail.distanceMeters,
            services = detail.services.map { RoutesBrowseOutput.Item.Service.valueOf(it.name) },
            status = RoutesBrowseOutput.Item.Status.Published, reviewNote = detail.reviewNote, createdAt = detail.createdAt,
        )
    }

    /** Municipality names by id, so search can match "Monción". */
    public suspend fun municipalityNames(): Map<String, String> = try {
        api.municipalities.list().associate { it.id to it.name }
    } catch (error: Exception) { fallback(error).boundaries.features.associate { it.id to it.properties.name } }

    public suspend fun detail(slug: String): PlacesDetailOutput = try {
        api.places.detail(PlacesDetailInput(slug = slug)).also { cachedDetails.remove(slug) }
    } catch (error: Exception) {
        val place = fallback(error).places.firstOrNull { it.slug == slug } ?: throw error
        cachedDetails.add(slug)
        PlacesDetailOutput(
            id = place.id, slug = place.slug, name = place.name, description = place.description,
            address = place.address,
            location = PlacesDetailOutput.Location(place.location.lng, place.location.lat),
            category = PlacesDetailOutput.Category(place.category.id, place.category.name, place.category.icon, place.category.color),
            municipality = PlacesDetailOutput.Municipality(place.municipality.id, place.municipality.name),
            photos = emptyList(),
            // The snapshot intentionally excludes live trust/account state. Native sheets hide it.
            trust = PlacesDetailOutput.Trust(PlacesDetailOutput.Trust.State.New, 0.0, 0.0),
            isMine = false,
        )
    }

    public fun cachedRoads(): List<OfflineRoad> = offline.snapshot?.roads.orEmpty()

    private fun fallback(error: Exception): OfflineSnapshot {
        if (!isTransient(error)) throw error
        return (offline.snapshot ?: throw error).also { offline.usedCache() }
    }

    public suspend fun setSaved(placeId: String, saved: Boolean): Unit {
        api.places.toggleSaved(PlacesToggleSavedInput(placeId = placeId, saved = saved))
    }

    public suspend fun confirm(placeId: String, verdict: rutacibao.api.generated.PlacesConfirmInput.Verdict): rutacibao.api.generated.PlacesConfirmOutput =
        api.places.confirm(rutacibao.api.generated.PlacesConfirmInput(placeId, verdict))

    public suspend fun report(input: rutacibao.api.generated.PlacesReportInput): MutationDelivery =
        offline.reportPlace(input)

    @Serializable private data class Collection(val features: List<Feature>)
    @Serializable private data class Feature(val geometry: Geometry, val properties: Properties)
    @Serializable private data class Geometry(val coordinates: List<Double>)
    @Serializable private data class Properties(
        val id: String,
        val slug: String,
        val name: String,
        val category: String,
        val categoryName: String,
        val municipality: String,
        val color: String,
        val icon: String,
        val thumbnailUrl: String? = null,
    )
}
