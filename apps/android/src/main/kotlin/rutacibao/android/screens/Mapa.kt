package rutacibao.android.screens

import android.Manifest
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
    var satellite by rememberSaveable { mutableStateOf(false) }
    var searching by rememberSaveable { mutableStateOf(startSearching) }
    var me by remember { mutableStateOf<LatLng?>(null) }
    var handled by rememberSaveable { mutableStateOf(0L) }
    val camera = rememberCameraPositionState {
        val start = lastKnownLocation(context)?.let { LatLng(it.latitude, it.longitude) }
        position = CameraPosition.fromLatLngZoom(start ?: TownCentre, 14.6f)
    }
    val fly: (com.google.android.gms.maps.CameraUpdate) -> Unit = { update -> scope.launch { runCatching { camera.animate(update, 500) } } }
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
    LaunchedEffect(camera.isMoving) {
        if (camera.isMoving) return@LaunchedEffect
        camera.projection?.visibleRegion?.latLngBounds?.let { b -> vm.onViewportChanged(b.southwest.longitude, b.southwest.latitude, b.northeast.longitude, b.northeast.latitude) }
    }
    // Bring what was picked into the upper half, above its sheet.
    val selection = state.selection
    LaunchedEffect((selection as? MapSelection.Place)?.sheet?.place?.id, (selection as? MapSelection.Route)?.route?.id, (selection as? MapSelection.Traffic)?.id) {
        when (selection) {
            is MapSelection.Place -> selection.sheet.place.let { fly(CameraUpdateFactory.newLatLngZoom(LatLng(it.latitude - 0.0022, it.longitude), 16f)) }
            is MapSelection.Traffic -> state.selectedTraffic?.let { fly(CameraUpdateFactory.newLatLngZoom(LatLng(it.latitude - 0.0022, it.longitude), 16f)) }
            is MapSelection.Route -> selection.route.path.takeIf { it.isNotEmpty() }?.let { path ->
                val bounds = LatLngBounds.builder().apply { path.forEach { include(LatLng(it.lat, it.lng)) } }.build()
                fly(CameraUpdateFactory.newLatLngBounds(bounds, 140))
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
                properties = MapProperties(mapStyleOptions = if (satellite) null else calmMapStyle(dark), mapType = if (satellite) MapType.HYBRID else MapType.NORMAL, isMyLocationEnabled = hasLocationPermission(context)),
                uiSettings = MapUiSettings(zoomControlsEnabled = false, myLocationButtonEnabled = false, mapToolbarEnabled = false, tiltGesturesEnabled = false, compassEnabled = false),
                contentPadding = WindowInsets.statusBars.asPaddingValues(),
                onMapClick = { vm.dismissSheet(); vm.dismissRoute(); vm.dismissTraffic() },
            ) {
                state.visibleRoutes.forEach { route ->
                    val on = state.route?.id == route.id
                    Polyline(points = route.path.map { LatLng(it.lat, it.lng) }, color = p.success, width = if (on) 16f else 10f, clickable = true, onClick = { vm.selectRoute(route.id) })
                    route.path.firstOrNull()?.let { start ->
                        Marker(state = rememberUpdatedMarkerState(LatLng(start.lat, start.lng)), title = route.name, icon = googlePin(Tint.Mint.solid, density, on), zIndex = 2f, onClick = { vm.selectRoute(route.id); true })
                    }
                }
                state.traffic.forEach { notice ->
                    val color = if (notice.severity == TrafficSeverity.Blocking) p.danger else p.warning
                    val on = state.selectedTraffic?.id == notice.id
                    if (notice.path.size > 1) Polyline(points = notice.path.map { LatLng(it.latitude, it.longitude) }, color = color, width = 12f)
                    Marker(state = rememberUpdatedMarkerState(LatLng(notice.latitude, notice.longitude)), title = notice.categoryName, icon = googlePin(color, density, on), zIndex = 4f, onClick = { vm.selectTraffic(notice.id); true })
                }
                places.forEach { place ->
                    val on = state.sheet?.place?.id == place.id
                    Marker(state = rememberUpdatedMarkerState(LatLng(place.latitude, place.longitude)), title = place.name, icon = googlePin(place.tint(), density, on), zIndex = if (on) 5f else 1f, onClick = { vm.select(place.id); true })
                }
            }
        } else {
            StateView(stringResource(R.string.map_basemap_unavailable), Modifier.align(Alignment.Center), icon = Icons.Outlined.Map, message = stringResource(R.string.map_basemap_unavailable_body))
        }

        // Search and filters float over the map.
        Column(Modifier.statusBarsPadding().padding(top = 6.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(
                Modifier.padding(horizontal = 16.dp).widthIn(max = 440.dp).fillMaxWidth().height(52.dp).floating(CircleShape).clip(CircleShape).pressable(scale = 0.98f) { searching = true }.padding(horizontal = 18.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Outlined.Search, null, Modifier.size(20.dp), tint = p.ink)
                Text(stringResource(R.string.map_search_placeholder), style = Type.body, color = p.ink3)
            }
            LazyRow(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (state.filtering) item(key = "clear") {
                    Box(Modifier.size(38.dp).background(p.action, CircleShape).clip(CircleShape).pressable(onClick = vm::clearFilters), Alignment.Center) {
                        Icon(Icons.Outlined.Close, stringResource(R.string.map_clear_filters), Modifier.size(16.dp), tint = p.onInk)
                    }
                }
                if (state.routes.isNotEmpty()) item(key = "routes") { Chip(stringResource(R.string.map_routes), state.routesSelected, vm::toggleRoutes, icon = Icons.AutoMirrored.Outlined.DirectionsWalk, floating = true) }
                items(state.categories, key = { it.id }) { category ->
                    Chip(category.name, category.id in state.selectedCategories, { vm.toggleCategory(category.id) }, icon = categoryIcon(category.icon), floating = true)
                }
            }
        }

        Column(Modifier.align(Alignment.BottomEnd).padding(end = 16.dp, bottom = LocalBarClearance.current + WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding() + 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            IconDisc(if (satellite) Icons.Outlined.Map else Icons.Outlined.Public, stringResource(if (satellite) R.string.map_layers_standard else R.string.map_layers_satellite), { satellite = !satellite }, floating = true)
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
                    is MapSelection.Route -> RoutePanel(selection.route)
                    is MapSelection.Traffic -> state.selectedTraffic?.let { TrafficPanel(it, vm) }
                    else -> Unit
                }
            }
        }
    }
    if (searching) MapSearch(state, onDismiss = { searching = false }, onPlace = { searching = false; vm.select(it.id) }, onRoute = { searching = false; vm.selectRoute(it.id) })
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

