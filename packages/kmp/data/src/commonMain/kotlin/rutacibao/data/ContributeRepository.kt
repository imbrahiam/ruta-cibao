package rutacibao.data

import dev.zacsweers.metro.Inject
import io.ktor.client.HttpClient
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid
import rutacibao.api.ApiError
import rutacibao.api.generated.PlacesAttachPhotoInput
import rutacibao.api.generated.PlacesCategoriesItem
import rutacibao.api.generated.PlacesPhotoUploadInput
import rutacibao.api.generated.PlacesPhotoUploadOutput
import rutacibao.api.generated.PlacesSubmitInput
import rutacibao.api.generated.RutaApi
import rutacibao.api.generated.TrafficCategoriesItem
import rutacibao.api.generated.TrafficReportInput

/** Writes a resident makes to the map: road reports and place suggestions. */
@Inject
public class ContributeRepository(private val api: RutaApi) {
    /**
     * Uploads go straight to object storage through a presigned URL, so they
     * use a bare client: the app's client would send the session cookie along.
     */
    private val storage by lazy {
        HttpClient(httpEngine()) {
            expectSuccess = false
            install(HttpTimeout) { requestTimeoutMillis = 60_000 }
        }
    }

    public suspend fun trafficCategories(): List<TrafficCategoriesItem> = api.traffic.categories()
    public suspend fun placeCategories(): List<PlacesCategoriesItem> = api.places.categories()
    public suspend fun reportTraffic(input: TrafficReportInput): Unit { api.traffic.report(input) }

    /** The new place's id, for attaching photos to it. */
    public suspend fun submitPlace(input: PlacesSubmitInput): String = api.places.submit(input).id

    /** One JPEG onto a place: reserve an upload, PUT the bytes, record it. */
    @OptIn(ExperimentalUuidApi::class)
    public suspend fun uploadPlacePhoto(placeId: String, jpeg: ByteArray) {
        val ticket = api.places.photoUpload(
            PlacesPhotoUploadInput(
                placeId = placeId,
                requestId = Uuid.random().toString(),
                contentType = PlacesPhotoUploadInput.ContentType.ImageJpeg,
                sizeBytes = jpeg.size.toLong(),
            ),
        )
        val url = ticket.uploadUrl
        if (ticket.status == PlacesPhotoUploadOutput.Status.Upload && url != null) {
            val response = storage.put(url) {
                contentType(ContentType.Image.JPEG)
                setBody(jpeg)
            }
            if (!response.status.isSuccess()) throw ApiError(response.status.value, "UPLOAD_FAILED", "photo")
        }
        api.places.attachPhoto(PlacesAttachPhotoInput(placeId = placeId, storageKey = ticket.storageKey))
    }
}
