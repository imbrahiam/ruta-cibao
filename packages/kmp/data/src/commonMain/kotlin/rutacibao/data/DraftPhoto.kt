package rutacibao.data

import kotlinx.serialization.Serializable

/** Stable upload identity and normalized JPEG bytes, persisted with the outbox draft. */
@Serializable
public data class DraftPhoto(val requestId: String, val jpeg: ByteArray)