@Composable
private fun PanelHeader(color: Color, icon: ImageVector, title: String, subtitle: String, verified: String? = null) {
    Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        Box(Modifier.size(46.dp).background(color, CircleShape), Alignment.Center) { Icon(icon, null, Modifier.size(22.dp), tint = Color.White) }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(title, style = Type.title, color = Ink.colors.ink, modifier = Modifier.weight(1f, fill = false))
                // Verified sits beside the name as a badge, not as a line of its own.
                if (verified != null) Icon(Icons.Filled.Verified, verified, Modifier.size(19.dp), tint = Ink.colors.iris)
            }
            Text(subtitle, style = Type.callout, color = Ink.colors.ink3)
        }
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
    PanelHeader(place.tint(), categoryIcon(place.icon), place.name, listOfNotNull(place.categoryName, detail?.municipality?.name).joinToString(" · "), if (established) stringResource(R.string.place_trust_established) else null)
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        Pill(stringResource(R.string.place_directions), {
            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}")))
        }, Modifier.weight(1f), icon = Icons.Outlined.Directions)
        IconDisc(if (sheet.saved) Icons.Filled.Bookmark else Icons.Outlined.BookmarkBorder, stringResource(if (sheet.saved) R.string.place_saved_label else R.string.place_save), vm::toggleSaved)
        IconDisc(Icons.Outlined.IosShare, shareLabel, {
            context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, "${place.name}\nhttps://rutacibao.do/lugares/${place.slug}") }, shareLabel))
        })
    }
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
            detail.address?.let { Fact(Icons.Outlined.Place, it) }
            contact?.hours?.let { Fact(Icons.Outlined.Schedule, it) }
            if (contact?.phoneLink != null || contact?.whatsappLink != null) Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                contact.phoneLink?.let { link -> Pill(stringResource(R.string.place_call), { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(link))) }, Modifier.weight(1f), kind = PillKind.Quiet, compact = true, icon = Icons.Outlined.Phone) }
                contact.whatsappLink?.let { link -> Pill(stringResource(R.string.place_whatsapp), { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(link))) }, Modifier.weight(1f), kind = PillKind.Quiet, compact = true, icon = Icons.Outlined.Sms) }
            }
            val report = sheet.report
            if (report != null) ReportPlace(report, vm) else if (!detail.isMine) {
                // Feedback is secondary: one quiet line under a hairline.
                Box(Modifier.fillMaxWidth().height(1.dp).background(p.line))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(stringResource(R.string.place_still_there), style = Type.callout, color = p.ink3, modifier = Modifier.weight(1f))
                    Verdict(Icons.Outlined.Check, stringResource(R.string.place_exists), detail.myVerdict == PlacesDetailOutput.MyVerdict.Exists, !sheet.confirming) { vm.confirmPlace(PlacesConfirmInput.Verdict.Exists) }
                    Verdict(Icons.Outlined.Close, stringResource(R.string.place_gone), detail.myVerdict == PlacesDetailOutput.MyVerdict.Gone, !sheet.confirming) { vm.confirmPlace(PlacesConfirmInput.Verdict.Gone) }
                    Box(Modifier.size(44.dp).clip(CircleShape).clickable(onClickLabel = stringResource(R.string.place_report), role = Role.Button, onClick = vm::openPlaceReport), Alignment.Center) {
                        Icon(Icons.Outlined.Flag, stringResource(R.string.place_report), Modifier.size(18.dp), tint = p.ink2)
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

/** A glyph in a small disc; the chosen one fills with ink. */
@Composable
private fun Verdict(icon: ImageVector, label: String, chosen: Boolean, enabled: Boolean, onClick: () -> Unit) {
    val p = Ink.colors
    Box(Modifier.size(44.dp).clip(CircleShape).clickable(enabled = enabled, role = Role.Button, onClick = onClick).semantics { selected = chosen }, Alignment.Center) {
        Box(Modifier.size(36.dp).background(if (chosen) p.action else p.paper2, CircleShape), Alignment.Center) {
            Icon(icon, label, Modifier.size(17.dp), tint = if (chosen) p.onInk else p.ink)
        }
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
private fun RoutePanel(route: RoutesBrowseOutput.Item) {
    val p = Ink.colors
    val context = LocalContext.current
    PanelHeader(p.success, Icons.AutoMirrored.Outlined.DirectionsWalk, route.name, "${route.categoryName} · ${route.municipalityName}")
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
    PanelHeader(if (notice.severity == TrafficSeverity.Blocking) p.danger else p.warning, categoryIcon(notice.icon), notice.categoryName, "${notice.municipality} · ${relativeTimeText(notice.createdAt)}")
    notice.details?.takeIf { it.isNotBlank() }?.let { Text(it, style = Type.body, color = p.ink2) }
    Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        Text(pluralStringResource(R.plurals.traffic_still_voices, notice.stillCount, notice.stillCount), style = Type.callout, color = p.ink3)
        Text(pluralStringResource(R.plurals.traffic_cleared_voices, notice.clearedCount, notice.clearedCount), style = Type.callout, color = p.ink3)
    }
    if (notice.canConfirm) {
        Text(stringResource(R.string.traffic_ask), style = Type.label, color = p.ink)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Pill(stringResource(R.string.traffic_still), { vm.confirmTraffic(TrafficVerdict.Still) }, Modifier.weight(1f), kind = if (notice.myVerdict == TrafficVerdict.Still) PillKind.Ink else PillKind.Quiet, compact = true)
            Pill(stringResource(R.string.traffic_gone), { vm.confirmTraffic(TrafficVerdict.Cleared) }, Modifier.weight(1f), kind = if (notice.myVerdict == TrafficVerdict.Cleared) PillKind.Ink else PillKind.Quiet, compact = true)
        }
    } else notice.myVerdict?.let { Notice(Icons.Outlined.CheckCircle, stringResource(if (it == TrafficVerdict.Still) R.string.traffic_thanks_still else R.string.traffic_thanks_cleared)) }
}

/** Search across places and eco routes: type, see, tap. */
@Composable
private fun MapSearch(state: MapUiState, onDismiss: () -> Unit, onPlace: (MapPlace) -> Unit, onRoute: (RoutesBrowseOutput.Item) -> Unit) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        var query by remember { mutableStateOf("") }
        val p = Ink.colors
        val routes = remember(query, state.routes) { state.routes.filter { query.isBlank() || "${it.name} ${it.municipalityName}".contains(query.trim(), ignoreCase = true) } }
        val places = remember(query, state.all) {
            state.all.sortedBy { it.name.lowercase() }.filter { query.isBlank() || "${it.name} ${it.categoryName} ${state.municipalities[it.municipalityId].orEmpty()}".contains(query.trim(), ignoreCase = true) }
        }
        Column(Modifier.fillMaxSize().background(p.paper).systemBarsPadding().imePadding()) {
            Row(Modifier.padding(horizontal = 16.dp, vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                IconDisc(Icons.AutoMirrored.Outlined.ArrowBack, stringResource(R.string.common_close), onDismiss)
                Box(Modifier.weight(1f)) { Field(query, { query = it }, stringResource(R.string.search_placeholder), icon = Icons.Outlined.Search) }
            }
            if (routes.isEmpty() && places.isEmpty()) StateView(stringResource(R.string.search_empty_title), Modifier.weight(1f), icon = Icons.Outlined.Search, message = stringResource(R.string.search_empty_body))
            else LazyColumn(Modifier.weight(1f)) {
                if (routes.isNotEmpty()) {
                    item { Box(Modifier.padding(horizontal = Metrics.gutter)) { FormLabel(stringResource(R.string.map_routes)) } }
                    items(routes, key = { "r${it.id}" }) { route -> SearchRow(Icons.AutoMirrored.Outlined.DirectionsWalk, Tint.Mint, route.name, "${route.categoryName} · ${route.municipalityName}") { onRoute(route) } }
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

@Composable
private fun SearchRow(icon: ImageVector, tint: Tint, title: String, detail: String, onClick: () -> Unit) {
    Column(Modifier.clickable(onClick = onClick)) {
        Row(Modifier.padding(horizontal = Metrics.gutter, vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
            GlyphDisc(icon, tint = tint)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                Text(title, style = Type.bodyStrong, color = Ink.colors.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(detail, style = Type.callout, color = Ink.colors.ink3)
            }
        }
        Hairline(inset = Metrics.gutter + 54.dp)
    }
}
