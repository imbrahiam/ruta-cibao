package rutacibao.android.screens

import android.Manifest
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.DirectionsWalk
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import androidx.compose.material.icons.outlined.Flag
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapType
import com.google.maps.android.compose.MapUiSettings
import com.google.android.gms.maps.model.BitmapDescriptor
import com.google.android.gms.maps.model.BitmapDescriptorFactory
import com.google.maps.android.compose.Marker
import com.google.maps.android.compose.Polyline
import com.google.maps.android.compose.rememberCameraPositionState
import com.google.maps.android.compose.rememberUpdatedMarkerState
import kotlinx.coroutines.launch
import rutacibao.android.R
import rutacibao.android.app.LocalBarClearance
import rutacibao.android.design.*
import com.google.android.gms.maps.model.Dash
import com.google.android.gms.maps.model.Gap
import com.google.android.gms.maps.model.JointType
import com.google.android.gms.maps.model.RoundCap
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.semantics.contentDescription
import rutacibao.android.platform.calmMapStyle
import rutacibao.android.platform.hasLocationPermission
import rutacibao.android.platform.lastKnownLocation
import rutacibao.android.platform.mapsAvailable
import rutacibao.android.platform.relativeTimeText
import rutacibao.api.generated.PlacesConfirmInput
import rutacibao.api.generated.PlacesDetailOutput
import rutacibao.api.generated.PlacesReportInput
import rutacibao.api.generated.RoutesBrowseOutput
import rutacibao.data.MapPlace
import rutacibao.presentation.UiError
import rutacibao.presentation.business.BusinessState
import rutacibao.presentation.map.Clustering
import rutacibao.presentation.map.MapSelection
import rutacibao.presentation.map.MapUiState
import rutacibao.presentation.map.MapViewModel
import rutacibao.presentation.map.PlaceReportState
import rutacibao.presentation.map.PlaceSheet
import rutacibao.presentation.map.TrafficNotice
import rutacibao.presentation.map.TrafficSeverity
import rutacibao.presentation.map.TrafficVerdict

private val TownCentre = LatLng(19.4757, -71.3418)
private fun MapPlace.tint() = Tint.of(color).solid

