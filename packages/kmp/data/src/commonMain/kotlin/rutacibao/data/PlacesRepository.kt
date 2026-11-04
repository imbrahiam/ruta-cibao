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
) {
    public suspend fun mapPlaces(): List<MapPlace> {
        val response = client.get(config.absolute("/api/places/geojson"))
        val text = response.bodyAsText()
        if (!response.status.isSuccess()) throw ApiError(response.status.value, "HTTP_${response.status.value}", "geojson")
        return ApiTransport.DefaultJson.decodeFromString(Collection.serializer(), text).features.map { f ->
            val p = f.properties
            MapPlace(
                id = p.id, slug = p.slug, name = p.name,
                categoryId = p.category, categoryName = p.categoryName, municipalityId = p.municipality,
                color = p.color, icon = p.icon,
                latitude = f.geometry.coordinates[1], longitude = f.geometry.coordinates[0],
                thumbnailUrl = p.thumbnailUrl?.let(config::absolute),
            )
        }
    }

    /** Published eco routes (hiking, cycling), with their paths, for the map. */
    public suspend fun routes(): List<RoutesBrowseOutput.Item> =
        api.routes.browse(RoutesBrowseInput(limit = 100)).items

    /** Municipality names by id, so search can match "Monción". */
    public suspend fun municipalityNames(): Map<String, String> =
        api.municipalities.list().associate { it.id to it.name }

    public suspend fun detail(slug: String): PlacesDetailOutput = api.places.detail(PlacesDetailInput(slug = slug))

    public suspend fun setSaved(placeId: String, saved: Boolean): Unit {
        api.places.toggleSaved(PlacesToggleSavedInput(placeId = placeId, saved = saved))
    }

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
