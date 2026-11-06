package rutacibao.android.feature.map

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Hiking
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.layout.onSizeChanged
import com.google.android.gms.maps.model.JointType
import com.google.android.gms.maps.model.LatLngBounds
import com.google.android.gms.maps.model.RoundCap
import com.google.maps.android.compose.Polyline
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Public
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.runtime.SideEffect
import com.google.maps.android.compose.MapType
import rutacibao.android.navigation.LocalTabBarClearance
import rutacibao.android.navigation.LocalTabChrome
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.BottomSheetScaffold
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SheetValue
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberBottomSheetScaffoldState
import androidx.compose.material3.rememberStandardBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.MarkerComposable
import com.google.maps.android.compose.rememberCameraPositionState
import com.google.maps.android.compose.rememberUpdatedMarkerState
import kotlin.math.ln
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.launch
import rutacibao.android.BuildConfig
import rutacibao.android.R
import rutacibao.android.feature.auth.SignInDialog
import rutacibao.android.ui.ErrorState
import rutacibao.android.ui.LocalAppGraph
import rutacibao.android.ui.LocalPalette
import rutacibao.android.ui.LocalReducedMotion
import rutacibao.android.ui.LoadingState
import rutacibao.android.ui.MessageState
import rutacibao.android.ui.categoryIcon
import rutacibao.android.ui.parseCategoryColor
import rutacibao.data.MapPlace
import rutacibao.presentation.UiError
import rutacibao.presentation.map.Clustering
import rutacibao.presentation.map.MapCategory
import rutacibao.presentation.map.MapUiState
import rutacibao.presentation.map.MapViewModel
import rutacibao.presentation.map.TrafficNotice
import androidx.compose.runtime.DisposableEffect
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.semantics.clearAndSetSemantics

private val SheetPeek = 320.dp
private val SheetPeekWithPhoto = 500.dp

/** The closest a tap takes you: a block or two, still readable. */
private const val ClosestSpan = 0.0045