/** The province on one map: places, eco routes and what is happening on the road. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MapScreen(openPlace: String?, openRoute: String?, openTraffic: String?, request: Long, startSearching: Boolean = false) {
    val graph = LocalAppGraph.current
    val vm: MapViewModel = viewModel { graph.viewModels.map() }
    val state by vm.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val dark = isSystemInDarkTheme()
    val density = androidx.compose.ui.platform.LocalDensity.current.density
    val p = Ink.colors
    // The header's height on screen: the map keeps its centre and Google's logo clear of it.
    var headerHeight by remember { mutableStateOf(0) }
    // The map in relief (tilted, with buildings), remembered between launches.
    val prefs = remember { context.getSharedPreferences("map", android.content.Context.MODE_PRIVATE) }
    var threeD by remember { mutableStateOf(prefs.getBoolean("threeD", false)) }
    var searching by rememberSaveable { mutableStateOf(startSearching) }
    var me by remember { mutableStateOf<LatLng?>(null) }
    var handled by rememberSaveable { mutableStateOf(0L) }
    val camera = rememberCameraPositionState {
        val start = lastKnownLocation(context)?.let { LatLng(it.latitude, it.longitude) }
        position = CameraPosition.fromLatLngZoom(start ?: TownCentre, 14.6f)
    }
    val fly: (com.google.android.gms.maps.CameraUpdate) -> Unit = { update -> scope.launch { runCatching { camera.animate(update, 500) } } }
    LaunchedEffect(threeD) {
        prefs.edit().putBoolean("threeD", threeD).apply()
        val now = camera.position
        runCatching { camera.animate(CameraUpdateFactory.newCameraPosition(CameraPosition(now.target, now.zoom, if (threeD) 55f else 0f, now.bearing)), 500) }
    }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { granted ->
        if (granted.values.any { it }) lastKnownLocation(context)?.let { me = LatLng(it.latitude, it.longitude); fly(CameraUpdateFactory.newLatLngZoom(me!!, 15f)) }
    }

    LaunchedEffect(request) {
        if (request == handled) return@LaunchedEffect
        handled = request
        when {
            openPlace != null -> vm.openPlace(openPlace)
            openRoute != null -> vm.openRoute(openRoute)
            openTraffic != null -> vm.openTraffic(openTraffic)
        }
    }
    DisposableEffect(Unit) { vm.setMapVisible(true); onDispose { vm.setMapVisible(false) } }
    // Also once the map is ready: the first view never "stops moving", so without this its road
    // notices would wait for the first pan.
    LaunchedEffect(camera.isMoving, camera.projection != null) {
        if (camera.isMoving) return@LaunchedEffect
        camera.projection?.visibleRegion?.latLngBounds?.let { b -> vm.onViewportChanged(b.southwest.longitude, b.southwest.latitude, b.northeast.longitude, b.northeast.latitude) }
    }
    // Bring what was picked into the upper half, above its sheet.
    val selection = state.selection
    val screen = androidx.compose.ui.platform.LocalWindowInfo.current.containerSize
    // Keyed on the map being ready too: picked from search, the map is not on screen yet and a
    // move asked for then is lost.
    LaunchedEffect((selection as? MapSelection.Place)?.sheet?.place?.id, (selection as? MapSelection.Route)?.route?.id, (selection as? MapSelection.Traffic)?.id, camera.projection != null) {
        when (selection) {
            is MapSelection.Place -> selection.sheet.place.let { fly(CameraUpdateFactory.newLatLngZoom(LatLng(it.latitude - 0.0022, it.longitude), 16f)) }
            is MapSelection.Traffic -> state.selectedTraffic?.let { fly(CameraUpdateFactory.newLatLngZoom(LatLng(it.latitude - 0.0022, it.longitude), 16f)) }
            is MapSelection.Route -> selection.route.path.takeIf { it.isNotEmpty() }?.let { path ->
                val bounds = LatLngBounds.builder().apply { path.forEach { include(LatLng(it.lat, it.lng)) } }.build()
                // Fit the trail into the upper half, above the route's sheet: sized for half the
                // screen, then moved up by a quarter of it.
                runCatching {
                    camera.animate(CameraUpdateFactory.newLatLngBounds(bounds, screen.width, screen.height / 2, 120), 450)
                    camera.animate(CameraUpdateFactory.scrollBy(0f, screen.height / 4f), 250)
                }
            }
            else -> Unit
        }
    }

    // Pins that would sit on top of each other give way until the zoom separates them.
    val zoom = camera.position.zoom
    val places = remember(state.places, zoom, state.sheet?.place?.id) {
        val cell = 0.0045 * Math.pow(2.0, (14.5 - zoom).toDouble())
        Clustering.declutter(state.places, cell, cell, state.sheet?.place?.id)
    }

    Box(Modifier.fillMaxSize().background(p.paper2)) {
        if (mapsAvailable) {
            GoogleMap(
                modifier = Modifier.fillMaxSize(),
                cameraPositionState = camera,
                properties = MapProperties(mapStyleOptions = calmMapStyle(dark), mapType = MapType.NORMAL, isMyLocationEnabled = hasLocationPermission(context), isBuildingEnabled = threeD),
                uiSettings = MapUiSettings(zoomControlsEnabled = false, myLocationButtonEnabled = false, mapToolbarEnabled = false, tiltGesturesEnabled = threeD, compassEnabled = false),
                contentPadding = PaddingValues(top = with(androidx.compose.ui.platform.LocalDensity.current) { headerHeight.toDp() }),
                onMapClick = { vm.dismissSheet(); vm.dismissRoute(); vm.dismissTraffic() },
            ) {
                state.visibleRoutes.forEach { route ->
                    val on = state.route?.id == route.id
                    Polyline(points = route.path.map { LatLng(it.lat, it.lng) }, color = p.success, width = if (on) 16f else 10f, clickable = true, onClick = { vm.selectRoute(route.id) })
                    // Open, the route's own start flag takes the place of its walker pin.
                    if (!on) route.path.firstOrNull()?.let { start ->
                        GlyphPin(LatLng(start.lat, start.lng), route.id, Icons.AutoMirrored.Outlined.DirectionsWalk, Tint.Trail.solid, on, dimmed = false, zIndex = 2f) { vm.selectRoute(route.id) }
                    }
                }
                // A notice is drawn on its stretch of road: in the hazard's colour on a white edge, or
                // as a red and white barrier when closed. Its marker stands at the stretch's middle, and
                // a closed road gets a smaller one at either end.
                state.traffic.forEach { notice ->
                    val sign = TrafficSignKind.of(notice.categoryName, notice.icon)
                    val on = state.selectedTraffic?.id == notice.id
                    // With something else in hand, notices shrink and fade so its own markers read first.
                    val aside = !on && selection !is MapSelection.None
                    val points = notice.path.map { LatLng(it.latitude, it.longitude) }
                    if (points.size > 1) {
                        if (sign.striped) {
                            Polyline(points = points, color = Color(0xD92B2B2E), width = 27f, zIndex = 3f, jointType = JointType.ROUND)
                            Polyline(points = points, color = Color.White, width = 20f, zIndex = 3.1f, jointType = JointType.ROUND)
                            Polyline(points = points, color = sign.line, width = 20f, zIndex = 3.2f, jointType = JointType.ROUND, pattern = listOf(Dash(26f), Gap(26f)))
                        } else {
                            Polyline(points = points, color = Color.White, width = 30f, zIndex = 3f, startCap = RoundCap(), endCap = RoundCap(), jointType = JointType.ROUND)
                            Polyline(points = points, color = sign.line, width = 20f, zIndex = 3.1f, startCap = RoundCap(), endCap = RoundCap(), jointType = JointType.ROUND)
                        }
                    }
                    val middle = points.getOrNull(points.size / 2) ?: LatLng(notice.latitude, notice.longitude)
                    val ends = if (sign.striped && points.size > 2 && camera.position.zoom >= 15.5f) listOf("s" to points.first(), "e" to points.last()) else emptyList()
                    (listOf("" to middle) + ends).forEach { (end, at) ->
                        androidx.compose.runtime.key("t" + notice.id + end) {
                            com.google.maps.android.compose.MarkerComposable(
                                keys = arrayOf<Any>("t" + notice.id + end, on, aside), state = rememberUpdatedMarkerState(at), anchor = androidx.compose.ui.geometry.Offset(0.5f, 1f),
                                zIndex = if (end.isEmpty()) 4.1f else 4f, onClick = { vm.selectTraffic(notice.id); true },
                            ) {
                                Box(Modifier.alpha(if (aside) 0.45f else 1f)) { TrafficMarker(sign, selected = on && end.isEmpty(), small = end.isNotEmpty() || aside) }
                            }
                        }
                    }
                }
                // A route in hand shows its stops in order; the places it passes give way to them.
                val route = (selection as? MapSelection.Route)?.route
                val stops = route?.let { trailStops(it, state.all, stringResource(R.string.routes_start), stringResource(R.string.routes_end)) }.orEmpty()
                val onRoute = stops.mapNotNull { it.place?.id }.toSet()
                stops.forEachIndexed { index, stop ->
                    androidx.compose.runtime.key("s" + stop.id) {
                        com.google.maps.android.compose.MarkerComposable(
                            keys = arrayOf<Any>(stop.id, index), state = rememberUpdatedMarkerState(LatLng(stop.lat, stop.lng)), anchor = androidx.compose.ui.geometry.Offset(0.5f, 0.5f), zIndex = 6f,
                            onClick = { stop.place?.let { vm.select(it.id) }; true },
                        ) { StopDisc(index, stop) }
                    }
                }
                val picked = state.sheet?.place?.id
                places.filter { it.id !in onRoute }.forEach { place ->
                    val on = picked == place.id
                    // With one in hand, the others step back so it reads first.
                    GlyphPin(LatLng(place.latitude, place.longitude), "p" + place.id, categoryIcon(place.icon), place.tint(), on, dimmed = picked != null && !on, zIndex = if (on) 5f else 1f) { vm.select(place.id) }
                }
            }
        } else {
            StateView(stringResource(R.string.map_basemap_unavailable), Modifier.align(Alignment.Center), icon = Icons.Outlined.Map, message = stringResource(R.string.map_basemap_unavailable_body))
        }

        // The header: search and adding on one row, the kinds to filter by under it, on the green.
        BrandHeader(Modifier.onSizeChanged { headerHeight = it.height }) {
            Row(Modifier.padding(horizontal = Metrics.gutter), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                val searchLabel = stringResource(R.string.map_search_label)
                Row(
                    Modifier.weight(1f).height(48.dp).background(p.paper, CircleShape).clip(CircleShape).pressable(scale = 0.98f) { searching = true }
                        .semantics { contentDescription = searchLabel }.padding(start = 18.dp, end = 5.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(stringResource(R.string.map_search_placeholder), style = Type.body, color = p.ink3, maxLines = 1, modifier = Modifier.weight(1f))
                    Box(Modifier.size(38.dp).background(p.brand, CircleShape), Alignment.Center) { Icon(Icons.Outlined.Search, null, Modifier.size(18.dp), tint = Color.White) }
                }
                ContributeButton()
            }
            // With something in hand the filters step aside and give the map their room.
            if (selection is MapSelection.None) HeaderFilters {
                if (state.filtering) {
                    Box(Modifier.size(44.dp).clip(CircleShape).pressable(onClick = vm::clearFilters), Alignment.Center) {
                        Box(Modifier.size(34.dp).background(Color.White, CircleShape), Alignment.Center) {
                            Icon(Icons.Outlined.Close, stringResource(R.string.map_clear_filters), Modifier.size(15.dp), tint = p.brandDeep)
                        }
                    }
                }
                if (state.routes.isNotEmpty()) Chip(stringResource(R.string.map_routes), state.routesSelected, vm::toggleRoutes, icon = Icons.AutoMirrored.Outlined.DirectionsWalk, onBrand = true)
                state.categories.forEach { category ->
                    Chip(category.name, category.id in state.selectedCategories, { vm.toggleCategory(category.id) }, icon = categoryIcon(category.icon), onBrand = true)
                }
            }
        }

        Column(Modifier.align(Alignment.BottomEnd).padding(end = 16.dp, bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            // Flat or in relief: the label says what a tap switches to.
            IconDisc(if (threeD) Icons.Outlined.Map else Icons.Outlined.ViewInAr, stringResource(if (threeD) R.string.map_view2d else R.string.map_view3d), { threeD = !threeD }, floating = true)
            IconDisc(Icons.Outlined.NearMe, stringResource(R.string.map_locate), {
                if (hasLocationPermission(context)) lastKnownLocation(context)?.let { fly(CameraUpdateFactory.newLatLngZoom(LatLng(it.latitude, it.longitude), 15f)) }
                else permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
            }, floating = true)
        }

        if (state.phase == MapUiState.Phase.Failed) {
            ErrorView(state.error ?: UiError.Unknown, Modifier.align(Alignment.Center).padding(32.dp).floating(RoundedCornerShape(Metrics.radiusPanel)), vm::retry)
        }
    }

    if (selection !is MapSelection.None && !searching) {
        ModalBottomSheet(
            onDismissRequest = { vm.dismissSheet(); vm.dismissRoute(); vm.dismissTraffic() },
            sheetState = rememberModalBottomSheetState(),
            containerColor = p.paper, scrimColor = Color.Transparent,
            shape = RoundedCornerShape(topStart = Metrics.radiusPanel, topEnd = Metrics.radiusPanel),
        ) {
            Column(Modifier.verticalScroll(rememberScrollState()).navigationBarsPadding().padding(horizontal = Metrics.gutter).padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                when (selection) {
                    is MapSelection.Place -> PlacePanel(selection.sheet, vm)
                    is MapSelection.Route -> RoutePanel(
                        selection.route, trailStops(selection.route, state.all, stringResource(R.string.routes_start), stringResource(R.string.routes_end)),
                        vm::dismissRoute, onPlace = { vm.select(it) },
                    )
                    is MapSelection.Traffic -> state.selectedTraffic?.let { TrafficPanel(it, vm) }
                    else -> Unit
                }
            }
        }
    }
    val contribute = LocalContribute.current
    if (searching) MapSearch(
        state, onDismiss = { searching = false }, onPlace = { searching = false; vm.select(it.id) }, onRoute = { searching = false; vm.selectRoute(it.id) },
        onCategory = { id -> searching = false; vm.clearFilters(); vm.toggleCategory(id) },
        onRoutes = { searching = false; vm.clearFilters(); vm.toggleRoutes() },
        onSuggest = { searching = false; contribute() },
    )
    if (state.signInRequested) SignInDialog(onDismiss = vm::signInHandled)
}

private val pinCache = HashMap<Long, BitmapDescriptor>()

/**
 * Google's marker shape (a drop with a light centre), painted in the palette's colour: the stock
 * one only takes a hue at full saturation, which fights the rest of the app.
 */
