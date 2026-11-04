package rutacibao.android.feature.map

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Map
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.google.android.gms.maps.GoogleMapOptions
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.MarkerComposable
import com.google.maps.android.compose.rememberCameraPositionState
import com.google.maps.android.compose.rememberUpdatedMarkerState
import kotlin.math.cos
import kotlin.math.ln
import rutacibao.android.BuildConfig
import rutacibao.android.ui.LocalPalette

/** Province centre (packages/shared geo.ts), used before places arrive. */
val ProvinceCenter = LatLng(19.369, -71.296)

/** Google zoom level that shows `meters` across `widthDp` at this latitude. */
fun zoomForMeters(latitude: Double, meters: Double, widthDp: Int): Float {
    val metersPerDp = meters / widthDp.coerceAtLeast(1)
    return (ln(156_543.03 * cos(Math.toRadians(latitude)) / metersPerDp) / ln(2.0)).toFloat()
}

val mapsAvailable: Boolean get() = BuildConfig.HAS_MAPS_KEY

fun hasLocationPermission(context: Context): Boolean =
    ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

/** Best last fix across providers; null when nothing is cached or permission is missing. */
@SuppressLint("MissingPermission")
fun lastKnownLocation(context: Context): Location? {
    if (!hasLocationPermission(context)) return null
    val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    return runCatching {
        manager.getProviders(true).mapNotNull { manager.getLastKnownLocation(it) }.maxByOrNull { it.time }
    }.getOrNull()
}

/** "You are here": system-blue dot with a white ring, never the theme accent. */
@Composable
fun UserDot(position: LatLng) {
    val blue = LocalPalette.current.locate
    MarkerComposable(
        state = rememberUpdatedMarkerState(position),
        anchor = androidx.compose.ui.geometry.Offset(0.5f, 0.5f),
        zIndex = 5f,
    ) {
        Box(Modifier.size(20.dp).background(Color.White, CircleShape), Alignment.Center) {
            Box(Modifier.size(14.dp).background(blue, CircleShape))
        }
    }
}

/** A single glyph pin, 32dp (44dp selected) with a white ring. */
@Composable
fun PinGlyph(color: Color, icon: androidx.compose.ui.graphics.vector.ImageVector, selected: Boolean) {
    val size = if (selected) 44.dp else 32.dp
    Box(
        Modifier.size(size).background(color, CircleShape).border(2.5.dp, Color.White, CircleShape),
        Alignment.Center,
    ) {
        Icon(icon, contentDescription = null, Modifier.size(if (selected) 22.dp else 16.dp), tint = Color.White)
    }
}

/** A quiet, non-interactive map of one point (consultation detail, report form). */
@Composable
fun StaticPinMap(latitude: Double, longitude: Double, tint: Color, meters: Double, modifier: Modifier = Modifier) {
    if (!mapsAvailable) {
        Box(modifier.background(MaterialTheme.colorScheme.surfaceVariant), Alignment.Center) {
            Icon(Icons.Filled.Map, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        return
    }
    val position = LatLng(latitude, longitude)
    val widthDp = androidx.compose.ui.platform.LocalConfiguration.current.screenWidthDp - 32
    val camera = rememberCameraPositionState(position.toString()) {
        this.position = CameraPosition.fromLatLngZoom(position, zoomForMeters(latitude, meters, widthDp))
    }
    val dark = androidx.compose.foundation.isSystemInDarkTheme()
    GoogleMap(
        modifier = modifier,
        cameraPositionState = camera,
        googleMapOptionsFactory = { GoogleMapOptions().liteMode(true) },
        properties = MapProperties(mapStyleOptions = calmMapStyle(dark)),
        uiSettings = MapUiSettings(
            compassEnabled = false, zoomControlsEnabled = false, scrollGesturesEnabled = false, zoomGesturesEnabled = false,
            rotationGesturesEnabled = false, tiltGesturesEnabled = false, mapToolbarEnabled = false, myLocationButtonEnabled = false,
        ),
    ) {
        MarkerComposable(state = rememberUpdatedMarkerState(position), anchor = androidx.compose.ui.geometry.Offset(0.5f, 0.5f)) {
            Box(Modifier.size(22.dp).background(tint, CircleShape).border(3.dp, Color.White, CircleShape))
        }
    }
}
