package rutacibao.android.ui

import android.content.Context
import android.content.SharedPreferences
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

/**
 * Which bottom bar the person chose in Cuenta › Apariencia: the floating capsule with labels
 * (the default, as on iOS 26), or X's bar fixed to the bottom edge, icons only.
 */
enum class TabBarStyle { Floating, Fixed }

/** Display choices kept on this phone. Observable, so the bar swaps as soon as it changes. */
object UiPrefs {
    private const val KEY_TAB_BAR = "tabBarStyle"
    private var prefs: SharedPreferences? = null

    var tabBarStyle by mutableStateOf(TabBarStyle.Floating)
        private set

    fun init(context: Context) {
        val store = context.getSharedPreferences("ruta.ui", Context.MODE_PRIVATE)
        prefs = store
        tabBarStyle = store.getString(KEY_TAB_BAR, null)
            ?.let { saved -> TabBarStyle.entries.firstOrNull { it.name == saved } }
            ?: TabBarStyle.Floating
    }

    fun chooseTabBarStyle(style: TabBarStyle) {
        tabBarStyle = style
        prefs?.edit()?.putString(KEY_TAB_BAR, style.name)?.apply()
    }
}