private fun googlePin(color: Color, density: Float, large: Boolean = false): BitmapDescriptor {
    val key = color.toArgb().toLong() * 2 + if (large) 1 else 0
    return pinCache.getOrPut(key) {
        val w = (if (large) 36f else 27f) * density
        val h = w * 1.42f
        val bitmap = android.graphics.Bitmap.createBitmap(w.toInt() + 2, h.toInt() + 2, android.graphics.Bitmap.Config.ARGB_8888)
        val canvas = android.graphics.Canvas(bitmap)
        val r = w / 2f - density
        val cx = w / 2f + 1f
        val cy = r + density
        val path = android.graphics.Path().apply {
            arcTo(android.graphics.RectF(cx - r, cy - r, cx + r, cy + r), 150f, 240f)
            quadTo(cx + r * 0.42f, cy + r * 1.05f, cx, h)
            quadTo(cx - r * 0.42f, cy + r * 1.05f, cx - r * 0.866f, cy + r * 0.5f)
            close()
        }
        val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG)
        paint.color = color.toArgb()
        canvas.drawPath(path, paint)
        paint.style = android.graphics.Paint.Style.STROKE
        paint.strokeWidth = density
        paint.color = android.graphics.Color.argb(60, 0, 0, 0)
        canvas.drawPath(path, paint)
        paint.style = android.graphics.Paint.Style.FILL
        paint.color = android.graphics.Color.argb(235, 255, 255, 255)
        canvas.drawCircle(cx, cy, r * 0.36f, paint)
        BitmapDescriptorFactory.fromBitmap(bitmap)
    }
}

