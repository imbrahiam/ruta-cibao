package rutacibao.api

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * An error the API answered with. [code] is oRPC's error code
 * (`UNAUTHORIZED`, `NOT_FOUND`, `RATE_LIMITED`, a domain code…). The UI maps
 * it to a catalogue string; [message] is for logs, never for people.
 */
public class ApiError(
    public val status: Int,
    public val code: String,
    override val message: String,
    public val data: JsonElement? = null,
) : Exception(message) {
    public val reason: String? get() = ((data as? JsonObject)?.get("reason") as? JsonPrimitive)?.content
    public val isUnauthorized: Boolean get() = status == 401
    public val isRateLimited: Boolean get() = status == 429

    internal companion object {
        @Serializable
        private data class Body(
            val code: String = "UNKNOWN",
            val message: String = "",
            val data: JsonElement? = null,
        )

        fun from(status: Int, text: String, json: Json): ApiError {
            val body = runCatching { json.decodeFromString(Body.serializer(), text) }.getOrNull()
            return ApiError(
                status = status,
                code = body?.code ?: "HTTP_$status",
                message = body?.message?.ifEmpty { null } ?: "HTTP $status",
                data = body?.data,
            )
        }
    }
}
