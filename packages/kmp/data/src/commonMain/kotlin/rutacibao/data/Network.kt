package rutacibao.data

import co.touchlab.kermit.Logger
import io.ktor.client.HttpClient
import io.ktor.client.engine.HttpClientEngineFactory
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.api.createClientPlugin
import io.ktor.client.plugins.defaultRequest
import io.ktor.client.plugins.logging.LogLevel
import io.ktor.client.plugins.logging.Logging
import io.ktor.http.HttpHeaders
import rutacibao.api.ApiTransport
import rutacibao.api.generated.RutaApi
import rutacibao.core.AppConfig

/**
 * Test hook for runs where the network can't be cut from outside (the iOS simulator): while set, API calls
 * fail like a dropped connection. Only installed outside production, flipped by the debug-only app link.
 */
public object DebugNetwork {
    public var offline: Boolean = false
}

private val debugOffline = createClientPlugin("DebugOffline") {
    onRequest { _, _ -> if (DebugNetwork.offline) throw io.ktor.utils.io.errors.IOException("offline (debug)") }
}

/** The platform's HTTP engine: OkHttp on Android, URLSession on iOS. */
internal expect fun httpEngine(): HttpClientEngineFactory<*>

/**
 * The one HTTP client: the oRPC API and Better Auth share it, so the session
 * cookie Better Auth sets is the one every API call sends.
 */
public fun createHttpClient(config: AppConfig, session: Session): HttpClient {
    val log = Logger.withTag("http")
    return HttpClient(httpEngine()) {
        expectSuccess = false
        install(HttpTimeout) {
            connectTimeoutMillis = 10_000
            requestTimeoutMillis = 30_000
        }
        install(sessionPlugin(session, config))
        if (config.variant != AppConfig.Variant.Production) install(debugOffline)
        // Headers only, and only outside production: bodies can carry PII.
        if (config.variant != AppConfig.Variant.Production) {
            install(Logging) {
                level = LogLevel.INFO
                sanitizeHeader { it == HttpHeaders.Cookie || it == HttpHeaders.SetCookie }
                logger = object : io.ktor.client.plugins.logging.Logger {
                    override fun log(message: String) = log.d { message }
                }
            }
        }
        defaultRequest { headers.append("x-client", "native-${config.platform.name.lowercase()}") }
    }
}

public fun createRutaApi(client: HttpClient, config: AppConfig): RutaApi =
    RutaApi(ApiTransport(client, config.restBaseUrl))