/**
 * A place's marker as on iOS: a disc in the category's colour with its white glyph, standing on
 * a short point, larger when picked and faded when another one is.
 */
@Composable
private fun GlyphPin(position: LatLng, key: String, icon: ImageVector, color: Color, selected: Boolean, dimmed: Boolean, zIndex: Float, onClick: () -> Unit) {
    val size = if (selected) 48.dp else 34.dp
    androidx.compose.runtime.key(key) {
        com.google.maps.android.compose.MarkerComposable(
            keys = arrayOf<Any>(key, selected, dimmed, color.toArgb()),
            state = rememberUpdatedMarkerState(position),
            zIndex = zIndex,
            alpha = if (dimmed) 0.45f else 1f,
            onClick = { onClick(); true },
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Box(Modifier.size(size + 4.dp).background(Color.White, CircleShape).padding(2.dp).background(color, CircleShape), Alignment.Center) {
                    Icon(icon, null, Modifier.size(size * 0.5f), tint = Color.White)
                }
                Box(Modifier.size(width = 8.dp, height = 6.dp).background(Color.White, androidx.compose.foundation.shape.GenericShape { box, _ ->
                    moveTo(0f, 0f); lineTo(box.width, 0f); lineTo(box.width / 2f, box.height); close()
                }))
            }
        }
    }
}

/** A stop on the map: the trail's green disc with its number, or a flag at either end. */
@Composable
private fun StopDisc(index: Int, stop: TrailStop) {
    val trail = Tint.Trail.solid
    val place = stop.kind == TrailStop.Kind.Place
    Box(Modifier.size(28.dp).background(if (place) Color.White else trail, CircleShape).border(2.5.dp, if (place) trail else Color.White, CircleShape), Alignment.Center) {
        if (place) Text("$index", style = Type.caption.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.Bold), color = trail)
        else Icon(if (stop.kind == TrailStop.Kind.Start) Icons.Filled.Flag else Icons.Outlined.SportsScore, null, Modifier.size(14.dp), tint = Color.White)
    }
}

@Composable
private fun PanelHeader(color: Color, icon: ImageVector, title: String, subtitle: String, verified: String? = null, sign: TrafficSignKind? = null, onClose: (() -> Unit)? = null) {
    Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        // A road notice leads with its report icon, as drawn on the map.
        if (sign != null) TrafficBadge(sign, 44.dp)
        else Box(Modifier.size(40.dp).background(color, CircleShape), Alignment.Center) { Icon(icon, null, Modifier.size(19.dp), tint = Color.White) }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(title, style = Type.title, color = Ink.colors.ink, modifier = Modifier.weight(1f, fill = false))
                // Verified sits beside the name as a badge, not as a line of its own.
                if (verified != null) Icon(Icons.Filled.Verified, verified, Modifier.size(19.dp), tint = Ink.colors.brand)
            }
            Text(subtitle, style = Type.callout, color = Ink.colors.ink3)
        }
        // Close on the right, as everywhere else.
        if (onClose != null) IconDisc(Icons.Outlined.Close, stringResource(R.string.common_close), onClose, floating = true)
    }
}

