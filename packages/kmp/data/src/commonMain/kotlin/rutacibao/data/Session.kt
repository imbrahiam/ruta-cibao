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
    private val owner = MutableStateFlow(loadOwner())
    public val accountId: StateFlow<String?> = owner.asStateFlow()

    internal fun identityToken(): String? = cookies.value.entries.firstOrNull { isSessionCookie(it.key) }?.value

    /** Bind only a server-verified identity to the exact session that fetched it. */
    internal fun bindAccount(id: String, token: String?) {
        if (token == null || token != identityToken()) return
        store.write(OWNER_KEY, "${sha256(token.encodeToByteArray())}\n$id")
        owner.value = id
    }

    private fun loadOwner(): String? {
        val token = identityToken() ?: return null
        val record = store.read(OWNER_KEY)?.split('\n', limit = 2) ?: return null
        return record.getOrNull(1)?.takeIf { record.first() == sha256(token.encodeToByteArray()) }
    }

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
        val previousToken = identityToken()
        cookies.value = next
        signedIn.value = next.keys.any(::isSessionCookie)
        if (previousToken != identityToken()) {
            store.delete(OWNER_KEY)
            owner.value = null
        }
        if (next.isEmpty()) store.delete(KEY) else store.write(KEY, next.entries.joinToString("\n") { "${it.key}=${it.value}" })
    }

    private fun load(): Map<String, String> =
        store.read(KEY).orEmpty().lines().filter { '=' in it }.associate {
            val (name, value) = it.split('=', limit = 2)
            name to value
        }

    private companion object {
        const val KEY = "rutacibao.session.cookies"
        const val OWNER_KEY = "rutacibao.session.owner"
        fun isSessionCookie(name: String) = name.endsWith("session_token")
    }
}

/** Queue replays must never adopt another account's cookie between API calls. */
internal class BoundSession(val token: String, val cookie: String) :
    kotlin.coroutines.AbstractCoroutineContextElement(Key) {
    companion object Key : kotlin.coroutines.CoroutineContext.Key<BoundSession>
}

/** Ktor plugin wiring [Session] and the trusted origin into every request. */
internal fun sessionPlugin(session: Session, config: AppConfig) = createClientPlugin("RutaSession") {
    onRequest { request, _ ->
        request.headers.append(HttpHeaders.Origin, config.origin)
        val bound = kotlinx.coroutines.currentCoroutineContext()[BoundSession]
        if (bound != null && bound.token != session.identityToken()) throw rutacibao.api.ApiError(401, "UNAUTHORIZED", "session")
        (bound?.cookie ?: session.cookieHeader())?.let { request.headers.append(HttpHeaders.Cookie, it) }
    }
    onResponse { response ->
        val request = response.call.request
        if (request.headers[HttpHeaders.Cookie] == session.cookieHeader()) {
            session.accept(response.headers.getAll(HttpHeaders.SetCookie).orEmpty())
            // The server no longer knows this session (expired, revoked, another
            // database): sign out here too, so screens show "sign in" instead of
            // failing one by one. Only on reads: a rejected code is also a 401,
            // and those are always POSTs.
            if (response.status.value == 401 && request.method == io.ktor.http.HttpMethod.Get && session.identityToken() != null) {
                session.clear()
            }
        }
    }
}

/** The session plugin, for tests that build their own client around a mock engine. */
public fun sessionPluginForTests(session: Session, config: AppConfig): io.ktor.client.plugins.api.ClientPlugin<Unit> =
    sessionPlugin(session, config)
