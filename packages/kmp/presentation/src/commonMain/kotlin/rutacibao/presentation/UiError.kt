package rutacibao.presentation

import kotlinx.coroutines.CancellationException
import kotlinx.io.IOException
import rutacibao.api.ApiError

/**
 * What went wrong, in terms a screen can show. Each case maps to a catalogue
 * string on each platform (`errors.*`); the server's message never reaches
 * the UI.
 */
public enum class UiError {
    Offline,
    SignedOut,
    RateLimited,
    NotFound,
    Server,
    Unknown;

    public companion object {
        public fun from(error: Throwable): UiError {
            if (error is CancellationException) throw error
            return when {
                error is IOException -> Offline
                error is ApiError && error.isUnauthorized -> SignedOut
                error is ApiError && error.isRateLimited -> RateLimited
                error is ApiError && error.status == 404 -> NotFound
                error is ApiError && error.status >= 500 -> Server
                else -> Unknown
            }
        }
    }
}