@Composable
private fun PlacePanel(sheet: PlaceSheet, vm: MapViewModel) {
    val place = sheet.place
    val detail = sheet.detail
    val context = LocalContext.current
    val p = Ink.colors
    val contact = when (val business = sheet.business) { is BusinessState.Listed -> business.contact; is BusinessState.Owned -> business.contact; else -> null }
    val shareLabel = stringResource(R.string.common_share)
    val established = detail != null && !sheet.cached && detail.trust.state == PlacesDetailOutput.Trust.State.Established
    PanelHeader(place.tint(), categoryIcon(place.icon), place.name, listOfNotNull(place.categoryName, detail?.municipality?.name).joinToString(" · "), if (established) stringResource(R.string.place_trust_established) else null, onClose = vm::dismissSheet)
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        Pill(stringResource(R.string.place_directions), {
            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}")))
        }, Modifier.weight(1f), icon = Icons.Outlined.Directions)
        IconDisc(if (sheet.saved) Icons.Filled.Bookmark else Icons.Outlined.BookmarkBorder, stringResource(if (sheet.saved) R.string.place_saved_label else R.string.place_save), vm::toggleSaved)
        IconDisc(Icons.Outlined.IosShare, shareLabel, {
            context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, "${place.name}\nhttps://rutacibao.do/lugares/${place.slug}") }, shareLabel))
        })
    }
    // Where it is comes first, then what it looks like.
    detail?.address?.let { Fact(Icons.Outlined.Place, it) }
    (detail?.imageUrl ?: place.thumbnailUrl)?.let { RemoteImage(it, Modifier.fillMaxWidth().height(190.dp).clip(RoundedCornerShape(Metrics.radiusCard))) }
    when {
        sheet.loading && detail == null -> LoadingDots(Modifier.height(60.dp))
        detail != null -> {
            if (!sheet.cached && !established) {
                val (icon, text, color) = when (detail.trust.state) {
                    PlacesDetailOutput.Trust.State.Confirmed -> Triple(Icons.Outlined.CheckCircle, R.string.place_trust_confirmed, p.ink2)
                    PlacesDetailOutput.Trust.State.Doubted -> Triple(Icons.Outlined.HelpOutline, R.string.place_trust_doubted, p.warning)
                    PlacesDetailOutput.Trust.State.Established -> Triple(Icons.Outlined.Verified, R.string.place_trust_established, p.success)
                    else -> Triple(Icons.Outlined.AutoAwesome, R.string.place_trust_new, p.ink3)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(icon, null, Modifier.size(18.dp), tint = color)
                    Text(stringResource(text), style = Type.callout, color = color)
                }
            }
            detail.description?.takeIf { it.isNotBlank() }?.let { Text(it, style = Type.body, color = p.ink2) }
            // Facts read as plain lines; only what can be tapped gets a surface.
            contact?.hours?.let { Fact(Icons.Outlined.Schedule, it) }
            if (contact?.phoneLink != null || contact?.whatsappLink != null) Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                contact.phoneLink?.let { link -> Pill(stringResource(R.string.place_call), { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(link))) }, Modifier.weight(1f), kind = PillKind.Quiet, compact = true, icon = Icons.Outlined.Phone) }
                contact.whatsappLink?.let { link -> Pill(stringResource(R.string.place_whatsapp), { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(link))) }, Modifier.weight(1f), kind = PillKind.Quiet, compact = true, icon = Icons.Outlined.Sms) }
            }
            val report = sheet.report
            if (report != null) ReportPlace(report, vm) else if (!detail.isMine) {
                // Verifying is secondary to finding the place: one grey row that opens its answers.
                var open by rememberSaveable { mutableStateOf(false) }
                Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(Metrics.radiusCard)).background(p.paper2)) {
                    Row(Modifier.fillMaxWidth().clickable { open = !open }.heightIn(min = 52.dp).padding(horizontal = 14.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.Checklist, null, Modifier.size(19.dp), tint = p.ink2)
                        Text(stringResource(R.string.place_verify), style = Type.bodyStrong, color = p.ink, modifier = Modifier.weight(1f))
                        detail.myVerdict?.let { Text(stringResource(if (it == PlacesDetailOutput.MyVerdict.Exists) R.string.place_exists else R.string.place_gone), style = Type.callout, color = p.ink3) }
                        Icon(if (open) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore, null, Modifier.size(20.dp), tint = p.ink3)
                    }
                    if (open) {
                        Column(Modifier.padding(horizontal = 14.dp).padding(bottom = 14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text(stringResource(R.string.place_still_there), style = Type.body, color = p.ink)
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Verdict(stringResource(R.string.place_exists), detail.myVerdict == PlacesDetailOutput.MyVerdict.Exists, !sheet.confirming, Modifier.weight(1f)) { vm.confirmPlace(PlacesConfirmInput.Verdict.Exists) }
                                Verdict(stringResource(R.string.place_gone), detail.myVerdict == PlacesDetailOutput.MyVerdict.Gone, !sheet.confirming, Modifier.weight(1f)) { vm.confirmPlace(PlacesConfirmInput.Verdict.Gone) }
                            }
                        }
                        Row(Modifier.fillMaxWidth().clickable(onClick = vm::openPlaceReport).heightIn(min = 48.dp).padding(horizontal = 14.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Outlined.Flag, null, Modifier.size(17.dp), tint = p.ink2)
                            Text(stringResource(R.string.place_report), style = Type.callout, color = p.ink, modifier = Modifier.weight(1f))
                            Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, null, Modifier.size(18.dp), tint = p.ink4)
                        }
                    }
                }
                if (sheet.feedbackError != null) Text(stringResource(R.string.common_error_title), style = Type.caption, color = p.danger)
            }
        }
        sheet.error != null -> ErrorView(sheet.error ?: UiError.Unknown, Modifier.height(200.dp)) { vm.select(place.id) }
    }
}

