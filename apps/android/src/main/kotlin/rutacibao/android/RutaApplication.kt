package rutacibao.android

import android.app.Application
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import rutacibao.android.platform.PushNotifications
import rutacibao.android.platform.OfflineSyncWorker
import rutacibao.android.platform.KeystoreSecureStore
import rutacibao.core.AppConfig
import rutacibao.shared.AppGraph
import rutacibao.shared.createAppGraph

class RutaApplication : Application() {
    lateinit var graph: AppGraph
        private set
    val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    override fun onCreate() {
        super.onCreate()
        seedDebugSession()
        graph = createAppGraph(
            config = AppConfig(
                apiOrigin = BuildConfig.API_ORIGIN,
                appScheme = BuildConfig.APP_SCHEME,
                variant = AppConfig.Variant.valueOf(BuildConfig.VARIANT),
                platform = AppConfig.Platform.Android,
            ),
            secureStore = KeystoreSecureStore(this),
        )
        graph.offline.start()
        OfflineSyncWorker.schedule(this)
        PushNotifications.initialize(this)
        applicationScope.launch {
            graph.session.isSignedIn.collect { signedIn ->
                if (signedIn) PushNotifications.sync(this@RutaApplication)
            }
        }
    }

    /**
     * Debug-only test hook: if `files/debug-session` exists (pushed with `adb shell run-as`), its
     * content ("better-auth.session_token=...") becomes the stored session before the graph reads it.
     */
    private fun seedDebugSession() {
        if (!BuildConfig.DEBUG) return
        val file = java.io.File(filesDir, "debug-session")
        if (!file.exists()) return
        runCatching {
            KeystoreSecureStore(this).write("rutacibao.session.cookies", file.readText().trim())
        }
        file.delete()
    }
}
