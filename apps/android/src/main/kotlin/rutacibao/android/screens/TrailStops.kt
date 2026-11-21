package rutacibao.android.screens

import kotlin.math.cos
import kotlin.math.sqrt
import rutacibao.api.generated.RoutesBrowseOutput
import rutacibao.data.MapPlace

/**
 * A stop along an eco route (iOS's `TrailStop`): the route's start and end plus the app's places
 * within [REACH] metres of its path, in the order the walk reaches them. The API has no stops.
 */
data class TrailStop(val id: String, val kind: Kind, val name: String, val lat: Double, val lng: Double, val along: Double, val place: MapPlace? = null) {
    enum class Kind { Start, Place, End }
}

private const val REACH = 160.0

fun trailStops(route: RoutesBrowseOutput.Item, places: List<MapPlace>, start: String, end: String): List<TrailStop> {
    val path = route.path
    if (path.size < 2) return emptyList()
    val line = TrailPath(path.map { it.lat to it.lng })
    val stops = mutableListOf(TrailStop("start-${route.id}", TrailStop.Kind.Start, start, path.first().lat, path.first().lng, 0.0))
    stops += places.mapNotNull { place ->
        val (along, offset) = line.project(place.latitude, place.longitude)
        if (offset <= REACH && along > 40 && along < line.length - 40) TrailStop("place-${place.id}", TrailStop.Kind.Place, place.name, place.latitude, place.longitude, along, place) else null
    }.sortedBy { it.along }
    stops += TrailStop("end-${route.id}", TrailStop.Kind.End, end, path.last().lat, path.last().lng, line.length)
    return stops
}

/** A path as segments: metres along it and the nearest point to a position (flat-earth, fine over a few km). */
class TrailPath(private val points: List<Pair<Double, Double>>) {
    private val cumulative: List<Double> = points.indices.runningFold(0.0) { sum, i -> if (i == 0) sum else sum + metres(points[i - 1], points[i]) }.drop(1)
    val length: Double get() = cumulative.lastOrNull() ?: 0.0

    fun project(lat: Double, lng: Double): Pair<Double, Double> {
        var best = 0.0 to Double.MAX_VALUE
        val scale = cos(Math.toRadians(lat)) * 111_320
        for (i in 0 until points.size - 1) {
            val (alat, alng) = points[i]; val (blat, blng) = points[i + 1]
            val ax = (alng - lng) * scale; val ay = (alat - lat) * 110_540
            val bx = (blng - lng) * scale; val by = (blat - lat) * 110_540
            val dx = bx - ax; val dy = by - ay
            val len = dx * dx + dy * dy
            val t = if (len > 0) (-(ax * dx + ay * dy) / len).coerceIn(0.0, 1.0) else 0.0
            val px = ax + t * dx; val py = ay + t * dy
            val offset = sqrt(px * px + py * py)
            if (offset < best.second) best = (cumulative[i] + t * (cumulative[i + 1] - cumulative[i])) to offset
        }
        return best
    }

    private fun metres(a: Pair<Double, Double>, b: Pair<Double, Double>): Double {
        val result = FloatArray(1)
        android.location.Location.distanceBetween(a.first, a.second, b.first, b.second, result)
        return result[0].toDouble()
    }
}
