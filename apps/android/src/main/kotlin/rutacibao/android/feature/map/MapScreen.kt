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
import com.google.android.gms.maps.model.JointType
import com.google.android.gms.maps.model.LatLngBounds
import com.google.android.gms.maps.model.RoundCap
import com.google.maps.android.compose.Polyline
import androidx.compose.material.icons.filled.MyLocation
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

private val SheetPeek = 320.dp

/** The closest a tap takes you: a block or two, still readable. */
private const val ClosestSpan = 0.0045

/** The province on one screen: our places carry the map (POIs are off); glyph pins, thinned out far away, named close up. */
@Composable
fun MapScreen() {
    val screenName = stringResource(R.string.tabs_map)
    if (!mapsAvailable) {
        // No Maps key in this build (see gradle.properties): say so instead of drawing a broken map.
        MessageState(
            title = stringResource(R.string.common_error_title),
            body = stringResource(R.string.common_error_body),
            modifier = Modifier.semantics { paneTitle = screenName },
            icon = Icons.Filled.Map,
        )
        return
    }
    val graph = LocalAppGraph.current
    val vm: MapViewModel = viewModel { graph.viewModels.map() }
    val state by vm.state.collectAsStateWithLifecycle()
    MapContent(vm, state, Modifier.semantics { paneTitle = screenName })
    if (state.signInRequested) SignInDialog(onDismiss = vm::signInHandled)
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

    fun focus(place: MapPlace) {
        // Zoom in, never out: a third of the current span, no closer than a block or two. Aim a little south so the pin clears the sheet.
        val current = span.first
        val target = if (current <= ClosestSpan) current else maxOf(ClosestSpan, current / 3)
        val zoom = camera.position.zoom + (ln(current / target) / ln(2.0)).toFloat()
        fly(CameraUpdateFactory.newLatLngZoom(LatLng(place.latitude - target * 0.18, place.longitude), zoom))
    }

    // Once, when places first arrive: the densest town at street level, where pins show their glyphs.
    LaunchedEffect(state.all.isNotEmpty()) {
        if (framed || state.all.isEmpty()) return@LaunchedEffect
        framed = true
        val town = Clustering.cluster(state.all, 0.05, 0.05).maxByOrNull { it.count } ?: return@LaunchedEffect
        camera.move(CameraUpdateFactory.newLatLngZoom(LatLng(town.latitude, town.longitude), zoomForMeters(town.latitude, 3200.0, widthDp)))
    }
    LaunchedEffect(camera.isMoving, camera.position, camera.projection != null) {
        if (!camera.isMoving) {
            camera.projection?.visibleRegion?.latLngBounds?.let { b ->
                span = (b.northeast.latitude - b.southwest.latitude) to (b.northeast.longitude - b.southwest.longitude)
            }
        }
    }
    val selectedId = state.sheet?.place?.id
    val selectedRouteId = state.route?.id
    LaunchedEffect(selectedId, selectedRouteId) {
        if (selectedId != null) {
            state.all.firstOrNull { it.id == selectedId }?.let(::focus)
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

    val named = span.first < 0.035
    val selectedPlace = state.sheet?.place?.id
    // Google Maps style: one place per cell, more as you zoom; the selection always stays.
    val visible = remember(state.places, span, selectedPlace) {
        Clustering.declutter(state.places, span.first / 10, span.second / 6, selectedPlace)
    }

    val hasSheet = state.sheet != null || state.route != null

    BottomSheetScaffold(
        scaffoldState = scaffoldState,
        modifier = modifier,
        sheetPeekHeight = SheetPeek,
        sheetSwipeEnabled = hasSheet,
        containerColor = MaterialTheme.colorScheme.background,
        sheetContainerColor = MaterialTheme.colorScheme.surfaceContainer,
        sheetShadowElevation = 8.dp,
        sheetContent = {
            val sheet = state.sheet
            val route = state.route
            if (sheet != null) {
                PlaceSheet(sheet, onSave = vm::toggleSaved, onRequestClaim = vm::requestClaim, onBusinessChanged = vm::refreshBusiness, modifier = Modifier.fillMaxHeight())
            } else if (route != null) {
                RouteSheet(route, modifier = Modifier.fillMaxHeight())
            } else {
                Spacer(Modifier.height(1.dp))
            }
        },
    ) {
        Box(Modifier.fillMaxSize()) {
            GoogleMap(
                modifier = Modifier.fillMaxSize(),
                cameraPositionState = camera,
                properties = MapProperties(mapStyleOptions = calmMapStyle(dark)),
                uiSettings = MapUiSettings(
                    zoomControlsEnabled = false, myLocationButtonEnabled = false, mapToolbarEnabled = false,
                    tiltGesturesEnabled = false, compassEnabled = true,
                ),
                contentPadding = PaddingValues(top = 124.dp),
                onMapClick = { vm.dismissSheet(); vm.dismissRoute() },
            ) {
                visible.forEach { place ->
                    androidx.compose.runtime.key(place.id) {
                        PlaceMarker(place, named, selected = place.id == selectedId) { vm.select(place.id) }
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

            Column(Modifier.fillMaxWidth().padding(top = 4.dp)) {
                SearchPill { searching = true }
                CategoryChips(state.categories, state.selectedCategories, state.routes.isNotEmpty(), state.routesSelected, vm::toggleCategory, vm::toggleRoutes)
            }

            LocateButton(
                onClick = ::locate,
                modifier = Modifier.align(Alignment.BottomEnd).padding(end = 16.dp, bottom = if (hasSheet) SheetPeek + 16.dp else 16.dp),
            )

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
        modifier = Modifier.padding(horizontal = 16.dp).fillMaxWidth().height(48.dp).semantics { contentDescription = label },
        shape = CircleShape,
        color = MaterialTheme.colorScheme.surfaceContainer,
        shadowElevation = 4.dp,
        onClick = onClick,
    ) {
        Row(Modifier.padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(Icons.Filled.Search, contentDescription = null, tint = palette.textSecondary)
            Text(stringResource(R.string.map_search_placeholder), style = MaterialTheme.typography.bodyLarge, color = palette.textTertiary, maxLines = 1)
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
    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.semantics { contentDescription = description },
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

/** 36dp chip in a 48dp target. Selected = filled + a check, so never colour alone. */
@Composable
private fun MapChip(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, color: Color, isSelected: Boolean, onClick: () -> Unit) {
    val onColor = if (color.luminance() > 0.5f) Color.Black else Color.White
    Box(
        Modifier.height(48.dp).selectable(selected = isSelected, role = Role.RadioButton, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Surface(
            shape = CircleShape,
            color = if (isSelected) color else MaterialTheme.colorScheme.surfaceContainer,
            shadowElevation = 3.dp,
            border = if (isSelected) null else BorderStroke(0.5.dp, MaterialTheme.colorScheme.outlineVariant),
        ) {
            Row(
                Modifier.height(36.dp).padding(horizontal = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                if (isSelected) Icon(Icons.Filled.Check, contentDescription = null, Modifier.size(16.dp), tint = onColor)
                Icon(icon, contentDescription = null, Modifier.size(16.dp), tint = if (isSelected) onColor else color)
                Text(
                    label,
                    style = MaterialTheme.typography.labelLarge.copy(fontSize = 13.sp, fontWeight = FontWeight.SemiBold),
                    color = if (isSelected) onColor else MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                )
            }
        }
    }
}

@Composable
private fun LocateButton(onClick: () -> Unit, modifier: Modifier) {
    val label = stringResource(R.string.map_locate)
    Surface(
        onClick = onClick,
        modifier = modifier.size(52.dp).semantics { contentDescription = label },
        shape = CircleShape,
        color = MaterialTheme.colorScheme.surfaceContainer,
        shadowElevation = 4.dp,
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(Icons.Filled.MyLocation, contentDescription = null, tint = LocalPalette.current.locate)
        }
    }
}

// ------------------------------------------------------------------ markers

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
