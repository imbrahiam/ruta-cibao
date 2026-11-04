package rutacibao.data

import dev.zacsweers.metro.Inject
import rutacibao.api.generated.PlacesCategoriesItem
import rutacibao.api.generated.PlacesSubmitInput
import rutacibao.api.generated.RutaApi
import rutacibao.api.generated.TrafficCategoriesItem
import rutacibao.api.generated.TrafficReportInput

/** Every contribution is committed locally before its first network request. */
@Inject
public class ContributeRepository(private val api: RutaApi, private val offline: OfflineRepository) {
    public suspend fun trafficCategories(): List<TrafficCategoriesItem> = try { api.traffic.categories() } catch (error: Exception) {
        if (!isTransient(error)) throw error
        val snapshot = offline.snapshot ?: throw error
        snapshot.categories.filter { it.kind == "traffic" }.map { TrafficCategoriesItem(it.id, it.name, it.icon, it.color) }
    }
    public suspend fun placeCategories(): List<PlacesCategoriesItem> = try { api.places.categories() } catch (error: Exception) {
        if (!isTransient(error)) throw error
        val snapshot = offline.snapshot ?: throw error
        snapshot.categories.filter { it.kind == "place" || it.kind == "business" }.map {
            PlacesCategoriesItem(it.id, it.name, it.icon, it.color, if (it.kind == "business") PlacesCategoriesItem.Kind.Business else PlacesCategoriesItem.Kind.Place)
        }
    }
    public suspend fun reportTraffic(input: TrafficReportInput): MutationDelivery = offline.reportTraffic(input)
    public suspend fun submitPlace(input: PlacesSubmitInput, photos: List<DraftPhoto>): MutationDelivery = offline.submitPlace(input, photos)
}
