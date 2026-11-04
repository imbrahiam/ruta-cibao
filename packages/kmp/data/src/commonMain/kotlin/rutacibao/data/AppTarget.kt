package rutacibao.data

import io.ktor.http.Url
import io.ktor.http.decodeURLPart

/** Canonical destinations shared by links, notification taps and the inbox. */
public data class AppTarget(val kind: String, val ref: String?) {
    public companion object {
        private val slug = Regex("^[a-z0-9][a-z0-9-]{0,159}$")
        private val uuid = Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
        public fun parse(href: String, apiOrigin: String, appScheme: String): AppTarget? = runCatching {
            if (href.isEmpty() || href.any { it.isWhitespace() || it.code < 32 } || href.contains('\\') || href.contains('?') || href.contains('#')) return null
            val path = if (href.startsWith('/') && !href.startsWith("//")) href else {
                val url = Url(href)
                if (!url.user.isNullOrEmpty() || !url.password.isNullOrEmpty()) return null
                when (url.protocol.name.lowercase()) {
                    "http", "https" -> {
                        val origin = Url(apiOrigin)
                        if (url.protocol != origin.protocol || !url.host.equals(origin.host, true) || url.port != origin.port) return null
                        url.encodedPath
                    }
                    appScheme.lowercase() -> {
                        if (url.host == "s" || url.host == "contributions") "/${url.host}${url.encodedPath.takeUnless { it == "/" } ?: ""}"
                        else if (url.host.isEmpty()) url.encodedPath else return null
                    }
                    else -> return null
                }
            }
            if (path == "/contributions") return AppTarget("contributions", null)
            val parts = path.split('/')
            if (parts.size != 4 || parts[0] != "" || parts[1] != "s") return null
            val kind = parts[2]
            val ref = parts[3].decodeURLPart()
            val valid = when (kind) {
                "place", "consultation" -> slug.matches(ref)
                "route", "traffic", "report" -> uuid.matches(ref)
                else -> false
            }
            if (valid) AppTarget(kind, ref) else null
        }.getOrNull()
    }
}
