package rutacibao.android.ui

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.RowScope
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.viewmodel.compose.viewModel
import rutacibao.android.R

/**
 * The activity's store: view models that several pushed screens share
 * (account and its sub-screens, the contributions list a form refreshes).
 */
val LocalRootOwner = staticCompositionLocalOf<ViewModelStoreOwner> { error("Root owner not provided") }

@Composable
inline fun <reified VM : ViewModel> rootViewModel(key: String, noinline create: () -> VM): VM =
    viewModel(viewModelStoreOwner = LocalRootOwner.current, key = key, initializer = { create() })

/** Chrome for a pushed screen: back arrow, optional title, trailing actions. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PushedScreen(
    title: String?,
    onBack: () -> Unit,
    actions: @Composable RowScope.() -> Unit = {},
    bottomBar: @Composable () -> Unit = {},
    content: @Composable (PaddingValues) -> Unit,
) {
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { if (title != null) Text(title, maxLines = 1) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.common_back))
                    }
                },
                actions = actions,
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
        bottomBar = bottomBar,
        content = content,
    )
}
