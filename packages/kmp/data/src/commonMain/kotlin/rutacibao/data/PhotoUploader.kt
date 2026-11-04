package rutacibao.data

import dev.zacsweers.metro.Inject
import io.ktor.client.HttpClient
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import rutacibao.api.ApiError
import rutacibao.api.generated.ConsultationsAttachPhotoInput
import rutacibao.api.generated.ConsultationsPhotoUploadInput
import rutacibao.api.generated.ConsultationsPhotoUploadOutput
import rutacibao.api.generated.PlacesAttachPhotoInput
import rutacibao.api.generated.PlacesPhotoUploadInput
import rutacibao.api.generated.PlacesPhotoUploadOutput
import rutacibao.api.generated.RutaApi

/** Signed PUT requests must never carry the app's session cookie to storage. */
@Inject
public class PhotoUploader(private val api: RutaApi, private val session: Session) {
    private val storage by lazy {
        HttpClient(httpEngine()) {
            expectSuccess = false
            install(HttpTimeout) { requestTimeoutMillis = 60_000 }
        }
    }

    public suspend fun uploadPlacePhoto(id: String, photo: DraftPhoto) {
        val token = session.identityToken() ?: throw ApiError(401, "UNAUTHORIZED", "session")
        val ticket = api.places.photoUpload(PlacesPhotoUploadInput(
            placeId = id,
            requestId = photo.requestId,
            contentType = PlacesPhotoUploadInput.ContentType.ImageJpeg,
            sizeBytes = photo.jpeg.size.toLong(),
        ))
        if (session.identityToken() != token) throw ApiError(401, "UNAUTHORIZED", "session")
        if (ticket.status == PlacesPhotoUploadOutput.Status.Upload) {
            put(requireNotNull(ticket.uploadUrl), photo.jpeg)
        }
        if (session.identityToken() != token) throw ApiError(401, "UNAUTHORIZED", "session")
        api.places.attachPhoto(PlacesAttachPhotoInput(placeId = id, storageKey = ticket.storageKey))
    }

    public suspend fun uploadConsultationPhoto(id: String, photo: DraftPhoto) {
        val token = session.identityToken() ?: throw ApiError(401, "UNAUTHORIZED", "session")
        val ticket = api.consultations.photoUpload(ConsultationsPhotoUploadInput(
            consultationId = id,
            requestId = photo.requestId,
            contentType = ConsultationsPhotoUploadInput.ContentType.ImageJpeg,
            sizeBytes = photo.jpeg.size.toLong(),
        ))
        if (session.identityToken() != token) throw ApiError(401, "UNAUTHORIZED", "session")
        if (ticket.status == ConsultationsPhotoUploadOutput.Status.Upload) {
            put(requireNotNull(ticket.uploadUrl), photo.jpeg)
        }
        if (session.identityToken() != token) throw ApiError(401, "UNAUTHORIZED", "session")
        api.consultations.attachPhoto(ConsultationsAttachPhotoInput(consultationId = id, storageKey = ticket.storageKey))
    }

    private suspend fun put(url: String, jpeg: ByteArray) {
        val response = storage.put(url) {
            contentType(ContentType.Image.JPEG)
            setBody(jpeg)
        }
        if (!response.status.isSuccess()) {
            throw ApiError(response.status.value, "UPLOAD_FAILED", "photo")
        }
    }
}
