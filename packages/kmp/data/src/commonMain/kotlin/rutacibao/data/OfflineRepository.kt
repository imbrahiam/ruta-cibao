package rutacibao.data

import dev.zacsweers.metro.AppScope
import dev.zacsweers.metro.Inject
import dev.zacsweers.metro.SingleIn
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsChannel
import io.ktor.utils.io.readRemaining
import kotlinx.io.readByteArray
import io.ktor.http.Url
import io.ktor.http.isSuccess
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlin.time.Clock
import rutacibao.api.ApiError
import rutacibao.api.ApiTransport
import rutacibao.api.generated.*
import rutacibao.core.AppConfig
import rutacibao.core.SecureStore

public data class MutationDelivery(val queued: Boolean, val slug: String? = null)
public data class PendingContribution(val id: String, val procedure: String, val blocked: Boolean, val error: String?)
public data class CachedPlace(
    val id: String, val slug: String, val name: String, val category: String, val municipality: String,
    val description: String?, val address: String?, val latitude: Double, val longitude: Double,
)
public data class OfflineUiState(
    val version: String? = null,
    val generatedAt: String? = null,
    val places: Int = 0,
    val routes: Int = 0,
    val roads: Int = 0,
    val downloading: Boolean = false,
    val syncing: Boolean = false,
    val usingCache: Boolean = false,
    val error: String? = null,
    val pending: List<PendingContribution> = emptyList(),
)

@Serializable
internal data class OutboxEntry(
    val id: String, val owner: String, val procedure: String,
    val traffic: TrafficReportInput? = null,
    val place: PlacesSubmitInput? = null,
    val consultation: ConsultationsOpenInput? = null,
    val report: PlacesReportInput? = null,
    val photos: List<DraftPhoto> = emptyList(),
    val createdId: String? = null,
    val slug: String? = null,
    val blocked: Boolean = false,
    val error: String? = null,
    val attempts: Int = 0,
    val nextAttempt: Long = 0,
)

