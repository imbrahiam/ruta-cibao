package rutacibao.presentation.map

import rutacibao.data.MapPlace
import kotlin.test.Test
import kotlin.test.assertEquals

class ClusteringTest {
    private fun place(id: String, lat: Double, lng: Double) =
        MapPlace(id, id, id, "c", "C", "m", "#000000", "pin", lat, lng, null)

    private val town = listOf(place("a", 19.4710, -71.3401), place("b", 19.4712, -71.3405), place("c", 19.4708, -71.3399))
    private val faraway = place("d", 19.30, -71.10)

    @Test
    fun nearbyPlacesMergeFarOnesStandAlone() {
        val clusters = Clustering.cluster(town + faraway, 0.05, 0.05)
        assertEquals(2, clusters.size)
        assertEquals(3, clusters.first { it.place == null }.count)
        assertEquals("d", clusters.first { it.place != null }.place?.id)
    }

    @Test
    fun declutterKeepsOnePerCellAndTheSelection() {
        val shown = Clustering.declutter(town + faraway, 0.05, 0.05, keep = null)
        assertEquals(2, shown.size)
        assertEquals("a", shown.first { it.id != "d" }.id) // stable: lowest id wins when none has a photo
        assertEquals("c", Clustering.declutter(town, 0.05, 0.05, keep = "c").single().id)
        assertEquals(3, Clustering.declutter(town, 0.0001, 0.0001, keep = null).size)
    }

    @Test
    fun zoomingInSplitsClusters() {
        assertEquals(3, Clustering.cluster(town, 0.0001, 0.0001).size)
    }
}
