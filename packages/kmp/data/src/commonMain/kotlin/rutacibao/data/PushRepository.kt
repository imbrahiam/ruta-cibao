package rutacibao.data

import dev.zacsweers.metro.AppScope
import dev.zacsweers.metro.Inject
import dev.zacsweers.metro.SingleIn
import kotlin.coroutines.cancellation.CancellationException
import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import rutacibao.api.generated.NotificationsSubscribeNativePushInput
import rutacibao.api.generated.NotificationsUnsubscribeNativePushInput
import rutacibao.api.generated.RutaApi
import rutacibao.core.SecureStore

/** This installation's encrypted provider token and account binding. */
@OptIn(ExperimentalUuidApi::class)
@SingleIn(AppScope::class)
@Inject
public class PushRepository(
    private val api: RutaApi,
    private val store: SecureStore,
    private val session: Session,
) {
    public enum class Platform { Ios, Android }
    private val mutex = Mutex()
    private val installationId: String
        get() = store.read(INSTALLATION) ?: Uuid.random().toString().also { store.write(INSTALLATION, it) }

    /** Failures retain their request id for the next foreground/sign-in retry. */
    public suspend fun register(platform: Platform, token: String): Boolean = mutex.withLock {
        if (store.read(TOKEN) != token || store.read(PLATFORM) != platform.name) store.delete(BIND_REQUEST)
        store.write(TOKEN, token)
        store.write(PLATFORM, platform.name)
        bindRemembered()
    }

    public suspend fun resync(): Boolean = mutex.withLock { bindRemembered() }

    private suspend fun bindRemembered(): Boolean {
        if (!session.isSignedIn.value) return false
        val token = store.read(TOKEN) ?: return false
        val platform = store.read(PLATFORM)?.let { runCatching { Platform.valueOf(it) }.getOrNull() } ?: return false
        return runCatching {
            api.notifications.subscribeNativePush(NotificationsSubscribeNativePushInput(
                requestId = requestId(BIND_REQUEST),
                installationId = installationId,
                platform = if (platform == Platform.Ios) NotificationsSubscribeNativePushInput.Platform.Ios else NotificationsSubscribeNativePushInput.Platform.Android,
                token = token,
            ))
            store.delete(BIND_REQUEST)
        }.onFailure { if (it is CancellationException) throw it }.isSuccess
    }

    /** Called when OS notification permission is revoked, while credentials remain valid. */
    public suspend fun unregister() { mutex.withLock { unbind() } }

    /** Token callbacks cannot rebind between device removal and clearing the session. */
    internal suspend fun unregisterBeforeSignOut(signOut: suspend () -> Unit) {
        mutex.withLock { unbind(); signOut() }
    }

    private suspend fun unbind() {
        if (!session.isSignedIn.value) return
        runCatching {
            api.notifications.unsubscribeNativePush(NotificationsUnsubscribeNativePushInput(
                requestId = requestId(UNBIND_REQUEST), installationId = installationId,
            ))
            store.delete(UNBIND_REQUEST)
            store.delete(BIND_REQUEST)
        }.onFailure { if (it is CancellationException) throw it }
    }

    private fun requestId(key: String): String = store.read(key) ?: Uuid.random().toString().also { store.write(key, it) }

    private companion object {
        const val INSTALLATION = "push.installation"
        const val TOKEN = "push.token"
        const val PLATFORM = "push.platform"
        const val BIND_REQUEST = "push.bind-request"
        const val UNBIND_REQUEST = "push.unbind-request"
    }
}
