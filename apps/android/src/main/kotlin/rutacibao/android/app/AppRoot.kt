package rutacibao.android.app

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.isImeVisible
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddCircle
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.outlined.AddCircleOutline
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Map
import androidx.compose.material.icons.outlined.PersonOutline
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.navigation3.rememberViewModelStoreNavEntryDecorator
import androidx.navigation3.runtime.NavBackStack
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.runtime.rememberSaveableStateHolderNavEntryDecorator
import androidx.navigation3.ui.NavDisplay
import kotlinx.serialization.Serializable
import rutacibao.android.BuildConfig
import rutacibao.android.R
import rutacibao.android.design.Ink
import rutacibao.android.design.LocalAppGraph
import rutacibao.android.design.Type
import rutacibao.android.design.floating
import rutacibao.android.design.pressable
import rutacibao.android.design.rootViewModel
import rutacibao.android.screens.AccountPage
import rutacibao.android.screens.AccountPageScreen
import rutacibao.android.screens.AccountScreen
import rutacibao.android.screens.ConsultationDetailScreen
import rutacibao.android.screens.ConsultationsScreen
import rutacibao.android.screens.ContributeAction
import rutacibao.android.screens.ContributionsScreen
import rutacibao.android.screens.GestionScreen
import rutacibao.android.screens.MapScreen
import rutacibao.android.screens.NewConsultationScreen
import rutacibao.android.screens.SuggestPlaceScreen
import rutacibao.android.screens.TrafficReportScreen
import rutacibao.data.AppTarget
import rutacibao.presentation.contributions.ContributionsViewModel

data class LinkRequest(val id: Long, val href: String, val target: AppTarget)

