package rutacibao.presentation.map

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.io.IOException
import rutacibao.api.generated.PlacesDetailOutput
import rutacibao.api.generated.TrafficActiveItem
import rutacibao.api.generated.TrafficConfirmInput
import rutacibao.api.generated.TrafficConfirmOutput
import rutacibao.data.Bbox
import rutacibao.data.MapPlace
import rutacibao.data.TrafficSource
import rutacibao.presentation.UiError
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.time.Instant

private fun item(
    id: String,
    still: Long = 2,
    cleared: Long = 0,
    mine: Boolean = false,
    verdict: TrafficActiveItem.MyVerdict? = null,
    state: TrafficActiveItem.State = TrafficActiveItem.State.Active,
    moderation: TrafficActiveItem.DescriptionModerationStatus = TrafficActiveItem.DescriptionModerationStatus.Pending,
) = TrafficActiveItem(
    id = id, categoryId = "c", categoryName = "Inundación", categoryIcon = "waves", categoryColor = "#1565c0",
    description = "Agua hasta la rodilla", descriptionModerationStatus = moderation,
    lng = -71.3, lat = 19.4, path = null, lengthMeters = null, state = state,
    severity = TrafficActiveItem.Severity.Blocking, municipalityId = "m", municipalityName = "Monción",
    reportedBy = null, reporterResidentVerified = false, voices = emptyList(), voiceCount = 0,
    createdAt = Instant.fromEpochSeconds(0), expiresAt = Instant.fromEpochSeconds(3600),
    stillCount = still, clearedCount = cleared, myVerdict = verdict, isMine = mine,
)

private class FakeSource(var items: List<TrafficActiveItem>) : TrafficSource {
    var fetches = mutableListOf<Bbox>()
    var confirmFailure: Exception? = null
    var confirmResult: TrafficConfirmOutput.Status = TrafficConfirmOutput.Status.Active
    var fetchFailure: Exception? = null

    override suspend fun active(box: Bbox, limit: Int): List<TrafficActiveItem> {
        fetches += box
        fetchFailure?.let { throw it }
        return items
    }

    override suspend fun confirm(reportId: String, verdict: TrafficConfirmInput.Verdict): TrafficConfirmOutput {
        confirmFailure?.let { throw it }
        return TrafficConfirmOutput(confirmResult, still = 3, cleared = 1)
    }

    private fun TrafficConfirmOutput(status: TrafficConfirmOutput.Status, still: Long, cleared: Long) =
        TrafficConfirmOutput(status, still, cleared, Instant.fromEpochSeconds(7200))
}

private fun place(id: String) = MapPlace(id, id, id, "cat", "Cat", "m", "#000", "map-pin", 19.4, -71.3, null)

@OptIn(ExperimentalCoroutinesApi::class)
class TrafficTest {
    private val view = Bbox(-71.40, 19.30, -71.20, 19.50)

    @Test fun containsAndPadding() {
        val padded = view.padded(0.25)
        assertEquals(Bbox(-71.45, 19.25, -71.15, 19.55).west, padded.west, 1e-9)
        assertEquals(19.55, padded.north, 1e-9)
        assertTrue(padded.contains(view))
        assertFalse(view.contains(padded))
        assertEquals(180.0, Bbox(0.0, 0.0, 179.9, 10.0).padded(1.0).east)
    }

    @Test fun viewportInsideTheFetchedBoxDoesNotRefetch() = runTest {
        val source = FakeSource(listOf(item("a")))
        val layer = TrafficLayer(source, this)
        layer.viewportChanged(view)
        advanceTimeBy(401); runCurrent()
        assertEquals(1, source.fetches.size)
        assertEquals(view.padded(0.25), source.fetches.single())
        assertEquals(listOf("a"), layer.notices.value.map { it.id })

        layer.viewportChanged(Bbox(-71.42, 19.31, -71.22, 19.51))
        advanceTimeBy(1000); runCurrent()
        assertEquals(1, source.fetches.size)

        layer.viewportChanged(Bbox(-71.9, 19.3, -71.7, 19.5))
        advanceTimeBy(401); runCurrent()
        assertEquals(2, source.fetches.size)
    }

    @Test fun debouncesBurstsOfMovement() = runTest {
        val source = FakeSource(emptyList())
        val layer = TrafficLayer(source, this)
        layer.viewportChanged(view)
        advanceTimeBy(200)
        layer.viewportChanged(Bbox(-71.9, 19.3, -71.7, 19.5))
        advanceTimeBy(1000); runCurrent()
        assertEquals(1, source.fetches.size)
    }

    @Test fun failedFetchKeepsTheLastList() = runTest {
        val source = FakeSource(listOf(item("a")))
        val layer = TrafficLayer(source, this)
        layer.viewportChanged(view)
        advanceTimeBy(401); runCurrent()
        source.fetchFailure = IOException("down")
        layer.setVisible(true)
        advanceTimeBy(60_001); runCurrent()
        assertEquals(listOf("a"), layer.notices.value.map { it.id })
        layer.setVisible(false)
    }

