package rutacibao.data

import dev.zacsweers.metro.Inject
import rutacibao.api.generated.RutaApi
import rutacibao.api.generated.TrafficActiveInput
import rutacibao.api.generated.TrafficActiveItem
import rutacibao.api.generated.TrafficConfirmInput
import rutacibao.api.generated.TrafficConfirmOutput

/** A geographic rectangle, as the map reports its viewport. */
public data class Bbox(val west: Double, val south: Double, val east: Double, val north: Double) {
    /** Whether [other] lies entirely within this box. */
    public fun contains(other: Bbox): Boolean =
        other.west >= west && other.east <= east && other.south >= south && other.north <= north

    /** Grown by [fraction] of its width and height on every side, kept on the globe. */
    public fun padded(fraction: Double): Bbox {
        val dx = (east - west) * fraction
        val dy = (north - south) * fraction
        return Bbox(
            west = (west - dx).coerceAtLeast(-180.0),
            south = (south - dy).coerceAtLeast(-90.0),
            east = (east + dx).coerceAtMost(180.0),
            north = (north + dy).coerceAtMost(90.0),
        )
    }
}

/** What the traffic layer needs from the network; a seam so it can be tested without one. */
public interface TrafficSource {
    public suspend fun active(box: Bbox, limit: Int): List<TrafficActiveItem>

    public suspend fun confirm(reportId: String, verdict: TrafficConfirmInput.Verdict): TrafficConfirmOutput
}

/** Live road reports in a viewport, and "still there / it's over" answers. */
@Inject
public class TrafficRepository(private val api: RutaApi) : TrafficSource {
    override suspend fun active(box: Bbox, limit: Int): List<TrafficActiveItem> =
        api.traffic.active(TrafficActiveInput(box.west, box.south, box.east, box.north, limit))

    public suspend fun detail(id: String): rutacibao.api.generated.TrafficDetailOutput =
        api.traffic.detail(rutacibao.api.generated.TrafficDetailInput(id))

    override suspend fun confirm(reportId: String, verdict: TrafficConfirmInput.Verdict): TrafficConfirmOutput =
        api.traffic.confirm(TrafficConfirmInput(reportId, verdict))
}
