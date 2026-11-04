package rutacibao.presentation.gestion

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.io.IOException
import rutacibao.api.generated.ConsultationsRespondInput
import rutacibao.api.generated.MeGetOutput
import rutacibao.api.generated.ModerationCountsOutput
import rutacibao.api.generated.ModerationDecidePublicationInput
import rutacibao.api.generated.ModerationQueueInput
import rutacibao.api.generated.ModerationQueueOutput
import rutacibao.api.generated.ReportsListItem
import rutacibao.core.AppConfig
import rutacibao.data.EnrollmentRequired
import rutacibao.data.StaffSource
import rutacibao.data.StepUpRequired
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.time.Instant

private class FakeStaff : StaffSource {
    var places = listOf(place("p1", 100), place("p2", 200))
    var photos = listOf(photo("f1", 300))
    var decisions = mutableListOf<String>()
    var notes = mutableListOf<String?>()
    var stepUpOnce = false
    var enrollment = false
    var decisionFailure: Exception? = null
    var totpFailure: Exception? = null
    var verifications = 0
    var hold: CompletableDeferred<Unit>? = null

    override suspend fun staffRole() = MeGetOutput.StaffRole.Moderator
    override suspend fun counts() = ModerationCountsOutput(places.size.toDouble(), 0.0, photos.size.toDouble(), 0.0, 0.0, 0.0, 0.0)
    override suspend fun queue(queue: ModerationQueueInput.Queue, limit: Int) = ModerationQueueOutput(
        places = if (queue == ModerationQueueInput.Queue.Places) places else emptyList(),
        reports = emptyList(),
        photos = if (queue == ModerationQueueInput.Queue.Photos) photos else emptyList(),
        claims = emptyList(), consultations = emptyList(), traffic = emptyList(), contentReports = emptyList(),
    )

    private suspend fun gate() {
        hold?.await()
        if (enrollment) throw EnrollmentRequired()
        if (stepUpOnce) { stepUpOnce = false; throw StepUpRequired() }
        decisionFailure?.let { throw it }
    }

    override suspend fun decidePlace(id: String, approve: Boolean, note: String?) {
        gate(); decisions += "place:$id:$approve"; notes += note
    }
    override suspend fun decideReport(id: String, approve: Boolean, note: String?) = gate()
    override suspend fun decidePhoto(id: String, approve: Boolean) { gate(); decisions += "photo:$id:$approve" }
    override suspend fun decideClaim(id: String, approve: Boolean, note: String?) = gate()
    override suspend fun decideContentReport(id: String, approve: Boolean, reason: String?) = gate()
    override suspend fun decidePublication(
        kind: ModerationDecidePublicationInput.Target.Kind, id: String, approve: Boolean, reason: String?,
    ) = gate()
    override suspend fun respond(consultationId: String, body: String, statusAfter: ConsultationsRespondInput.StatusAfter) = gate()
    override suspend fun reports(): List<ReportsListItem> = emptyList()
    override suspend fun reportPdfUrl(reportId: String): String? = null
    override suspend fun verifyTotp(code: String) { totpFailure?.let { throw it }; verifications++ }
    override suspend fun verifyRecoveryCode(code: String) { verifications++ }
}

private fun place(id: String, at: Long) = ModerationQueueOutput.Place(
    id = id, slug = id, name = "Lugar $id", description = "desc", address = null, lng = 0.0, lat = 0.0,
    locationSource = ModerationQueueOutput.Place.LocationSource.entries.first(),
    createdAt = Instant.fromEpochSeconds(at), categoryName = "c", categoryColor = "#000", categoryIcon = "map-pin",
    municipalityId = "m", municipalityName = "Monción", submittedBy = null, submitterResidentVerified = false,
)

private fun photo(id: String, at: Long) = ModerationQueueOutput.Photo(
    id = id, url = "/img/$id.jpg", createdAt = Instant.fromEpochSeconds(at), placeName = "Foto $id", placeSlug = id,
    municipalityId = "m", municipalityName = "Monción", uploadedBy = null,
)

@OptIn(ExperimentalCoroutinesApi::class)
class GestionTest {
    private val dispatcher = StandardTestDispatcher()
    private val config = AppConfig("https://example.test", "rutacibao-test", AppConfig.Variant.Development, AppConfig.Platform.Ios)

    @BeforeTest fun setUp() = Dispatchers.setMain(dispatcher)
    @AfterTest fun tearDown() = Dispatchers.resetMain()

    @Test fun everyQueueHasExactlyOneKind() {
        assertEquals(ModerationQueueInput.Queue.entries.toSet(), ReviewKind.entries.map { it.queue }.toSet())
        assertEquals(ReviewKind.entries.size, ReviewKind.entries.map { it.queue }.toSet().size)
        ModerationQueueInput.Queue.entries.forEach { assertEquals(it, ReviewKind.forQueue(it).queue) }
    }

    @Test fun contractNotesAreRequiredWhereTheServerDemandsThem() {
        assertTrue(ReviewKind.Place.needsNote(Verdict.Reject))
        assertTrue(!ReviewKind.Place.needsNote(Verdict.Approve))
        assertTrue(!ReviewKind.Photo.needsNote(Verdict.Reject))
        assertTrue(ReviewKind.ContentReport.needsNote(Verdict.Approve) && ReviewKind.ContentReport.needsNote(Verdict.Reject))
        assertTrue(ReviewKind.Consultation.needsNote(Verdict.Reject))
    }