/** The province on one screen: our places carry the map (POIs are off); glyph pins, thinned out far away, named close up. */
@Composable
fun MapScreen(
    openPlaceSlug: String? = null,
    openRouteId: String? = null,
    openTrafficId: String? = null,
    openRequestId: Long = 0,
) {
    val screenName = stringResource(R.string.tabs_map)
    val graph = LocalAppGraph.current
    val vm: MapViewModel = viewModel { graph.viewModels.map() }
    val state by vm.state.collectAsStateWithLifecycle()
    var handledRequest by rememberSaveable { mutableStateOf<Long?>(null) }
    LaunchedEffect(openRequestId) {
        if (handledRequest == openRequestId) return@LaunchedEffect
        handledRequest = openRequestId
        when {
            openPlaceSlug != null -> vm.openPlace(openPlaceSlug)
            openRouteId != null -> vm.openRoute(openRouteId)
            openTrafficId != null -> vm.openTraffic(openTrafficId)
        }
    }
    if (mapsAvailable) {
        MapContent(vm, state, Modifier.semantics { paneTitle = screenName })
    } else {
        PlaceBrowser(vm, state, Modifier.semantics { paneTitle = screenName })
    }
    if (state.signInRequested) SignInDialog(onDismiss = vm::signInHandled)
    if (state.linkError != null) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = vm::linkErrorHandled,
            title = { Text(stringResource(R.string.common_error_title)) },
            text = { Text(stringResource(R.string.common_error_body)) },
            confirmButton = {
                androidx.compose.material3.TextButton(onClick = vm::linkErrorHandled) { Text(stringResource(R.string.common_close)) }
            },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MapContent(vm: MapViewModel, state: MapUiState, modifier: Modifier) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val reduced = LocalReducedMotion.current
    val dark = isSystemInDarkTheme()
    val widthDp = LocalConfiguration.current.screenWidthDp
    val density = LocalDensity.current

    val camera = rememberCameraPositionState { position = CameraPosition.fromLatLngZoom(ProvinceCenter, 10.2f) }
    var span by remember { mutableStateOf(0.46 to 0.50) }
    var framed by rememberSaveable { mutableStateOf(false) }
    var searching by rememberSaveable { mutableStateOf(false) }
    var me by remember { mutableStateOf<LatLng?>(null) }
    var satellite by rememberSaveable { mutableStateOf(false) }
    val clearance = LocalTabBarClearance.current
    val statusInset = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()

    val sheetState = rememberStandardBottomSheetState(initialValue = SheetValue.Hidden, skipHiddenState = false)
    val scaffoldState = rememberBottomSheetScaffoldState(sheetState)

    fun fly(update: com.google.android.gms.maps.CameraUpdate) {
        scope.launch { if (reduced) camera.move(update) else camera.animate(update, 500) }
    }

    /** Frame the whole line above the sheet: pad the south so the line sits in the upper half. */
    fun showRoute(route: EcoRoute) {
        vm.selectRoute(route.id)
        val lats = route.path.map { it.lat }
        val lngs = route.path.map { it.lng }
        if (lats.isEmpty()) return
        val latSpan = maxOf(0.006, lats.max() - lats.min())
        val lngSpan = maxOf(0.006, lngs.max() - lngs.min())
        val midLat = (lats.max() + lats.min()) / 2
        val midLng = (lngs.max() + lngs.min()) / 2
        val bounds = LatLngBounds(
            LatLng(midLat - latSpan * 1.1, midLng - lngSpan / 2),
            LatLng(midLat + latSpan / 2, midLng + lngSpan / 2),
        )
        fly(CameraUpdateFactory.newLatLngBounds(bounds, with(density) { 48.dp.roundToPx() }))
    }

    fun focus(latitude: Double, longitude: Double) {
        // Zoom in, never out: a third of the current span, no closer than a block or two. The map's content padding keeps the pin clear of the sheet.
        val current = span.first
        val target = if (current <= ClosestSpan) current else maxOf(ClosestSpan, current / 3)
        val zoom = camera.position.zoom + (ln(current / target) / ln(2.0)).toFloat()
        fly(CameraUpdateFactory.newLatLngZoom(LatLng(latitude, longitude), zoom))
    }

    fun focus(place: MapPlace) = focus(place.latitude, place.longitude)

    fun focus(notice: TrafficNotice) = focus(notice.latitude, notice.longitude)

    // Once, when places first arrive: the densest town at street level, where pins show their glyphs.
    LaunchedEffect(state.all.isNotEmpty()) {
        if (framed || state.all.isEmpty()) return@LaunchedEffect
        framed = true
        val town = Clustering.cluster(state.all, 0.05, 0.05).maxByOrNull { it.count } ?: return@LaunchedEffect
        camera.move(CameraUpdateFactory.newLatLngZoom(LatLng(town.latitude, town.longitude), zoomForMeters(town.latitude, 1500.0, widthDp)))
    }
    LaunchedEffect(camera.isMoving, camera.position, camera.projection != null) {
        if (!camera.isMoving) {
            camera.projection?.visibleRegion?.latLngBounds?.let { b ->
                span = (b.northeast.latitude - b.southwest.latitude) to (b.northeast.longitude - b.southwest.longitude)
                vm.onViewportChanged(b.southwest.longitude, b.southwest.latitude, b.northeast.longitude, b.northeast.latitude)
            }
        }
    }
    val selectedId = state.sheet?.place?.id
    val selectedRouteId = state.route?.id
    val selectedTraffic = state.selectedTraffic
    DisposableEffect(vm) {
        vm.setMapVisible(true)
        onDispose { vm.setMapVisible(false) }
    }
    if (BuildConfig.DEBUG) {
        // `am start --es ruta_debug_traffic select|still`: opens the first report that isn't yours, `still` also answers it.
        val hook = remember { (context as? android.app.Activity)?.intent?.getStringExtra("ruta_debug_traffic") }
        var done by remember { mutableStateOf(false) }
        LaunchedEffect(state.traffic.size) {
            val notice = state.traffic.firstOrNull { !it.isMine && it.myVerdict == null }
            if (hook == null || done || notice == null) return@LaunchedEffect
            done = true
            vm.selectTraffic(notice.id)
            if (hook == "still") {
                kotlinx.coroutines.delay(5000)
                vm.confirmTraffic(rutacibao.presentation.map.TrafficVerdict.Still)
            }
        }
    }
    LaunchedEffect(selectedId, selectedRouteId, selectedTraffic?.id) {
        if (selectedId != null) {
            state.all.firstOrNull { it.id == selectedId }?.let(::focus)
            sheetState.partialExpand()
        } else if (selectedTraffic != null) {
            focus(selectedTraffic)
            sheetState.partialExpand()
        } else if (selectedRouteId != null) {
            sheetState.partialExpand()
        } else {
            sheetState.hide()
        }
    }
    LaunchedEffect(sheetState) {
        snapshotFlow { sheetState.currentValue }.drop(1).collect {
            if (it == SheetValue.Hidden) {
                if (vm.state.value.sheet != null) vm.dismissSheet()
                if (vm.state.value.route != null) vm.dismissRoute()
                vm.dismissTraffic()
            }
        }
    }

    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        lastKnownLocation(context)?.let {
            val here = LatLng(it.latitude, it.longitude)
            me = here
            fly(CameraUpdateFactory.newLatLngZoom(here, 15f))
        }
    }
    fun locate() {
        if (hasLocationPermission(context)) {
            lastKnownLocation(context)?.let {
                val here = LatLng(it.latitude, it.longitude)
                me = here
                fly(CameraUpdateFactory.newLatLngZoom(here, 15f))
            }
        } else {
            permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
        }
    }

    val named = span.second < 0.035
    val selectedPlace = state.sheet?.place?.id
    // Google Maps style: one place per cell, more as you zoom; the selection always stays.
    val thresholdPx = with(density) { ClusterDistance.toPx() }
    val groups = remember(state.places, span, selectedPlace, camera.projection != null) {
        val projection = camera.projection
        if (projection == null) state.places.map { listOf(it) } else clusterPlaces(state.places, selectedPlace, thresholdPx) {
            projection.toScreenLocation(LatLng(it.latitude, it.longitude)).let { p -> p.x.toFloat() to p.y.toFloat() }
        }
    }

    val hasSheet = state.sheet != null || state.route != null || selectedTraffic != null
    val chrome = LocalTabChrome.current
    SideEffect { chrome.hidden = hasSheet }
    DisposableEffect(chrome) { onDispose { chrome.hidden = false } }

    // A place with a photo opens tall enough to show it, like the iOS medium detent.
    var trafficHeight by remember { mutableStateOf(0.dp) }
    val screenHeight = LocalConfiguration.current.screenHeightDp.dp
    val navInset = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    // Place: about 46% of the screen plus the gesture bar, so header, actions, hours and two description lines fit.
    val placePeek = maxOf(SheetPeek, screenHeight * 0.46f + navInset)
    val peek = if (selectedTraffic != null && trafficHeight > 0.dp) trafficHeight + 42.dp else if (state.sheet?.let { it.detail?.imageUrl ?: it.place.thumbnailUrl } != null) SheetPeekWithPhoto else placePeek
    var topChromeHeight by remember { mutableStateOf(0.dp) }
    // Controls ride above the sheet and step aside once it is more than half the screen.
    val controlsHidden = hasSheet && selectedTraffic == null && sheetState.targetValue == SheetValue.Expanded
    BottomSheetScaffold(
        scaffoldState = scaffoldState,
        modifier = modifier,
        sheetPeekHeight = peek,
        sheetSwipeEnabled = hasSheet,
        containerColor = MaterialTheme.colorScheme.background,
        sheetContainerColor = MaterialTheme.colorScheme.surfaceContainer,
        sheetShadowElevation = 8.dp,
        sheetContent = {
            val sheet = state.sheet
            val route = state.route
            if (sheet != null) {
                PlaceDetail(sheet, vm, Modifier.fillMaxHeight())
            } else if (route != null) {
                RouteSheet(route, modifier = Modifier.fillMaxHeight())
            } else if (selectedTraffic != null) {
                TrafficSheet(selectedTraffic, state.trafficError, onConfirm = vm::confirmTraffic, onClose = vm::dismissTraffic, modifier = Modifier.onSizeChanged { trafficHeight = with(density) { it.height.toDp() } })
            } else {
                Spacer(Modifier.height(1.dp))
            }
        },
    ) {
        Box(Modifier.fillMaxSize()) {
            GoogleMap(
                modifier = Modifier.fillMaxSize(),
                cameraPositionState = camera,
                properties = MapProperties(
                    mapType = if (satellite) MapType.HYBRID else MapType.NORMAL,
                    mapStyleOptions = if (satellite) null else calmMapStyle(dark),
                ),
                uiSettings = MapUiSettings(
                    zoomControlsEnabled = false, myLocationButtonEnabled = false, mapToolbarEnabled = false,
                    tiltGesturesEnabled = false, compassEnabled = true,
                ),
                contentPadding = PaddingValues(top = if (topChromeHeight > 0.dp) topChromeHeight else statusInset + 124.dp, bottom = if (hasSheet) peek else clearance),
                onMapClick = { vm.dismissSheet(); vm.dismissRoute(); vm.dismissTraffic() },
            ) {
                state.traffic.forEach { notice ->
                    if (notice.path.size > 1) {
                        androidx.compose.runtime.key("traffic-line:${notice.id}") {
                            Polyline(
                                points = notice.path.map { LatLng(it.latitude, it.longitude) },
                                color = notice.tint.copy(alpha = 0.85f),
                                width = with(density) { notice.lineWidthDp.dp.toPx() },
                                startCap = RoundCap(),
                                endCap = RoundCap(),
                                jointType = JointType.ROUND,
                                zIndex = 1f,
                            )
                        }
                    }
                }
                state.traffic.forEach { notice ->
                    androidx.compose.runtime.key("traffic:${notice.id}") {
                        val selected = notice.id == selectedTraffic?.id
                        MarkerComposable(
                            notice.id, notice.color, selected,
                            state = rememberUpdatedMarkerState(LatLng(notice.latitude, notice.longitude)),
                            anchor = Offset(0.5f, 0.5f),
                            zIndex = if (selected) 3.5f else 2f,
                            onClick = { vm.selectTraffic(notice.id); true },
                        ) { TrafficPin(notice, selected) }
                    }
                }
                groups.forEach { group ->
                    if (group.size == 1) {
                        val place = group.first()
                        androidx.compose.runtime.key(place.id) {
                            PlaceMarker(place, named, selected = place.id == selectedId) { vm.select(place.id) }
                        }
                    } else {
                        androidx.compose.runtime.key("cluster:" + group.joinToString(",") { it.id }) {
                            ClusterMarker(group) {
                                val lats = group.map { it.latitude }
                                val lngs = group.map { it.longitude }
                                val tiny = lats.max() - lats.min() < 0.0008 && lngs.max() - lngs.min() < 0.0008
                                fly(
                                    if (tiny) CameraUpdateFactory.newLatLngZoom(LatLng(lats.average(), lngs.average()), maxOf(camera.position.zoom + 1.5f, 17f))
                                    else CameraUpdateFactory.newLatLngBounds(LatLngBounds(LatLng(lats.min(), lngs.min()), LatLng(lats.max(), lngs.max())), with(density) { 64.dp.roundToPx() }),
                                )
                            }
                        }
                    }
                }
                val strokeSelected = with(density) { 6.dp.toPx() }
                val stroke = with(density) { 4.dp.toPx() }
                state.visibleRoutes.forEach { route ->
                    androidx.compose.runtime.key("line:${route.id}") {
                        val selected = route.id == selectedRouteId
                        Polyline(
                            points = route.path.map { LatLng(it.lat, it.lng) },
                            color = route.tint,
                            width = if (selected) strokeSelected else stroke,
                            startCap = RoundCap(),
                            endCap = RoundCap(),
                            jointType = JointType.ROUND,
                            zIndex = if (selected) 2f else 0f,
                        )
                    }
                }
                state.visibleRoutes.forEach { route ->
                    val start = route.path.firstOrNull() ?: return@forEach
                    androidx.compose.runtime.key("route:${route.id}") {
                        val selected = route.id == selectedRouteId
                        MarkerComposable(
                            route.id, selected,
                            state = rememberUpdatedMarkerState(LatLng(start.lat, start.lng)),
                            anchor = Offset(0.5f, 0.5f),
                            zIndex = if (selected) 3f else 1f,
                            onClick = { showRoute(route); true },
                        ) { RoutePin(route, selected) }
                    }
                }
                me?.let { UserDot(it) }
            }

            Column(
                Modifier.fillMaxWidth().onSizeChanged { topChromeHeight = with(density) { it.height.toDp() } + 8.dp }.statusBarsPadding().padding(top = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                SearchPill { searching = true }
                CategoryChips(state.categories, state.selectedCategories, state.routes.isNotEmpty(), state.routesSelected, vm::toggleCategory, vm::toggleRoutes)
            }

            if (!controlsHidden) {
                MapControls(
                    satellite = satellite,
                    onToggleSatellite = { satellite = !satellite },
                    onLocate = ::locate,
                    modifier = Modifier.align(Alignment.BottomEnd).padding(end = 16.dp, bottom = if (hasSheet) peek + 16.dp else clearance + 16.dp),
                )
            }

            when (state.phase) {
                MapUiState.Phase.Loading -> if (state.all.isEmpty()) LoadingState(Modifier.align(Alignment.Center))
                MapUiState.Phase.Failed -> Surface(
                    Modifier.align(Alignment.Center).padding(32.dp),
                    shape = RoundedCornerShape(24.dp),
                    color = MaterialTheme.colorScheme.surfaceContainer,
                    shadowElevation = 6.dp,
                ) {
                    ErrorState(state.error ?: UiError.Unknown, onRetry = vm::retry, modifier = Modifier.height(320.dp))
                }
                else -> Unit
            }
        }
    }

    if (searching) {
        PlaceSearch(
            places = state.all,
            routes = state.routes,
            categories = state.categories,
            municipalities = state.municipalities,
            onDismiss = { searching = false },
            onPickPlace = { place ->
                searching = false
                vm.select(place.id)
            },
            onPickRoute = { route ->
                searching = false
                showRoute(route)
            },
        )
    }
}

