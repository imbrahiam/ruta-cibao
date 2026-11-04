package rutacibao.api

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.HttpRequestData
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.TextContent
import io.ktor.http.headersOf
import kotlinx.coroutines.test.runTest
import rutacibao.api.generated.ConsultationsBrowseInput
import rutacibao.api.generated.ConsultationsSupportInput
import rutacibao.api.generated.RutaApi
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class ApiTransportTest {
    private val jsonHeaders = headersOf(HttpHeaders.ContentType, "application/json")

    private fun api(respond: suspend (HttpRequestData) -> Pair<HttpStatusCode, String>): Pair<RutaApi, MutableList<HttpRequestData>> {
        val seen = mutableListOf<HttpRequestData>()
        val engine = MockEngine { request ->
            seen += request
            val (status, body) = respond(request)
            respond(body, status, jsonHeaders)
        }
        return RutaApi(ApiTransport(HttpClient(engine), "https://example.test/api")) to seen
    }

    @Test
    fun getInputGoesToTheQueryString() = runTest {
        val (api, seen) = api { HttpStatusCode.OK to """{"items":[],"total":0,"extra":1}""" }
        val out = api.consultations.browse(
            ConsultationsBrowseInput(status = ConsultationsBrowseInput.Status.InReview, limit = 5),
        )
        assertEquals(0, out.total)
        val url = seen.single().url
        assertEquals("/api/consultations", url.encodedPath)
        assertEquals("in_review", url.parameters["status"])
        assertEquals("5", url.parameters["limit"])
        assertEquals(null, url.parameters["mine"])
    }

    @Test
    fun pathKeysLeaveTheBody() = runTest {
        val (api, seen) = api { HttpStatusCode.OK to """{"supported":true,"supportCount":3}""" }
        runCatching {
            api.consultations.support(
                ConsultationsSupportInput(consultationId = "c 1", supported = true),
            )
        }
        val request = seen.single()
        assertEquals("/api/consultations/c%201/support", request.url.encodedPath)
        val body = (request.body as TextContent).text
        assertEquals(false, body.contains("consultationId"))
    }

    @Test
    fun errorsDecodeTheOrpcBody() = runTest {
        val (api, _) = api { HttpStatusCode.TooManyRequests to """{"defined":true,"code":"RATE_LIMITED","status":429,"message":"slow down"}""" }
        val error = assertFailsWith<ApiError> { api.consultations.browse() }
        assertEquals("RATE_LIMITED", error.code)
        assertEquals(true, error.isRateLimited)
    }
}