@Composable
private fun Fact(icon: ImageVector, text: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Icon(icon, null, Modifier.padding(top = 1.dp).size(17.dp), tint = Ink.colors.ink3)
        Text(text, style = Type.callout, color = Ink.colors.ink2)
    }
}

/** An answer as a plain word pill: the chosen one in the pine's soft wash with a check and a ring. */
@Composable
private fun Verdict(label: String, chosen: Boolean, enabled: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val p = Ink.colors
    Row(
        modifier.height(48.dp).clip(CircleShape).background(if (chosen) p.brandSoft else p.paper)
            .border(if (chosen) 1.5.dp else 1.dp, if (chosen) p.brand else p.line, CircleShape)
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick).semantics { selected = chosen },
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically,
    ) {
        if (chosen) Icon(Icons.Outlined.Check, null, Modifier.size(17.dp), tint = p.brandDeep)
        Text(label, style = Type.bodyStrong, color = if (chosen) p.brandDeep else p.ink)
    }
}

@Composable
private fun ReportPlace(report: PlaceReportState, vm: MapViewModel) {
    val p = Ink.colors
    Column(Modifier.fillMaxWidth().background(p.paper2, RoundedCornerShape(Metrics.radiusCard)).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (report.sent) {
            Notice(Icons.Outlined.CheckCircle, stringResource(if (report.queued) R.string.offline_queued_toast else R.string.place_report_sent), stringResource(if (report.queued) R.string.offline_queued_toast_body else R.string.place_report_sent_body))
        } else {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(R.string.place_report_title), style = Type.label, color = p.ink, modifier = Modifier.weight(1f))
                IconDisc(Icons.Outlined.Close, stringResource(R.string.common_cancel), vm::closePlaceReport)
            }
            val labels = PlacesReportInput.Reason.entries.associateWith { reason ->
                stringResource(when (reason) {
                    PlacesReportInput.Reason.IncorrectInformation -> R.string.place_reasons_incorrect_information
                    PlacesReportInput.Reason.Closed -> R.string.place_reasons_closed
                    PlacesReportInput.Reason.Duplicate -> R.string.place_reasons_duplicate
                    PlacesReportInput.Reason.WrongLocation -> R.string.place_reasons_wrong_location
                    PlacesReportInput.Reason.Other -> R.string.place_reasons_other
                })
            }
            ChoiceFlow(PlacesReportInput.Reason.entries, report.reason, { labels.getValue(it) }) { vm.updatePlaceReportReason(it) }
            Field(report.details, vm::updatePlaceReportDetails, stringResource(R.string.place_report_details), minLines = 2, maxLines = 5)
            if (report.invalidDetails) Text(stringResource(R.string.place_report_details_required), style = Type.caption, color = p.danger)
            if (report.error != null) Text(stringResource(R.string.common_error_title), style = Type.caption, color = p.danger)
            Pill(stringResource(R.string.common_send), vm::submitPlaceReport, Modifier.fillMaxWidth(), busy = report.submitting)
        }
    }
}

