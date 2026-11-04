package rutacibao.android.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddBox
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.outlined.AddBox
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Map
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.viewmodel.navigation3.rememberViewModelStoreNavEntryDecorator
import androidx.navigation3.runtime.NavBackStack
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.runtime.rememberSaveableStateHolderNavEntryDecorator
import androidx.navigation3.ui.NavDisplay
import kotlinx.serialization.Serializable
import rutacibao.android.R
import rutacibao.android.feature.account.AccountPage
import rutacibao.android.feature.account.AccountPageScreen
import rutacibao.android.feature.account.AccountScreen
import rutacibao.android.feature.consultations.ConsultationDetailScreen
import rutacibao.android.feature.consultations.ConsultationsScreen
import rutacibao.android.feature.consultations.NewConsultationScreen
import rutacibao.android.feature.contribute.ContributeAction
import rutacibao.android.feature.contribute.ContributionsScreen
import rutacibao.android.feature.contribute.SuggestPlaceScreen
import rutacibao.android.feature.contribute.TrafficReportScreen
import rutacibao.android.feature.gestion.GestionScreen
import rutacibao.android.feature.map.MapScreen
import rutacibao.android.ui.LocalAppGraph
import rutacibao.android.ui.rootViewModel
import rutacibao.presentation.contributions.ContributionsViewModel

/** Top-level destinations, in the same order as the iOS tab bar. Icon and label are always shown. */
enum class Tab(val label: Int, val icon: ImageVector, val iconSelected: ImageVector, val root: NavKey) {
    Map(R.string.tabs_map, Icons.Outlined.Map, Icons.Filled.Map, Route.Home),
    Consultations(R.string.tabs_consultations, Icons.Outlined.ChatBubbleOutline, Icons.Filled.ChatBubble, Route.Consultations),
    Contributions(R.string.tabs_contributions, Icons.Outlined.AddBox, Icons.Filled.AddBox, Route.Contributions),
    Account(R.string.tabs_account, Icons.Outlined.Person, Icons.Filled.Person, Route.Account),
}

/** Navigation 3 keys. Saveable, so each tab's stack survives process death. */
sealed interface Route : NavKey {
    @Serializable data object Home : Route
    @Serializable data object Consultations : Route
    @Serializable data object Contributions : Route
    @Serializable data object Account : Route
    @Serializable data class Consultation(val slug: String) : Route
    @Serializable data object NewConsultation : Route
    @Serializable data object TrafficReport : Route
    @Serializable data object SuggestPlace : Route
    @Serializable data class AccountSub(val page: AccountPage) : Route
    @Serializable data object Gestion : Route
}

/** Screens with their own bottom bar: the tab bar steps aside. */
private fun NavKey?.isForm() = this is Route.NewConsultation || this is Route.TrafficReport || this is Route.SuggestPlace

/**
 * `debugTab` / `debugCompose` are debug-build test hooks (intent extras read in MainActivity);
 * they are null in release.
 */
@Composable
fun AppRoot(
    debugTab: String? = null,
    debugCompose: String? = null,
    debugSlug: String? = null,
    debugStepUp: Boolean = false,
) {
    val initial = when (debugTab) {
        "consultations" -> Tab.Consultations
        "contributions" -> Tab.Contributions
        "account", "gestion" -> Tab.Account
        else -> if (debugSlug != null) Tab.Consultations else Tab.Map
    }
    var selected by rememberSaveable { mutableStateOf(initial) }
    // One back stack per tab, so switching tabs keeps each tab's place.
    val stacks = Tab.entries.associateWith { rememberNavBackStack(it.root) }

    LaunchedEffect(debugTab, debugSlug) {
        when {
            debugTab == "gestion" -> stacks.getValue(Tab.Account).add(Route.Gestion)
            debugSlug != null -> stacks.getValue(Tab.Consultations).add(Route.Consultation(debugSlug))
        }
    }

    LaunchedEffect(debugCompose) {
        val route: Route = when (debugCompose) {
            "consultation" -> Route.NewConsultation
            "traffic" -> Route.TrafficReport
            "place" -> Route.SuggestPlace
            else -> return@LaunchedEffect
        }
        selected = Tab.Contributions
        stacks.getValue(Tab.Contributions).add(route)
    }

    val stack = stacks.getValue(selected)
    val showBar = !stack.lastOrNull().isForm()
    val graph = LocalAppGraph.current
    val contributions: ContributionsViewModel = rootViewModel("contributions") { graph.viewModels.contributions() }

    Scaffold(
        bottomBar = {
            if (showBar) {
                NavigationBar {
                    Tab.entries.forEach { tab ->
                        val label = stringResource(tab.label)
                        NavigationBarItem(
                            selected = tab == selected,
                            onClick = {
                                if (tab == selected) stacks.getValue(tab).popToRoot() else selected = tab
                            },
                            icon = { Icon(if (tab == selected) tab.iconSelected else tab.icon, contentDescription = null) },
                            label = { Text(label, fontWeight = if (tab == selected) FontWeight.SemiBold else FontWeight.Normal) },
                            alwaysShowLabel = true,
                            colors = NavigationBarItemDefaults.colors(
                                indicatorColor = Color.Transparent,
                                selectedIconColor = MaterialTheme.colorScheme.onSurface,
                                selectedTextColor = MaterialTheme.colorScheme.onSurface,
                                unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
                            ),
                        )
                    }
                }
            }
        },
    ) { padding ->
        Box(Modifier.padding(padding).consumeWindowInsets(padding)) {
            fun push(route: Route) { stack.add(route) }
            fun pop() { stack.removeLastOrNull() }
            NavDisplay(
                backStack = stack,
                onBack = { stack.removeLastOrNull() },
                entryDecorators = listOf(
                    rememberSaveableStateHolderNavEntryDecorator(),
                    rememberViewModelStoreNavEntryDecorator(),
                ),
                entryProvider = entryProvider {
                    entry<Route.Home> { MapScreen() }
                    entry<Route.Consultations> { ConsultationsScreen(onOpen = { push(Route.Consultation(it)) }) }
                    entry<Route.Contributions> {
                        ContributionsScreen(
                            onStart = {
                                push(
                                    when (it) {
                                        ContributeAction.Consultation -> Route.NewConsultation
                                        ContributeAction.Traffic -> Route.TrafficReport
                                        ContributeAction.Place -> Route.SuggestPlace
                                    },
                                )
                            },
                            onOpenConsultation = { push(Route.Consultation(it)) },
                        )
                    }
                    entry<Route.Account> { AccountScreen(onOpen = { push(Route.AccountSub(it)) }, onOpenGestion = { push(Route.Gestion) }) }
                    entry<Route.Gestion> { GestionScreen(onBack = ::pop, debugStepUp = debugStepUp) }
                    entry<Route.Consultation> { ConsultationDetailScreen(it.slug, onBack = ::pop) }
                    entry<Route.NewConsultation> {
                        NewConsultationScreen(
                            onBack = ::pop,
                            onOpened = { slug ->
                                contributions.refresh()
                                pop()
                                push(Route.Consultation(slug))
                            },
                        )
                    }
                    entry<Route.TrafficReport> { TrafficReportScreen(onBack = ::pop, onSent = contributions::refresh) }
                    entry<Route.SuggestPlace> { SuggestPlaceScreen(onBack = ::pop, onSent = contributions::refresh) }
                    entry<Route.AccountSub> { AccountPageScreen(it.page, onBack = ::pop) }
                },
            )
        }
    }
}

private fun NavBackStack<NavKey>.popToRoot() {
    while (size > 1) removeAt(lastIndex)
}
