package rutacibao.android.platform

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import androidx.core.content.ContextCompat
import com.google.android.gms.maps.model.LatLng
import kotlin.math.cos
import kotlin.math.ln
import rutacibao.android.BuildConfig

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
