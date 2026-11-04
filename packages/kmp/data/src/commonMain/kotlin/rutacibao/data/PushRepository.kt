package rutacibao.data

import kotlin.coroutines.cancellation.CancellationException

import dev.zacsweers.metro.AppScope
import dev.zacsweers.metro.Inject
import dev.zacsweers.metro.SingleIn
import rutacibao.api.generated.NotificationsSubscribeNativePushInput
import rutacibao.api.generated.NotificationsUnsubscribeNativePushInput
import rutacibao.api.generated.RutaApi
import rutacibao.core.SecureStore
import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid

/**
 * This installation's push registration. The platform hands us a provider
 * token (APNs on iOS, FCM on Android); we bind it to the signed-in account
 * under a stable installation id, so a reinstall or a token rotation replaces
 * the old binding instead of adding one.
 *
 * Signed out, the token is only remembered; signing in binds it ([resync]),
 * signing out unbinds it ([unregister]) before the session goes.
 */
@OptIn(ExperimentalUuidApi::class)
@SingleIn(AppScope::class)
@Inject
public class PushRepository(
    private val api: RutaApi,
    private val store: SecureStore,
    private val session: Session,
) {
    public enum class Platform { Ios, Android }

    private val installationId: String
        get() = store.read(INSTALLATION) ?: Uuid.random().toString().also { store.write(INSTALLATION, it) }

    /**
     * A new token from the platform. Returns whether it is bound to an account
     * now. Never throws: Swift calls this directly, and an uncaught Kotlin
     * exception there ends the app. A failure is retried on the next resync.
     */
    public suspend fun register(platform: Platform, token: String): Boolean {
        store.write(TOKEN, token)
        store.write(PLATFORM, platform.name)
        if (!session.isSignedIn.value) return false
        return runCatching { bind(platform, token) }
            .onFailure { if (it is CancellationException) throw it }
            .isSuccess
    }

    private suspend fun bind(platform: Platform, token: String) {
        api.notifications.subscribeNativePush(
            NotificationsSubscribeNativePushInput(
                requestId = Uuid.random().toString(),
                installationId = installationId,
                platform = if (platform == Platform.Ios) NotificationsSubscribeNativePushInput.Platform.Ios else NotificationsSubscribeNativePushInput.Platform.Android,
                token = token,
            ),
        )
    }

    /** After sign-in: bind the token this installation already has, if any. */
    public suspend fun resync(): Boolean {
        val token = store.read(TOKEN) ?: return false
        val platform = store.read(PLATFORM)?.let { runCatching { Platform.valueOf(it) }.getOrNull() } ?: return false
        return register(platform, token)
    }

    /** Before sign-out: this phone stops receiving the account's notices. Never throws. */
    public suspend fun unregister() {
        if (!session.isSignedIn.value) return
        runCatching {
            api.notifications.unsubscribeNativePush(
                NotificationsUnsubscribeNativePushInput(requestId = Uuid.random().toString(), installationId = installationId),
            )
        }.onFailure { if (it is CancellationException) throw it }
    }

    private companion object {
        const val INSTALLATION = "push.installation"
        const val TOKEN = "push.token"
        const val PLATFORM = "push.platform"
    }
}
