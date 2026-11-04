package rutacibao.api

import io.ktor.client.HttpClient
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpMethod
import io.ktor.http.URLBuilder
import io.ktor.http.appendPathSegments
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.http.takeFrom
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.SerializationStrategy
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * Speaks oRPC's OpenAPI dialect for the generated [rutacibao.api.generated.RutaApi]:
 * an operation's input is one object whose path keys go into the URL, query
 * keys into the query string (GET input) and the rest into a JSON body.
 *
 * Auth, origin and logging live in the [client]'s plugins, not here.
 */
public class ApiTransport(
    private val client: HttpClient,
    /** Base URL of the REST surface, e.g. `https://rutacibao.do/api`. */
    private val baseUrl: String,
    public val json: Json = DefaultJson,
) {
    public fun <T> encode(serializer: SerializationStrategy<T>, value: T): JsonObject =
        json.encodeToJsonElement(serializer, value) as JsonObject

    public suspend fun <T> call(
        method: String,
        path: String,
        input: JsonObject?,
        pathKeys: Set<String>,
        queryKeys: Set<String>,
        hasBody: Boolean,
        output: DeserializationStrategy<T>,
    ): T {
        val values = input.orEmpty().filterValues { it !is JsonNull }
        val url = URLBuilder().apply {
            takeFrom(baseUrl.trimEnd('/'))
            // Substitute raw values per segment; appendPathSegments encodes each once.
            val segments = path.trimStart('/').split('/').map { segment ->
                PATH_PARAM.replace(segment) { match ->
                    val key = match.groupValues[1]
                    val value = values[key] ?: error("missing path parameter '$key' for $path")
                    (value as JsonPrimitive).content
                }
            }
            appendPathSegments(segments, encodeSlash = true)
            for (key in queryKeys) {
                val value = values[key] as? JsonPrimitive ?: continue
                parameters.append(key, value.content)
            }
        }.build()

        val response = client.request(url) {
            this.method = HttpMethod.parse(method)
            if (hasBody) {
                contentType(ContentType.Application.Json)
                val body = JsonObject(values.filterKeys { it !in pathKeys && it !in queryKeys })
                setBody(json.encodeToString(JsonObject.serializer(), body))
            }
        }
        val text = response.bodyAsText()
        if (!response.status.isSuccess()) throw ApiError.from(response.status.value, text, json)
        return json.decodeFromString(output, text.ifEmpty { "null" })
    }

    public companion object {
        private val PATH_PARAM = Regex("\\{([^}]+)\\}")

        /** Lenient on what the server adds, strict on what it promises. */
        public val DefaultJson: Json = Json {
            ignoreUnknownKeys = true
            explicitNulls = false
            encodeDefaults = false
            coerceInputValues = true
        }
    }
}

private fun JsonObject?.orEmpty(): Map<String, kotlinx.serialization.json.JsonElement> = this ?: emptyMap()