    private fun viewModel(fake: FakeStaff) = GestionViewModel(fake, config)

    @Test fun mergesQueuesNewestFirstAndResolvesImages() = runTest(dispatcher) {
        val vm = viewModel(FakeStaff())
        runCurrent()
        val items = vm.state.value.items
        assertEquals(listOf("f1", "p2", "p1"), items.map { it.id })
        assertEquals("https://example.test/img/f1.jpg", items.first().imageUrl)
    }

    @Test fun filterOffersOnlyKindsThatHaveSomethingWaiting() = runTest(dispatcher) {
        val vm = viewModel(FakeStaff())
        runCurrent()
        assertEquals(setOf(ReviewKind.Place, ReviewKind.Photo), vm.state.value.filters.map { it.kind }.toSet())
        vm.select(ReviewKind.Photo)
        assertEquals(listOf("f1"), vm.state.value.visibleItems.map { it.id })
    }

    @Test fun approveRemovesTheCardAtOnce() = runTest(dispatcher) {
        val fake = FakeStaff().apply { hold = CompletableDeferred() }
        val vm = viewModel(fake)
        runCurrent()
        val photo = vm.state.value.items.first { it.id == "f1" }
        vm.decide(photo, Verdict.Approve)
        runCurrent()
        assertEquals(listOf("p2", "p1"), vm.state.value.items.map { it.id })
        assertTrue("f1" in vm.state.value.inFlight)
        fake.hold?.complete(Unit)
        runCurrent()
        assertEquals(listOf("photo:f1:true"), fake.decisions)
        assertTrue(vm.state.value.inFlight.isEmpty())
        assertEquals(setOf(ReviewKind.Place), vm.state.value.filters.map { it.kind }.toSet())
    }

    @Test fun failedDecisionPutsTheCardBack() = runTest(dispatcher) {
        val fake = FakeStaff().apply { decisionFailure = IOException("down") }
        val vm = viewModel(fake)
        runCurrent()
        vm.decide(vm.state.value.items.first { it.id == "f1" }, Verdict.Reject)
        runCurrent()
        assertEquals(listOf("f1", "p2", "p1"), vm.state.value.items.map { it.id })
        assertEquals(1, vm.state.value.counts.first { it.kind == ReviewKind.Photo }.count)
        assertNotNull(vm.state.value.error)
    }

    @Test fun rejectNeedsANoteOfTenCharacters() = runTest(dispatcher) {
        val fake = FakeStaff()
        val vm = viewModel(fake)
        runCurrent()
        val place = vm.state.value.items.first { it.id == "p1" }
        vm.decide(place, Verdict.Reject)
        assertEquals(place, vm.state.value.noteFor?.item)
        assertTrue(fake.decisions.isEmpty())
        vm.submitNote("corto")
        assertEquals(true, vm.state.value.noteFor?.tooShort)
        vm.submitNote("  Dirección que no existe  ")
        runCurrent()
        assertNull(vm.state.value.noteFor)
        assertEquals(listOf("place:p1:false"), fake.decisions)
        assertEquals(listOf<String?>("Dirección que no existe"), fake.notes)
    }

    @Test fun stepUpReplaysTheActionOnceAfterAGoodCode() = runTest(dispatcher) {
        val fake = FakeStaff().apply { stepUpOnce = true }
        val vm = viewModel(fake)
        runCurrent()
        val photo = vm.state.value.items.first { it.id == "f1" }
        vm.decide(photo, Verdict.Approve)
        runCurrent()
        assertEquals(StepUpState.Asking(), vm.state.value.stepUp)
        assertTrue(fake.decisions.isEmpty())
        assertTrue(vm.state.value.items.any { it.id == "f1" })

        vm.verifyStepUp("12345")
        runCurrent()
        assertEquals(StepUpState.Asking(error = StepUpError.Invalid), vm.state.value.stepUp)
        assertEquals(0, fake.verifications)

        vm.verifyStepUp("123456")
        runCurrent()
        assertEquals(StepUpState.None, vm.state.value.stepUp)
        assertEquals(1, fake.verifications)
        assertEquals(listOf("photo:f1:true"), fake.decisions)
        assertTrue(vm.state.value.items.none { it.id == "f1" })
    }

    @Test fun missingEnrollmentPointsToTheWeb() = runTest(dispatcher) {
        val fake = FakeStaff()
        val vm = viewModel(fake)
        runCurrent()
        fake.enrollment = true
        vm.decide(vm.state.value.items.first { it.id == "f1" }, Verdict.Approve)
        runCurrent()
        assertEquals(StepUpState.EnrollOnWeb, vm.state.value.stepUp)
    }

    @Test fun recoveryCodeModeAcceptsLongerCodes() = runTest(dispatcher) {
        val fake = FakeStaff().apply { stepUpOnce = true }
        val vm = viewModel(fake)
        runCurrent()
        vm.decide(vm.state.value.items.first { it.id == "f1" }, Verdict.Approve)
        runCurrent()
        vm.useRecoveryCode(true)
        vm.verifyStepUp("abcd-efgh-ijkl")
        runCurrent()
        assertEquals(StepUpState.None, vm.state.value.stepUp)
        assertEquals(listOf("photo:f1:true"), fake.decisions)
    }
}