enum class Tab(val label: Int, val icon: ImageVector, val iconSelected: ImageVector, val root: NavKey) {
    Map(R.string.tabs_map, Icons.Outlined.Map, Icons.Filled.Map, Route.Home),
    Consultations(R.string.tabs_consultations, Icons.Outlined.ChatBubbleOutline, Icons.Filled.ChatBubble, Route.Consultations),
    Contributions(R.string.tabs_contributions, Icons.Outlined.AddCircleOutline, Icons.Filled.AddCircle, Route.Contributions),
    Account(R.string.tabs_account, Icons.Outlined.PersonOutline, Icons.Filled.Person, Route.Account),
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

/** Screens that own the bottom edge (forms, a thread's reply field): the tab bar steps aside. */
private fun NavKey?.ownsBottom() =
    this is Route.NewConsultation || this is Route.TrafficReport || this is Route.SuggestPlace || this is Route.Consultation

/** Space the floating bar takes above the system navigation, for lists that scroll under it. */
val LocalBarClearance = compositionLocalOf { 0.dp }

/** A screen can hide the bar itself (turn-by-turn on the map). */
class TabChrome { var hidden by mutableStateOf(false) }
val LocalTabChrome = compositionLocalOf { TabChrome() }

/**
 * The four places of the app, each with its own back stack, under one floating bar drawn by the
 * app. `debug*` are debug-build test hooks (intent extras read in MainActivity); null in release.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AppRoot(
    debugTab: String? = null,
    debugCompose: String? = null,
    debugSlug: String? = null,
    debugStepUp: Boolean = false,
    link: LinkRequest? = null,
    onLinkHandled: (LinkRequest) -> Unit = {},
) {
    val initial = when (debugTab) {
        "consultations" -> Tab.Consultations
        "contributions" -> Tab.Contributions
        "account", "gestion" -> Tab.Account
        else -> if (debugSlug != null) Tab.Consultations else Tab.Map
    }
    var selected by rememberSaveable { mutableStateOf(initial) }
    val stacks = Tab.entries.associateWith { rememberNavBackStack(it.root) }
    var mapPlace by rememberSaveable { mutableStateOf<String?>(null) }
    var mapRoute by rememberSaveable { mutableStateOf<String?>(null) }
    var mapTraffic by rememberSaveable { mutableStateOf<String?>(null) }
    var mapRequest by rememberSaveable { mutableStateOf(0L) }
    var inboxRequest by rememberSaveable { mutableStateOf(0L) }

    fun openTarget(target: AppTarget, requestId: Long) {
        when (target.kind) {
            "place", "route", "traffic" -> {
                mapPlace = target.ref.takeIf { target.kind == "place" }
                mapRoute = target.ref.takeIf { target.kind == "route" }
                mapTraffic = target.ref.takeIf { target.kind == "traffic" }
                mapRequest = requestId
                stacks.getValue(Tab.Map).popToRoot()
                selected = Tab.Map
            }
            "consultation" -> {
                selected = Tab.Consultations
                stacks.getValue(Tab.Consultations).add(Route.Consultation(target.ref!!))
            }
            "report" -> {
                selected = Tab.Account
                stacks.getValue(Tab.Account).add(Route.Gestion)
            }
            "contributions" -> {
                selected = Tab.Contributions
                stacks.getValue(Tab.Contributions).popToRoot()
                inboxRequest = requestId
            }
        }
    }

    LaunchedEffect(link?.id) {
        val request = link ?: return@LaunchedEffect
        openTarget(request.target, request.id)
        onLinkHandled(request)
    }
    LaunchedEffect(Unit) {
        if (debugTab == "gestion") stacks.getValue(Tab.Account).add(Route.Gestion)
        if (debugSlug != null) stacks.getValue(Tab.Consultations).add(Route.Consultation(debugSlug))
        val route: Route? = when (debugCompose) {
            "consultation" -> Route.NewConsultation
            "traffic" -> Route.TrafficReport
            "place" -> Route.SuggestPlace
            "offline" -> Route.AccountSub(AccountPage.Offline)
            else -> null
        }
        if (route != null) {
            val tab = if (route is Route.AccountSub) Tab.Account else Tab.Contributions
            selected = tab
            stacks.getValue(tab).add(route)
        }
    }

    val stack = stacks.getValue(selected)
    val graph = LocalAppGraph.current
    val contributions: ContributionsViewModel = rootViewModel("contributions") { graph.viewModels.contributions() }
    val chrome = androidx.compose.runtime.remember { TabChrome() }
    val barVisible = !stack.lastOrNull().ownsBottom() && !WindowInsets.isImeVisible && !chrome.hidden
    val navInset = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    val statusInset = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    val clearance = if (barVisible) BarHeight + 14.dp else 0.dp
    // The map runs edge to edge under the status bar; every other screen sits clear of both bars.
    val onMap = stack.lastOrNull() is Route.Home
    val padding = if (onMap) PaddingValues(0.dp) else PaddingValues(top = statusInset, bottom = navInset)

    // Leaving a tab's root from another tab goes back to the map before leaving the app.
    BackHandler(enabled = stack.size == 1 && selected != Tab.Map) { selected = Tab.Map }

    CompositionLocalProvider(LocalBarClearance provides clearance, LocalTabChrome provides chrome) {
        Box(Modifier.fillMaxSize().background(Ink.colors.paper)) {
            Box(Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding)) {
                fun push(route: Route) { stack.add(route) }
                fun pop() { stack.removeLastOrNull() }
                NavDisplay(
                    backStack = stack,
                    onBack = { stack.removeLastOrNull() },
                    entryDecorators = listOf(rememberSaveableStateHolderNavEntryDecorator(), rememberViewModelStoreNavEntryDecorator()),
                    entryProvider = entryProvider {
                        entry<Route.Home> { MapScreen(mapPlace, mapRoute, mapTraffic, mapRequest, startSearching = debugCompose == "search") }
                        entry<Route.Consultations> { ConsultationsScreen(onOpen = { push(Route.Consultation(it)) }, onCompose = { push(Route.NewConsultation) }) }
                        entry<Route.Contributions> {
                            ContributionsScreen(
                                onStart = {
                                    push(when (it) {
                                        ContributeAction.Consultation -> Route.NewConsultation
                                        ContributeAction.Traffic -> Route.TrafficReport
                                        ContributeAction.Place -> Route.SuggestPlace
                                    })
                                },
                                onOpenConsultation = { push(Route.Consultation(it)) },
                                startOnInbox = debugCompose == "inbox",
                                inboxRequest = inboxRequest,
                                onOpenHref = { href -> AppTarget.parse(href, BuildConfig.API_ORIGIN, BuildConfig.APP_SCHEME)?.let { openTarget(it, System.nanoTime()) } },
                            )
                        }
                        entry<Route.Account> {
                            AccountScreen(onOpen = { push(Route.AccountSub(it)) }, onOpenGestion = { push(Route.Gestion) }, onOpenPlace = { slug ->
                                AppTarget.parse("/lugares/$slug", BuildConfig.API_ORIGIN, BuildConfig.APP_SCHEME)?.let { openTarget(it, System.nanoTime()) }
                            })
                        }
                        entry<Route.Gestion> { GestionScreen(onBack = ::pop, onOpenConsultation = { push(Route.Consultation(it)) }) }
                        entry<Route.Consultation> { ConsultationDetailScreen(it.slug, onBack = ::pop) }
                        entry<Route.NewConsultation> {
                            NewConsultationScreen(onBack = ::pop, onOpened = { slug ->
                                contributions.refresh()
                                pop()
                                push(Route.Consultation(slug))
                            })
                        }
                        entry<Route.TrafficReport> { TrafficReportScreen(onBack = ::pop, onSent = contributions::refresh) }
                        entry<Route.SuggestPlace> { SuggestPlaceScreen(onBack = ::pop, onSent = contributions::refresh) }
                        entry<Route.AccountSub> { AccountPageScreen(it.page, onBack = ::pop, onOpenPlace = { slug ->
                            AppTarget.parse("/lugares/$slug", BuildConfig.API_ORIGIN, BuildConfig.APP_SCHEME)?.let { target -> openTarget(target, System.nanoTime()) }
                        }) }
                    },
                )
            }
            AnimatedVisibility(
                visible = barVisible,
                modifier = Modifier.align(Alignment.BottomCenter),
                enter = slideInVertically { it } + fadeIn(),
                exit = slideOutVertically { it } + fadeOut(),
            ) {
                TabBar(selected, Modifier.padding(bottom = navInset + 6.dp)) { tab ->
                    if (tab == selected) stacks.getValue(tab).popToRoot() else selected = tab
                }
            }
        }
    }
}

private val BarHeight = 64.dp

/** A floating capsule: icon over label, and a paper pill that slides to the current tab. */
@Composable
private fun TabBar(selected: Tab, modifier: Modifier = Modifier, onSelect: (Tab) -> Unit) {
    BoxWithConstraints(modifier.padding(horizontal = 24.dp).widthIn(max = 420.dp).fillMaxWidth().height(BarHeight).floating(CircleShape).padding(5.dp)) {
        val cell: Dp = maxWidth / Tab.entries.size
        val offset by animateDpAsState(cell * selected.ordinal, spring(dampingRatio = 0.8f, stiffness = Spring.StiffnessMediumLow), label = "pill")
        Box(Modifier.offset(x = offset).width(cell).height(54.dp).background(Ink.colors.paper2, CircleShape))
        Row(Modifier.fillMaxSize()) {
            Tab.entries.forEach { tab ->
                val on = tab == selected
                Column(
                    Modifier.weight(1f).height(54.dp).clip(CircleShape).pressable(scale = 0.94f, haptic = true, role = Role.Tab) { onSelect(tab) }.semantics { this.selected = on },
                    verticalArrangement = Arrangement.spacedBy(2.dp, Alignment.CenterVertically),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Icon(if (on) tab.iconSelected else tab.icon, null, Modifier.size(22.dp), tint = if (on) Ink.colors.ink else Ink.colors.ink3)
                    Text(stringResource(tab.label), style = Type.caption.copy(fontSize = 10.5.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Medium), color = if (on) Ink.colors.ink else Ink.colors.ink3, maxLines = 1)
                }
            }
        }
    }
}

private fun NavBackStack<NavKey>.popToRoot() {
    while (size > 1) removeAt(lastIndex)
}