@Composable
private fun RoutePanel(route: RoutesBrowseOutput.Item, stops: List<TrailStop>, onClose: () -> Unit, onPlace: (String) -> Unit) {
    val p = Ink.colors
    val context = LocalContext.current
    PanelHeader(Tint.Trail.solid, Icons.AutoMirrored.Outlined.DirectionsWalk, route.name, "${route.categoryName} · ${route.municipalityName}", onClose = onClose)
    Row(Modifier.fillMaxWidth().background(p.paper2, RoundedCornerShape(Metrics.radiusCard)).padding(vertical = 14.dp)) {
        val minutes = route.durationMinutes.toInt()
        Fact(stringResource(R.string.routes_distance), "%.1f km".format(route.distanceMeters / 1000))
        Fact(stringResource(R.string.routes_duration), if (minutes >= 60) "${minutes / 60} h ${minutes % 60} min" else "$minutes min")
        Fact(stringResource(R.string.routes_difficulty), stringResource(when (route.difficulty) {
            RoutesBrowseOutput.Item.Difficulty.Easy -> R.string.explore_difficulty_easy
            RoutesBrowseOutput.Item.Difficulty.Moderate -> R.string.explore_difficulty_moderate
            RoutesBrowseOutput.Item.Difficulty.Hard -> R.string.explore_difficulty_hard
        }))
    }
    route.path.firstOrNull()?.let { start ->
        Pill(stringResource(R.string.routes_to_start), { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/maps/dir/?api=1&destination=${start.lat},${start.lng}"))) }, Modifier.fillMaxWidth(), icon = Icons.Outlined.Directions)
    }
    if (route.services.isNotEmpty()) {
        Text(stringResource(R.string.routes_services), style = Type.label, color = p.ink)
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            route.services.forEach { service ->
                Text(stringResource(when (service) {
                    RoutesBrowseOutput.Item.Service.Water -> R.string.routes_service_water
                    RoutesBrowseOutput.Item.Service.Food -> R.string.routes_service_food
                    RoutesBrowseOutput.Item.Service.Lodging -> R.string.routes_service_lodging
                    RoutesBrowseOutput.Item.Service.Guide -> R.string.routes_service_guide
                    RoutesBrowseOutput.Item.Service.Parking -> R.string.routes_service_parking
                    RoutesBrowseOutput.Item.Service.Restrooms -> R.string.routes_service_restrooms
                }), style = Type.callout, color = p.ink, modifier = Modifier.background(p.paper2, CircleShape).padding(horizontal = 12.dp, vertical = 8.dp))
            }
        }
    }
    if (stops.isNotEmpty()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(stringResource(R.string.routes_stops), style = Type.heading, color = p.ink, modifier = Modifier.weight(1f))
            if (stops.size > 2) Text(pluralStringResource(R.plurals.routes_stops_count, stops.size - 2, stops.size - 2), style = Type.callout, color = p.ink3)
        }
        // A timeline: a numbered disc per stop joined by the trail's colour, with how far in it comes.
        Column {
            stops.forEachIndexed { index, stop ->
                Row(Modifier.fillMaxWidth().height(androidx.compose.foundation.layout.IntrinsicSize.Min).clickable(enabled = stop.place != null) { stop.place?.let { onPlace(it.id) } }, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        StopDisc(index, stop)
                        if (index < stops.lastIndex) Box(Modifier.width(2.dp).weight(1f).heightIn(min = 18.dp).background(p.paper3))
                    }
                    Column(Modifier.weight(1f).padding(top = 4.dp, bottom = if (index < stops.lastIndex) 14.dp else 0.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(stop.name, style = Type.bodyStrong, color = p.ink, maxLines = 2)
                        // The start is where distances count from: it only says "Inicio" when a place names it.
                        val startLabel = stringResource(R.string.routes_start)
                        if (stop.kind != TrailStop.Kind.Start) {
                            Text(stringResource(R.string.routes_from_start, if (stop.along < 1000) "${(stop.along / 10).toInt() * 10} m" else "%.1f km".format(stop.along / 1000)), style = Type.callout, color = p.ink3)
                        } else if (stop.name != startLabel) Text(startLabel, style = Type.callout, color = p.ink3)
                    }
                    if (stop.place != null) Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, null, Modifier.padding(top = 6.dp).size(20.dp), tint = p.ink3)
                }
            }
        }
    }
    Text(route.description, style = Type.body, color = p.ink2)
    Notice(Icons.Outlined.Shield, stringResource(R.string.routes_safety_title), stringResource(R.string.routes_safety_body))
}

@Composable
private fun RowScope.Fact(label: String, value: String) {
    Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(value, style = Type.heading, color = Ink.colors.ink)
        Text(label, style = Type.caption, color = Ink.colors.ink3)
    }
}

@Composable
private fun TrafficPanel(notice: TrafficNotice, vm: MapViewModel) {
    val p = Ink.colors
    PanelHeader(if (notice.severity == TrafficSeverity.Blocking) p.danger else p.warning, categoryIcon(notice.icon), notice.categoryName, "${notice.municipality} · ${relativeTimeText(notice.createdAt)}", sign = TrafficSignKind.of(notice.categoryName, notice.icon), onClose = vm::dismissTraffic)
    notice.details?.takeIf { it.isNotBlank() }?.let { Text(it, style = Type.body, color = p.ink2) }
    // A blocked road is asked about in its own words; a side nobody has taken is left out, not shown as zero.
    val blocking = notice.severity == TrafficSeverity.Blocking
    if (notice.stillCount > 0 || notice.clearedCount > 0) Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        if (notice.stillCount > 0) Text(pluralStringResource(if (blocking) R.plurals.traffic_still_blocked_voices else R.plurals.traffic_still_voices, notice.stillCount, notice.stillCount), style = Type.callout, color = p.ink2)
        if (notice.clearedCount > 0) Text(pluralStringResource(if (blocking) R.plurals.traffic_gone_blocked_voices else R.plurals.traffic_cleared_voices, notice.clearedCount, notice.clearedCount), style = Type.callout, color = p.ink2)
    }
    if (notice.canConfirm) {
        Text(stringResource(if (blocking) R.string.traffic_ask_blocked else R.string.traffic_ask), style = Type.label, color = p.ink)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Pill(stringResource(if (blocking) R.string.traffic_still_blocked else R.string.traffic_still), { vm.confirmTraffic(TrafficVerdict.Still) }, Modifier.weight(1f), kind = if (notice.myVerdict == TrafficVerdict.Still) PillKind.Ink else PillKind.Quiet, compact = true)
            Pill(stringResource(if (blocking) R.string.traffic_gone_blocked else R.string.traffic_gone), { vm.confirmTraffic(TrafficVerdict.Cleared) }, Modifier.weight(1f), kind = if (notice.myVerdict == TrafficVerdict.Cleared) PillKind.Ink else PillKind.Quiet, compact = true)
        }
    } else notice.myVerdict?.let { Notice(Icons.Outlined.CheckCircle, stringResource(if (it == TrafficVerdict.Still) R.string.traffic_thanks_still else R.string.traffic_thanks_cleared)) }
}