@Composable
private fun SearchPill(onClick: () -> Unit) {
    val palette = LocalPalette.current
    val label = stringResource(R.string.map_search_label)
    Surface(
        modifier = Modifier.padding(horizontal = 16.dp).fillMaxWidth().height(52.dp).semantics { contentDescription = label },
        shape = CircleShape,
        color = palette.glass,
        shadowElevation = 4.dp,
        border = BorderStroke(0.5.dp, MaterialTheme.colorScheme.outlineVariant),
        onClick = onClick,
    ) {
        Row(Modifier.padding(horizontal = 18.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(Icons.Filled.Search, contentDescription = null, tint = MaterialTheme.colorScheme.onSurface)
            Text(stringResource(R.string.map_search_placeholder), style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Normal), color = MaterialTheme.colorScheme.onSurface, maxLines = 1)
        }
    }
}

@Composable
private fun CategoryChips(
    categories: List<MapCategory>,
    selected: Set<String>,
    hasRoutes: Boolean,
    routesOnly: Boolean,
    onSelect: (String) -> Unit,
    onToggleRoutes: () -> Unit,
) {
    val description = stringResource(R.string.map_filter_places)
    val routesColor = Color(0xFF2F9E44)
    val listState = rememberLazyListState()
    val fadeWidth = with(LocalDensity.current) { 24.dp.toPx() }
    val canScroll = listState.canScrollForward
    LazyRow(
        state = listState,
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier
            .semantics { contentDescription = description }
            // Trailing 24dp fade: the row scrolls.
            .graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }
            .drawWithContent {
                drawContent()
                if (canScroll) {
                    drawRect(
                        Brush.horizontalGradient(listOf(Color.Black, Color.Transparent), startX = size.width - fadeWidth, endX = size.width),
                        blendMode = BlendMode.DstIn,
                    )
                }
            },
    ) {
        if (hasRoutes) {
            item(key = "routes") {
                MapChip(stringResource(R.string.map_routes), Icons.Filled.Hiking, routesColor, routesOnly, onToggleRoutes)
            }
        }
        items(categories, key = { it.id }) { category ->
            MapChip(
                category.name,
                categoryIcon(category.icon),
                parseCategoryColor(category.color, MaterialTheme.colorScheme.onSurface),
                category.id in selected,
            ) { onSelect(category.id) }
        }
    }
}

