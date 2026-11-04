package rutacibao.presentation.map

import kotlin.math.floor
import rutacibao.data.MapPlace

/** A pin on screen: one place, or several close together shown as a count. */
public data class MapCluster(
    val id: String,
    val latitude: Double,
    val longitude: Double,
    val count: Int,
    /** Set when the cluster is a single place. */
    val place: MapPlace?,
)

/**
 * Grid clustering, shared by both maps. The cell is a fraction of the visible
 * span, so clusters split as you zoom in. A province's worth of places (low
 * hundreds) clusters in well under a millisecond, so it runs on every camera stop.
 */
public object Clustering {
    public fun cluster(places: List<MapPlace>, cellLatitude: Double, cellLongitude: Double): List<MapCluster> {
        if (cellLatitude <= 0 || cellLongitude <= 0) return places.map(::single)
        return places
            .groupBy { floor(it.latitude / cellLatitude).toLong() to floor(it.longitude / cellLongitude).toLong() }
            .map { (cell, group) ->
                if (group.size == 1) {
                    single(group.first())
                } else {
                    MapCluster(
                        id = "cluster:${cell.first}:${cell.second}:${group.size}",
                        latitude = group.sumOf { it.latitude } / group.size,
                        longitude = group.sumOf { it.longitude } / group.size,
                        count = group.size,
                        place = null,
                    )
                }
            }
    }

    private fun single(place: MapPlace) = MapCluster(place.id, place.latitude, place.longitude, 1, place)

    /**
     * Google Maps-style reveal: at most one place per grid cell, so the map
     * starts with a few well-spaced pins and fills in as you zoom (cells
     * shrink). The keeper is stable across zoom levels: places with a picture
     * first, then by id, so a pin never swaps for its neighbour while panning.
     * [keep] (the selected place) always survives.
     */
    public fun declutter(places: List<MapPlace>, cellLatitude: Double, cellLongitude: Double, keep: String?): List<MapPlace> {
        if (cellLatitude <= 0 || cellLongitude <= 0) return places
        val byCell = places.groupBy { floor(it.latitude / cellLatitude).toLong() to floor(it.longitude / cellLongitude).toLong() }
        return byCell.values.map { group ->
            group.firstOrNull { it.id == keep }
                ?: group.minWith(compareBy<MapPlace>({ if (it.thumbnailUrl != null) 0 else 1 }, { it.id }))
        }
    }
}