    @Test fun refreshesEveryMinuteWhileVisible() = runTest {
        val source = FakeSource(listOf(item("a")))
        val layer = TrafficLayer(source, this)
        layer.viewportChanged(view)
        advanceTimeBy(401); runCurrent()
        layer.setVisible(true)
        advanceTimeBy(60_001); runCurrent()
        assertEquals(2, source.fetches.size)
        layer.setVisible(false)
        advanceTimeBy(120_000); runCurrent()
        assertEquals(2, source.fetches.size)
    }

    private suspend fun TestScope.loaded(source: FakeSource): TrafficLayer {
        val layer = TrafficLayer(source, this)
        layer.viewportChanged(view)
        advanceTimeBy(401); runCurrent()
        return layer
    }

    @Test fun confirmCountsAreOptimisticThenServerTruth() = runTest {
        val source = FakeSource(listOf(item("a", still = 2, cleared = 1, verdict = TrafficActiveItem.MyVerdict.Cleared)))
        val layer = loaded(source)
        assertNull(layer.confirm("a", TrafficVerdict.Still))
        val a = layer.notices.value.single()
        assertEquals(TrafficVerdict.Still, a.myVerdict)
        assertEquals(3, a.stillCount)
        assertEquals(1, a.clearedCount)
    }

    @Test fun votingMovesTheCountBetweenSides() {
        val base = TrafficNotice.from(item("a", still = 2, cleared = 1, verdict = TrafficActiveItem.MyVerdict.Cleared))
        val voted = base.voting(TrafficVerdict.Still)
        assertEquals(3, voted.stillCount)
        assertEquals(0, voted.clearedCount)
        assertEquals(base, base.voting(TrafficVerdict.Cleared))
    }

    @Test fun failedConfirmRollsBack() = runTest {
        val source = FakeSource(listOf(item("a", still = 2, cleared = 0)))
        val layer = loaded(source)
        val before = layer.notices.value.single()
        source.confirmFailure = IOException("offline")
        assertEquals(UiError.Offline, layer.confirm("a", TrafficVerdict.Cleared))
        assertEquals(before, layer.notices.value.single())
    }

    @Test fun clearedStatusRemovesTheNotice() = runTest {
        val source = FakeSource(listOf(item("a"), item("b")))
        val layer = loaded(source)
        source.confirmResult = TrafficConfirmOutput.Status.Cleared
        assertNull(layer.confirm("a", TrafficVerdict.Cleared))
        assertEquals(listOf("b"), layer.notices.value.map { it.id })
    }

    @Test fun ownReportCannotBeConfirmed() = runTest {
        val source = FakeSource(listOf(item("a", mine = true)))
        val layer = loaded(source)
        val before = layer.notices.value.single()
        assertNull(layer.confirm("a", TrafficVerdict.Still))
        assertEquals(before, layer.notices.value.single())
    }

    @Test fun clearedReportsInTheListAreNotDrawn() = runTest {
        val source = FakeSource(listOf(item("a"), item("b", state = TrafficActiveItem.State.Cleared)))
        val layer = loaded(source)
        assertEquals(listOf("a"), layer.notices.value.map { it.id })
    }

    @Test fun descriptionOnlyWhenPublished() {
        assertNull(TrafficNotice.from(item("a")).details)
        val published = item("a", moderation = TrafficActiveItem.DescriptionModerationStatus.Published)
        assertEquals("Agua hasta la rodilla", TrafficNotice.from(published).details)
    }

    @Test fun selectionIsExclusive() {
        val notice = TrafficNotice.from(item("t"))
        val withTraffic = MapUiState().withTraffic(listOf(notice))
        val onPlace = withTraffic.selecting(PlaceSheet(place("p")))
        assertEquals("p", onPlace.sheet?.place?.id)
        assertNull(onPlace.selectedTraffic)

        val onTraffic = onPlace.selectingTraffic("t")
        assertNull(onTraffic.sheet)
        assertEquals("t", onTraffic.selectedTraffic?.id)

        val backToPlace = onTraffic.selecting(PlaceSheet(place("q")))
        assertNull(backToPlace.selectedTraffic)
        assertEquals("q", backToPlace.sheet?.place?.id)
    }

    @Test fun anOpenNoticeThatLeavesTheMapClosesItsSheet() {
        val notice = TrafficNotice.from(item("t"))
        val open = MapUiState().withTraffic(listOf(notice)).selectingTraffic("t")
        val after = open.withTraffic(emptyList())
        assertEquals(MapSelection.None, after.selection)
        assertEquals(open.copy(), open.withTraffic(listOf(notice)))
    }
}
