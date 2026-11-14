package rutacibao.android

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import rutacibao.android.navigation.AppRoot
import rutacibao.android.navigation.LinkRequest
import rutacibao.android.platform.PushNotifications
import rutacibao.android.ui.LocalAppGraph
import rutacibao.android.ui.LocalRootOwner
import rutacibao.android.ui.RutaAppTheme
import rutacibao.data.AppTarget

class MainActivity : ComponentActivity() {
    private var pendingLink by mutableStateOf<LinkRequest?>(null)
    private var serial = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val graph = (application as RutaApplication).graph
        serial = savedInstanceState?.getLong("linkSerial") ?: 0L
        if (savedInstanceState == null) receive(intent) else savedInstanceState.getString("pendingHref")?.let(::open)
        val debugTab = if (BuildConfig.DEBUG) intent.getStringExtra("ruta_debug_tab") else null
        val debugCompose = if (BuildConfig.DEBUG) intent.getStringExtra("ruta_debug_compose") else null
        val debugSlug = if (BuildConfig.DEBUG) intent.getStringExtra("ruta_debug_slug") else null
        val debugStepUp = BuildConfig.DEBUG && intent.getStringExtra("ruta_debug_stepup") == "1"
        rutacibao.android.ui.UiPrefs.init(this)
        // Debug-only: `--es ruta_debug_tabbar fixed|floating` picks the bar for screenshot runs.
        if (BuildConfig.DEBUG) intent.getStringExtra("ruta_debug_tabbar")?.let { value ->
            rutacibao.android.ui.TabBarStyle.entries.firstOrNull { it.name.equals(value, ignoreCase = true) }?.let(rutacibao.android.ui.UiPrefs::chooseTabBarStyle)
        }
        setContent {
            val signedIn by graph.session.isSignedIn.collectAsStateWithLifecycle()
            val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
                PushNotifications.sync(application as RutaApplication)
            }
            LaunchedEffect(signedIn) {
                if (!signedIn) return@LaunchedEffect
                val prefs = getSharedPreferences("notification-permission", MODE_PRIVATE)
                if (Build.VERSION.SDK_INT >= 33 && PushNotifications.capability == PushNotifications.Capability.Available &&
                    !PushNotifications.permissionGranted(this@MainActivity) && !prefs.getBoolean("asked", false)) {
                    prefs.edit().putBoolean("asked", true).apply()
                    permission.launch(Manifest.permission.POST_NOTIFICATIONS)
                } else PushNotifications.sync(application as RutaApplication)
            }
            CompositionLocalProvider(LocalAppGraph provides graph, LocalRootOwner provides this) {
                RutaAppTheme {
                    AppRoot(debugTab, debugCompose, debugSlug, debugStepUp, pendingLink) { request ->
                        if (pendingLink?.id == request.id) pendingLink = null
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        receive(intent)
    }

    override fun onResume() {
        super.onResume()
        val app = application as RutaApplication
        lifecycleScope.launch { app.graph.offline.sync() }
        if (app.graph.session.isSignedIn.value) PushNotifications.sync(app)
        PushNotifications.refreshInbox()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        outState.putLong("linkSerial", serial)
        pendingLink?.let { outState.putString("pendingHref", it.href) }
        super.onSaveInstanceState(outState)
    }

    private fun receive(intent: Intent) {
        if (BuildConfig.DEBUG) intent.getStringExtra("ruta_debug_notification")?.let {
            PushNotifications.show(this, "synthetic-${++serial}", it)
        }
        val href = intent.dataString ?: intent.getStringExtra("href")
        if (href != null) open(href)
        if (intent.hasExtra("notificationId")) PushNotifications.refreshInbox()
    }

    private fun open(href: String) {
        val target = AppTarget.parse(href, BuildConfig.API_ORIGIN, BuildConfig.APP_SCHEME) ?: return
        pendingLink = LinkRequest(++serial, href, target)
    }
}