/** 40dp chip in a 48dp target. Selected = filled + a check, so never colour alone. */
@Composable
private fun MapChip(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, color: Color, isSelected: Boolean, onClick: () -> Unit) {
    val onColor = if (color.luminance() > 0.5f) Color.Black else Color.White
    Box(
        Modifier.height(48.dp).selectable(selected = isSelected, role = Role.RadioButton, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Surface(
            shape = CircleShape,
            color = if (isSelected) color else LocalPalette.current.glass,
            shadowElevation = 3.dp,
            border = if (isSelected) null else BorderStroke(0.5.dp, MaterialTheme.colorScheme.outlineVariant),
        ) {
            Row(
                Modifier.height(40.dp).padding(horizontal = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(7.dp),
            ) {
                Icon(icon, contentDescription = null, Modifier.size(18.dp), tint = if (isSelected) onColor else color)
                Text(
                    label,
                    style = MaterialTheme.typography.labelLarge.copy(fontSize = 15.sp, fontWeight = FontWeight.SemiBold),
                    color = if (isSelected) onColor else MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                )
            }
        }
    }
}

/**
 * One glass capsule with the icons stacked, as on iOS: the base-map toggle and "find me".
 * The toggle is a selected-state control, so it shows the state in its glyph and label, not colour.
 */
@Composable
private fun MapControls(satellite: Boolean, onToggleSatellite: () -> Unit, onLocate: () -> Unit, modifier: Modifier) {
    val palette = LocalPalette.current
    val layerLabel = stringResource(if (satellite) R.string.map_layers_standard else R.string.map_layers_satellite)
    val locateLabel = stringResource(R.string.map_locate)
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(30.dp),
        color = palette.glass,
        shadowElevation = 4.dp,
        border = BorderStroke(0.5.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(Modifier.padding(vertical = 4.dp)) {
            Box(
                Modifier.size(width = 52.dp, height = 52.dp).clickable(role = Role.Button, onClick = onToggleSatellite).semantics { contentDescription = layerLabel },
                contentAlignment = Alignment.Center,
            ) {
                Icon(if (satellite) Icons.Filled.Map else Icons.Filled.Public, contentDescription = null, tint = MaterialTheme.colorScheme.onSurface)
            }
            Box(
                Modifier.size(width = 52.dp, height = 52.dp).clickable(role = Role.Button, onClick = onLocate).semantics { contentDescription = locateLabel },
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Filled.MyLocation, contentDescription = null, tint = MaterialTheme.colorScheme.onSurface)
            }
        }
    }
}

// ------------------------------------------------------------------ markers

/** Places closer than this (bubble size, so bubbles never overlap) on screen collapse into one count bubble. */
private val ClusterDistance = 44.dp

/** Greedy screen-space grouping: the selection stays a single pin. Stable under panning (id order, not position). */
private fun clusterPlaces(places: List<MapPlace>, keep: String?, threshold: Float, project: (MapPlace) -> Pair<Float, Float>): List<List<MapPlace>> {
    val points = places.sortedBy { it.id }.map { it to project(it) }
    val taken = BooleanArray(points.size)
    val out = mutableListOf<List<MapPlace>>()
    for (i in points.indices) {
        if (taken[i]) continue
        taken[i] = true
        val (place, at) = points[i]
        if (place.id == keep) { out += listOf(place); continue }
        val group = mutableListOf(place)
        for (j in i + 1 until points.size) {
            if (taken[j] || points[j].first.id == keep) continue
            val dx = points[j].second.first - at.first
            val dy = points[j].second.second - at.second
            if (dx * dx + dy * dy < threshold * threshold) { taken[j] = true; group += points[j].first }
        }
        out += group
    }
    return out
}

/** A neutral count bubble, at least 44dp wide; tapping zooms to its places. */
@Composable
private fun ClusterMarker(group: List<MapPlace>, onClick: () -> Unit) {
    val centre = LatLng(group.map { it.latitude }.average(), group.map { it.longitude }.average())
    val label = pluralStringResource(R.plurals.map_places_count, group.size, group.size)
    val palette = LocalPalette.current
    MarkerComposable(
        group.size, palette.elevated,
        state = rememberUpdatedMarkerState(centre),
        anchor = Offset(0.5f, 0.5f),
        zIndex = 1.5f,
        onClick = { onClick(); true },
    ) {
        Box(
            Modifier.defaultMinSize(minWidth = 44.dp, minHeight = 44.dp).clip(CircleShape).background(palette.elevated)
                .border(1.5.dp, MaterialTheme.colorScheme.onSurface, CircleShape).padding(horizontal = 6.dp)
                .clearAndSetSemantics { contentDescription = label },
            Alignment.Center,
        ) {
            Text("${group.size}", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold), color = MaterialTheme.colorScheme.onSurface)
        }
    }
}

@Composable
private fun PlaceMarker(place: MapPlace, named: Boolean, selected: Boolean, onClick: () -> Unit) {
    val color = parseCategoryColor(place.color, Color(0xFF57554F))
    val icon = categoryIcon(place.icon)
    MarkerComposable(
        place.id, named, selected,
        state = rememberUpdatedMarkerState(LatLng(place.latitude, place.longitude)),
        anchor = Offset(0.5f, 0.5f),
        zIndex = if (selected) 3f else 1f,
        onClick = { onClick(); true },
    ) {
        if (named || selected) {
            // Symmetric spacer and label keep the glyph circle at the marker's centre.
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Spacer(Modifier.height(20.dp))
                PinGlyph(color, icon, selected)
                Box(Modifier.height(20.dp).widthIn(max = 120.dp), Alignment.Center) {
                    Text(
                        place.name,
                        style = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp),
                        color = Color(0xFF121211),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.clip(RoundedCornerShape(6.dp)).background(Color.White.copy(alpha = 0.88f)).padding(horizontal = 5.dp, vertical = 1.dp),
                    )
                }
            }
        } else {
            PinGlyph(color, icon, false)
        }
    }
}
