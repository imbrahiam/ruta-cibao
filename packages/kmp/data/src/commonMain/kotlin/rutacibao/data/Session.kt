package rutacibao.data

import dev.zacsweers.metro.Inject
import dev.zacsweers.metro.SingleIn
import dev.zacsweers.metro.AppScope
import io.ktor.client.plugins.api.createClientPlugin
import io.ktor.http.HttpHeaders
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import rutacibao.core.AppConfig
import rutacibao.core.SecureStore

/**
 * The Better Auth session, as cookies kept in the secure store.
 *
 * Better Auth answers sign-in with `Set-Cookie`; we keep those name/value
 * pairs and send them back as one `Cookie` header on every request.
 * Requests also carry `Origin: <scheme>://`, an
 * origin the server lists in `trustedOrigins`.
 */
@SingleIn(AppScope::class)
@Inject
public class Session(private val store: SecureStore) {
    private val cookies = MutableStateFlow(load())

    public val isSignedIn: StateFlow<Boolean> get() = signedIn.asStateFlow()
    private val signedIn = MutableStateFlow(cookies.value.keys.any(::isSessionCookie))

    internal fun cookieHeader(): String? =
        cookies.value.takeIf { it.isNotEmpty() }?.entries?.joinToString("; ") { "${it.key}=${it.value}" }

    internal fun accept(setCookieHeaders: List<String>) {
        if (setCookieHeaders.isEmpty()) return
        val next = cookies.value.toMutableMap()
        for (header in setCookieHeaders) {
            val parts = header.split(';').map(String::trim)
            val (name, value) = parts.first().split('=', limit = 2).let { it[0] to it.getOrElse(1) { "" } }
            if (!name.contains("better-auth")) continue
            val expired = value.isEmpty() || parts.any {
                it.equals("Max-Age=0", ignoreCase = true) || it.startsWith("Max-Age=-")
            }
            if (expired) next.remove(name) else next[name] = value
        }
        save(next)
    }

    /** Local sign-out. The caller tells the server first while the cookie is valid. */
    public fun clear() {
        save(emptyMap())
    }

    private fun save(next: Map<String, String>) {
        cookies.value = next
        signedIn.value = next.keys.any(::isSessionCookie)
        if (next.isEmpty()) store.delete(KEY) else store.write(KEY, next.entries.joinToString("\n") { "${it.key}=${it.value}" })
    }

    private fun load(): Map<String, String> =
        store.read(KEY).orEmpty().lines().filter { '=' in it }.associate {
            val (name, value) = it.split('=', limit = 2)
            name to value
        }

    private companion object {
        const val KEY = "rutacibao.session.cookies"
        fun isSessionCookie(name: String) = name.endsWith("session_token")
    }
}

/** Ktor plugin wiring [Session] and the trusted origin into every request. */
internal fun sessionPlugin(session: Session, config: AppConfig) = createClientPlugin("RutaSession") {
    onRequest { request, _ ->
        request.headers.append(HttpHeaders.Origin, config.origin)
        session.cookieHeader()?.let { request.headers.append(HttpHeaders.Cookie, it) }
    }
    onResponse { response ->
        session.accept(response.headers.getAll(HttpHeaders.SetCookie).orEmpty())
    }
}

/** The session plugin, for tests that build their own client around a mock engine. */
public fun sessionPluginForTests(session: Session, config: AppConfig): io.ktor.client.plugins.api.ClientPlugin<Unit> =
    sessionPlugin(session, config)
