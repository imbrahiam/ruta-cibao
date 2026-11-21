package rutacibao.data

import dev.zacsweers.metro.Inject
import io.ktor.client.HttpClient
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import rutacibao.core.AppConfig

/**
 * Better Auth's REST endpoints for passwordless sign-in. There is no native
 * SDK. The session cookie in the response is captured by the HTTP client's session plugin.
 */
@Inject
public class AuthRepository(
    private val client: HttpClient,
    private val config: AppConfig,
    private val session: Session,
    private val push: PushRepository,
) {
    public suspend fun sendPhoneCode(e164: String): Unit =
        post("phone-number/send-otp") { put("phoneNumber", e164) }

    public suspend fun verifyPhone(e164: String, code: String): Unit =
        post("phone-number/verify") {
            put("phoneNumber", e164)
            put("code", code)
        }

    public suspend fun sendEmailCode(email: String): Unit =
        post("email-otp/send-verification-otp") {
            put("email", email)
            put("type", "sign-in")
        }

    public suspend fun verifyEmail(email: String, code: String): Unit =
        post("sign-in/email-otp") {
            put("email", email)
            put("otp", code)
        }

    /** Tells the server first, then forgets locally even if that failed. */
    public suspend fun signOut() {
        push.unregisterBeforeSignOut {
            runCatching { post("sign-out") {} }
            session.clear()
        }
    }

    private suspend fun post(path: String, body: kotlinx.serialization.json.JsonObjectBuilder.() -> Unit) {
        val response = client.post("${config.apiOrigin.trimEnd('/')}/api/auth/$path") {
            contentType(ContentType.Application.Json)
            setBody(buildJsonObject(body).toString())
        }
        if (!response.status.isSuccess()) {
            val body = runCatching { Json.parseToJsonElement(response.bodyAsText()).jsonObject }.getOrNull()
            val code = runCatching { body?.get("code")?.jsonPrimitive?.content }.getOrNull()
            // A refused code send says how long to wait (`retryAfter`, seconds).
            val retryAfter = runCatching { body?.get("retryAfter")?.jsonPrimitive?.content?.toDouble()?.toInt() }.getOrNull()
                ?: response.headers["Retry-After"]?.toIntOrNull()
            throw AuthError(response.status.value, code.orEmpty(), retryAfter)
        }
    }
}

/**
 * A Better Auth refusal: `status` plus its machine code (`INVALID_OTP`, `OTP_EXPIRED`…), and for a
 * rate limit the seconds until another try is allowed, when the server says.
 */
public class AuthError(
    public val status: Int,
    public val code: String,
    public val retryAfterSeconds: Int? = null,
) : Exception("auth $status $code")
