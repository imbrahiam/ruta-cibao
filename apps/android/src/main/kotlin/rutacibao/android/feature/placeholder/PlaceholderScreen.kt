package rutacibao.android.feature.placeholder

import androidx.compose.runtime.Composable
import rutacibao.android.ui.MessageState

/** Stand-in for a tab not migrated yet (see docs/NATIVE.md parity checklist). */
@Composable
fun PlaceholderScreen(title: String) {
    MessageState(title = title, body = null)
}
