package rutacibao.core

/**
 * Build-time public configuration, supplied by each app at startup. None of
 * it is secret; each install variant (dev, preview, production) has its own.
 */
public data class AppConfig(
    /** Origin of the web app, e.g. `https://rutacibao.app`. No trailing slash. */
    val apiOrigin: String,
    /** URL scheme of this variant (`rutacibao-dev`). Better Auth trusts `<scheme>://`. */
    val appScheme: String,
    val variant: Variant,
    val platform: Platform,
) {
    public enum class Variant { Development, Preview, Production }
    public enum class Platform { Android, Ios }

    val restBaseUrl: String get() = "${apiOrigin.trimEnd('/')}/api"
    val origin: String get() = "$appScheme://"

    /** Server-relative paths (`/api/places/…/thumbnail`) to absolute URLs; absolute ones pass through. */
    public fun absolute(path: String): String =
        if (path.startsWith("http://") || path.startsWith("https://")) path else apiOrigin.trimEnd('/') + "/" + path.trimStart('/')
}
