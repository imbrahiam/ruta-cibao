package rutacibao.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.CompositionLocalProvider
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import rutacibao.android.navigation.AppRoot
import rutacibao.android.ui.LocalAppGraph
import rutacibao.android.ui.LocalRootOwner
import rutacibao.android.ui.RutaAppTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val graph = (application as RutaApplication).graph
        // Debug-only screenshot hooks: `am start --es ruta_debug_tab map|consultations|contributions|account`
        // and `--es ruta_debug_compose consultation|traffic|place`. Compiled to nulls in release.
        val debugTab = if (BuildConfig.DEBUG) intent.getStringExtra("ruta_debug_tab") else null
        val debugCompose = if (BuildConfig.DEBUG) intent.getStringExtra("ruta_debug_compose") else null
        setContent {
            CompositionLocalProvider(LocalAppGraph provides graph) {
                CompositionLocalProvider(LocalRootOwner provides this) {
                    RutaAppTheme { AppRoot(debugTab = debugTab, debugCompose = debugCompose) }
                }
            }
        }
    }
}