/** Search across places and eco routes: type, see, tap (iOS's `MapSearch`). */
@Composable
private fun MapSearch(state: MapUiState, onDismiss: () -> Unit, onPlace: (MapPlace) -> Unit, onRoute: (RoutesBrowseOutput.Item) -> Unit, onCategory: (String) -> Unit, onRoutes: () -> Unit, onSuggest: () -> Unit) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        var query by remember { mutableStateOf("") }
        val p = Ink.colors
        val typed = query.trim()
        val routes = remember(typed, state.routes) { state.routes.filter { typed.isEmpty() || "${it.name} ${it.municipalityName}".contains(typed, ignoreCase = true) } }
        // Names that start with what was typed first, then names that contain it, then matches
        // on the category or town only, so "co" finds Colmado before every bank.
        val places = remember(typed, state.all) {
            fun fold(text: String) = java.text.Normalizer.normalize(text, java.text.Normalizer.Form.NFD).replace(Regex("\\p{M}"), "").lowercase()
            val q = fold(typed)
            state.all.sortedBy { fold(it.name) }.mapNotNull { place ->
                val name = fold(place.name)
                val rank = when {
                    q.isEmpty() -> 0
                    name.startsWith(q) || name.contains(" $q") -> 0
                    name.contains(q) -> 1
                    fold("${place.categoryName} ${state.municipalities[place.municipalityId].orEmpty()}").contains(q) -> 2
                    else -> null
                }
                rank?.let { place to it }
            }.sortedBy { it.second }.map { it.first }
        }
        Column(Modifier.fillMaxSize().background(p.paper).systemBarsPadding().imePadding()) {
            Row(Modifier.padding(horizontal = 16.dp, vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f)) { Field(query, { query = it }, stringResource(R.string.search_placeholder), icon = Icons.Outlined.Search) }
                IconDisc(Icons.Outlined.Close, stringResource(R.string.common_close), onDismiss, floating = true)
            }
            when {
                typed.isEmpty() -> LazyVerticalGrid(
                    GridCells.Fixed(2), Modifier.weight(1f), contentPadding = PaddingValues(start = Metrics.gutter, end = Metrics.gutter, top = 8.dp, bottom = 24.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    // Routes first, as on the map's filter row.
                    if (state.routes.isNotEmpty()) item(key = "routes") {
                        CategoryTile(stringResource(R.string.map_routes), Icons.AutoMirrored.Outlined.DirectionsWalk, Tint.Trail.solid, pluralStringResource(R.plurals.map_routes_count, state.routes.size, state.routes.size), onRoutes)
                    }
                    items(state.categories, key = { it.id }) { category ->
                        CategoryTile(category.name, categoryIcon(category.icon), Tint.of(category.color).solid, pluralStringResource(R.plurals.explore_places_count, category.count.toInt(), category.count.toInt())) { onCategory(category.id) }
                    }
                }
                routes.isEmpty() && places.isEmpty() -> StateView(stringResource(R.string.search_empty_title), Modifier.weight(1f), icon = Icons.Outlined.Search, message = stringResource(R.string.search_empty_body),
                    action = stringResource(R.string.contributions_example_place_title), onAction = onSuggest)
                else -> LazyColumn(Modifier.weight(1f)) {
                    if (routes.isNotEmpty()) {
                        item { Box(Modifier.padding(horizontal = Metrics.gutter)) { FormLabel(stringResource(R.string.map_routes)) } }
                        items(routes, key = { "r${it.id}" }) { route -> SearchRow(Icons.AutoMirrored.Outlined.DirectionsWalk, Tint.Trail, route.name, "${route.categoryName} · ${route.municipalityName}") { onRoute(route) } }
                    }
                    if (places.isNotEmpty()) {
                        item { Box(Modifier.padding(horizontal = Metrics.gutter).padding(top = 8.dp)) { FormLabel(stringResource(R.string.search_places)) } }
                        items(places, key = { "p${it.id}" }) { place ->
                            SearchRow(categoryIcon(place.icon), Tint.of(place.color), place.name, listOfNotNull(place.categoryName, state.municipalities[place.municipalityId]).joinToString(" · ")) { onPlace(place) }
                        }
                    }
                }
            }
        }
    }
}

/** A category as a quiet grey tile: its glyph on a disc in the kind's colour, its name and how many places. */
@Composable
private fun CategoryTile(name: String, icon: ImageVector, color: Color, detail: String, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().heightIn(min = 82.dp).clip(RoundedCornerShape(Metrics.radiusCard)).background(Ink.colors.paper2).pressable(scale = 0.97f, onClick = onClick).padding(horizontal = 12.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(36.dp).background(color, CircleShape), Alignment.Center) { Icon(icon, null, Modifier.size(17.dp), tint = Color.White) }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(name, style = Type.bodyStrong, color = Ink.colors.ink, maxLines = 2)
            Text(detail, style = Type.caption, color = Ink.colors.ink3)
        }
    }
}

@Composable
private fun SearchRow(icon: ImageVector, tint: Tint, title: String, detail: String, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = Metrics.gutter, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
        GlyphDisc(icon, tint = tint)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(title, style = Type.bodyStrong, color = Ink.colors.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(detail, style = Type.callout, color = Ink.colors.ink3)
        }
    }
}
