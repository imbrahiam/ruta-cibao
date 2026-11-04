package rutacibao.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import rutacibao.api.generated.RoutesBrowseOutput

@Serializable
internal data class OfflineSnapshot(
    val schemaVersion: Int,
    val version: String,
    val generatedAt: String,
    val categories: List<OfflineCategory>,
    val boundaries: OfflineBoundaries,
    val places: List<OfflinePlace>,
    val routes: List<RoutesBrowseOutput.Item>,
    val roads: List<OfflineRoad>,
) {
    fun validate() {
        require(schemaVersion == 1 && version.isNotBlank())
        require(places.map { it.id }.toSet().size == places.size)
        require(places.map { it.slug }.toSet().size == places.size)
        places.forEach { require(it.id.isNotBlank() && it.slug.isNotBlank()); it.location.validate() }
        roads.forEach { require(it.path.size >= 2); it.path.forEach(OfflineRoad.Point::validate) }
        routes.forEach { route -> require(route.path.size >= 2); route.path.forEach { OfflinePoint(it.lng, it.lat).validate() } }
    }
}

@Serializable internal data class OfflinePoint(val lng: Double, val lat: Double) {
    fun validate() { require(lng.isFinite() && lat.isFinite() && lng in -180.0..180.0 && lat in -90.0..90.0) }
}
@Serializable internal data class OfflineCategory(val id: String, val kind: String, val name: String, val icon: String, val color: String)
@Serializable internal data class OfflineBoundaries(val features: List<OfflineBoundary>)
@Serializable internal data class OfflineBoundary(val id: String, val properties: Properties) {
    @Serializable data class Properties(val name: String)
}
@Serializable internal data class OfflinePlace(
    val id: String, val slug: String, val name: String, val description: String?, val address: String?,
    val imageUrl: String?, val photoIds: List<String>, val location: OfflinePoint,
    val category: Category, val municipality: Municipality, val business: JsonObject?,
) {
    @Serializable data class Category(val id: String, val kind: String, val name: String, val icon: String, val color: String)
    @Serializable data class Municipality(val id: String, val name: String)
}
@Serializable public data class OfflineRoad(val id: String, val name: String?, val kind: String, val path: List<Point>) {
    @Serializable public data class Point(val lng: Double, val lat: Double) {
        internal fun validate() { require(lng.isFinite() && lat.isFinite() && lng in -180.0..180.0 && lat in -90.0..90.0) }
    }
}