/** Public snapshot + account-bound, encrypted write-ahead log shared by both native apps. */
@SingleIn(AppScope::class)
@Inject
public class OfflineRepository(
    private val api: RutaApi,
    private val client: HttpClient,
    private val config: AppConfig,
    private val session: Session,
    secureStore: SecureStore,
    private val uploader: PhotoUploader,
) {
    private val storage = OfflineStorage(secureStore)
    private val json = ApiTransport.DefaultJson
    private val mutex = Mutex()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var started = false
    private var loadError: String? = null
    private var entries = try {
        storage.read(OUTBOX)?.let { json.decodeFromString<List<OutboxEntry>>(it) }.orEmpty()
    } catch (_: Exception) { loadError = "storage"; emptyList() }
    internal var snapshot: OfflineSnapshot? = try {
        storage.read(SNAPSHOT)?.let { json.decodeFromString<OfflineSnapshot>(it).also(OfflineSnapshot::validate) }
    } catch (_: Exception) { loadError = "schema_invalid"; null }
        private set
    private val mutable = MutableStateFlow(OfflineUiState(error = loadError))
    public val state: StateFlow<OfflineUiState> = mutable.asStateFlow()

    init { publish() }

    /** Idempotent app-lifetime foreground loop; OS schedulers also invoke sync directly. */
    public fun start() {
        if (started) return
        started = true
        scope.launch { session.accountId.collectLatest { publish(); runCatching { sync() } } }
        scope.launch {
            while (true) {
                try { sync() } catch (cancelled: CancellationException) { throw cancelled } catch (_: Exception) { }
                delay(30_000)
            }
        }
    }

    public fun download() { scope.launch { downloadNow() } }
    public suspend fun downloadNow() {
        mutex.withLock {
            mutable.update { it.copy(downloading = true, error = null) }
            try {
                val manifest = api.offline.manifest()
                val url = Url(manifest.snapshotUrl)
                checkOffline(manifest.version.matches(Regex("[A-Za-z0-9._-]+")), "invalid_manifest")
                val path = "/api/offline/snapshots/${manifest.version}"
                // Advertised origins differ on emulators; never follow the advertised host.
                checkOffline(url.encodedPath == path && url.parameters.isEmpty() && url.fragment.isEmpty() && url.user.isNullOrEmpty() && url.password.isNullOrEmpty(), "origin_mismatch")
                checkOffline(manifest.snapshotBytes in 1..MAX_SNAPSHOT_BYTES && manifest.snapshotSha256.matches(Regex("[a-f0-9]{64}")) && manifest.version.isNotBlank(), "invalid_manifest")
                val response = client.get(config.absolute(path))
                checkOffline(response.status.isSuccess(), "network")
                val bytes = response.bodyAsChannel().readRemaining(manifest.snapshotBytes + 1).readByteArray()
                checkOffline(bytes.size.toLong() == manifest.snapshotBytes, "size_mismatch")
                checkOffline(sha256(bytes) == manifest.snapshotSha256, "checksum_mismatch")
                val text = bytes.decodeToString(throwOnInvalidSequence = true)
                val next = try { json.decodeFromString<OfflineSnapshot>(text).also(OfflineSnapshot::validate) } catch (_: Exception) { throw OfflineFailure("schema_invalid") }
                checkOffline(next.version == manifest.version && kotlin.time.Instant.parse(next.generatedAt) == manifest.generatedAt, "version_mismatch")
                storage.write(SNAPSHOT, text)
                snapshot = next
                publish()
            } catch (cancelled: CancellationException) { throw cancelled
            } catch (error: Exception) {
                mutable.update { it.copy(error = (error as? OfflineFailure)?.reason ?: "network") }
            } finally { mutable.update { it.copy(downloading = false) } }
        }
    }

    public fun removeSnapshot() { scope.launch { mutex.withLock { storage.delete(SNAPSHOT); snapshot = null; publish() } } }
    internal fun usedCache() { mutable.update { it.copy(usingCache = true) } }
    public fun cachedPlaces(): List<CachedPlace> = snapshot?.places?.map {
        CachedPlace(it.id, it.slug, it.name, it.category.name, it.municipality.name, it.description, it.address, it.location.lat, it.location.lng)
    }.orEmpty()
    public fun cachedRoutes(): List<RoutesBrowseOutput.Item> = snapshot?.routes.orEmpty()
    public fun cachedRoads(): List<OfflineRoad> = snapshot?.roads.orEmpty()
    public fun flush() { scope.launch { sync() } }
    public fun retry(id: String) { scope.launch { mutex.withLock {
        val owner = session.accountId.value ?: return@withLock
        entries = entries.map { if (it.id == id && it.owner == owner) it.copy(blocked = false, error = null, nextAttempt = 0) else it }
        persist()
    }; sync() } }
    public fun discard(id: String) { scope.launch { mutex.withLock {
        entries = entries.filterNot { it.id == id && it.owner == session.accountId.value }
        persist()
    } } }

    public suspend fun reportTraffic(input: TrafficReportInput): MutationDelivery = enqueue(input.requestId) { owner -> OutboxEntry(input.requestId, owner, "traffic_report", traffic = input) }
    public suspend fun submitPlace(input: PlacesSubmitInput, photos: List<DraftPhoto>): MutationDelivery = enqueue(input.requestId) { owner -> OutboxEntry(input.requestId, owner, "places_submit", place = input, photos = photos) }
    public suspend fun openConsultation(input: ConsultationsOpenInput, photos: List<DraftPhoto>): MutationDelivery = enqueue(input.requestId) { owner -> OutboxEntry(input.requestId, owner, "consultations_open", consultation = input, photos = photos) }
    public suspend fun reportPlace(input: PlacesReportInput): MutationDelivery = enqueue(input.requestId) { owner -> OutboxEntry(input.requestId, owner, "places_report", report = input) }

    private suspend fun enqueue(id: String, create: (String) -> OutboxEntry): MutationDelivery = mutex.withLock {
        check(loadError != "storage") { "Offline queue unavailable" }
        val owner = ensureOwner() ?: throw ApiError(401, "UNAUTHORIZED", "session")
        var entry = entries.firstOrNull { it.id == id && it.owner == owner }
        if (entry == null) {
            entry = create(owner)
            entries = entries + entry
        }
        persist() // No request is made before the durable commit, including the photo bytes.
        try {
            val delivered = deliver(entry)
            entries = entries.filterNot { it.id == id && it.owner == owner }
            persist()
            MutationDelivery(false, delivered.slug)
        } catch (cancelled: CancellationException) { throw cancelled
        } catch (error: Exception) {
            if (entry.traffic != null && (error as? ApiError)?.reason == "outside_province") {
                entries = entries.filterNot { it.id == id && it.owner == owner }
                persist()
            } else {
                failed(entry.id, owner, error)
            }
            if (!isTransient(error)) throw error
            MutationDelivery(true)
        }
    }

    public suspend fun sync() {
        mutex.withLock {
            if (loadError == "storage" || !session.isSignedIn.value) { publish(); return@withLock }
            val owner = try { ensureOwner() } catch (_: Exception) { return@withLock } ?: return@withLock
            mutable.update { it.copy(syncing = true) }
            try {
                for (entry in entries.filter { it.owner == owner && !it.blocked && it.nextAttempt <= Clock.System.now().toEpochMilliseconds() }) {
                    if (session.accountId.value != owner) break
                    try {
                        deliver(entry)
                        entries = entries.filterNot { it.id == entry.id && it.owner == owner }
                        persist()
                    } catch (cancelled: CancellationException) { throw cancelled
                    } catch (error: Exception) { failed(entry.id, owner, error); if (isTransient(error) || (error as? ApiError)?.status == 401) break }
                }
            } finally { mutable.update { it.copy(syncing = false) } }
        }
    }

    private suspend fun ensureOwner(): String? {
        val token = session.identityToken() ?: return null
        try {
            val me = api.me.get()
            val id = me.userId ?: throw ApiError(401, "UNAUTHORIZED", "session")
            session.bindAccount(id, token)
        } catch (cancelled: CancellationException) { throw cancelled
        } catch (error: Exception) {
            if (!isTransient(error)) throw error
        }
        return session.accountId.value.takeIf { token == session.identityToken() }
    }

    private suspend fun deliver(original: OutboxEntry): OutboxEntry {
        requireOwner(original.owner)
        val token = session.identityToken() ?: throw ApiError(401, "UNAUTHORIZED", "session")
        val cookie = session.cookieHeader() ?: throw ApiError(401, "UNAUTHORIZED", "session")
        return kotlinx.coroutines.withContext(BoundSession(token, cookie)) { deliverBound(original) }
    }

    private suspend fun deliverBound(original: OutboxEntry): OutboxEntry {
        var entry = entries.first { it.id == original.id && it.owner == original.owner }
        requireOwner(entry.owner)
        entry.traffic?.let {
            if (Clock.System.now() - it.observedAt > kotlin.time.Duration.parse("6h")) throw ApiError(422, "STALE_REPORT", "expired")
            api.traffic.report(it)
        }
        entry.report?.let { api.places.report(it) }
        if (entry.createdId == null && entry.place != null) {
            val output = api.places.submit(entry.place!!)
            entry = entry.copy(createdId = output.id, slug = output.slug)
            replace(entry)
        }
        if (entry.createdId == null && entry.consultation != null) {
            val output = api.consultations.open(entry.consultation!!)
            entry = entry.copy(createdId = output.id, slug = output.slug)
            replace(entry)
        }
        for (photo in entry.photos) {
            requireOwner(entry.owner)
            if (entry.place != null) uploader.uploadPlacePhoto(entry.createdId!!, photo)
            else uploader.uploadConsultationPhoto(entry.createdId!!, photo)
        }
        requireOwner(entry.owner)
        return entry
    }

    private fun requireOwner(owner: String) {
        if (!session.isSignedIn.value || session.accountId.value != owner) throw ApiError(401, "UNAUTHORIZED", "session")
    }
    private fun replace(entry: OutboxEntry) {
        entries = entries.map { if (it.id == entry.id && it.owner == entry.owner) entry else it }
        persist()
    }
    private fun failed(id: String, owner: String, error: Exception) {
        entries = entries.map {
            if (it.id != id || it.owner != owner) it else {
                val transient = isTransient(error)
                val attempts = it.attempts + 1
                it.copy(blocked = !transient, error = (error as? ApiError)?.code?.lowercase() ?: "network", attempts = attempts,
                    nextAttempt = Clock.System.now().toEpochMilliseconds() + minOf(3_600_000L, 5_000L * (1L shl minOf(attempts, 9))))
            }
        }
        persist()
    }
    private fun persist() { storage.write(OUTBOX, json.encodeToString(entries)); publish() }
    private fun publish() {
        val snapshot = snapshot
        mutable.update { it.copy(version = snapshot?.version, generatedAt = snapshot?.generatedAt,
            places = snapshot?.places?.size ?: 0, routes = snapshot?.routes?.size ?: 0, roads = snapshot?.roads?.size ?: 0,
            pending = entries.filter { entry -> entry.owner == session.accountId.value }.map { entry -> PendingContribution(entry.id, entry.procedure, entry.blocked, entry.error) }) }
    }
    private companion object {
        const val SNAPSHOT = "rutacibao.offline.snapshot.v1"
        const val OUTBOX = "rutacibao.offline.outbox.v1"
        const val MAX_SNAPSHOT_BYTES = 64L * 1024 * 1024
    }
}

internal fun isTransient(error: Throwable): Boolean = when (error) {
    is CancellationException -> false
    is ApiError -> error.status == 408 || error.status == 425 || error.status == 429 || error.status in 500..599
    is io.ktor.utils.io.errors.IOException -> true
    is io.ktor.client.plugins.HttpRequestTimeoutException -> true
    else -> false
}
private class OfflineFailure(val reason: String) : Exception(reason)
private fun checkOffline(condition: Boolean, reason: String) { if (!condition) throw OfflineFailure(reason) }
