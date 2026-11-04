package rutacibao.android.feature.map

import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Place
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.rememberCameraPositionState
import kotlinx.coroutines.launch
import rutacibao.android.R
import rutacibao.android.ui.LocalPalette
import rutacibao.android.ui.MessageState
import rutacibao.android.ui.PrimaryButton
import rutacibao.android.ui.PushedScreen

/** Santiago Rodríguez town centre, where the picker opens without a start point. */
private val DefaultCenter = LatLng(19.4757, -71.3418)

/**
 * Pick a point by moving the map under a fixed pin. Starts on `start`, else the
 * last known location, else the town centre.
 */
@Composable
fun LocationPickerDialog(start: LatLng?, onDismiss: () -> Unit, onPicked: (LatLng) -> Unit) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            PickerContent(start, onDismiss, onPicked)
        }
    }
}

@Composable
private fun PickerContent(start: LatLng?, onDismiss: () -> Unit, onPicked: (LatLng) -> Unit) {
    val context = LocalContext.current
    val widthDp = LocalConfiguration.current.screenWidthDp
    val dark = isSystemInDarkTheme()
    val scope = rememberCoroutineScope()
    val initial = start ?: lastKnownLocation(context)?.let { LatLng(it.latitude, it.longitude) } ?: DefaultCenter
    val camera = rememberCameraPositionState {
        position = CameraPosition.fromLatLngZoom(initial, zoomForMeters(initial.latitude, if (start != null) 800.0 else 3000.0, widthDp))
    }
    var here by remember { mutableStateOf<LatLng?>(null) }
    PushedScreen(
        title = stringResource(R.string.picker_title),
        onBack = onDismiss,
        bottomBar = {
            Column(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.background).windowInsetsPadding(WindowInsets.safeDrawing).padding(horizontal = 20.dp, vertical = 8.dp)) {
                PrimaryButton(
                    text = stringResource(R.string.picker_confirm),
                    onClick = { onPicked(camera.position.target); onDismiss() },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            if (!mapsAvailable) {
                MessageState(stringResource(R.string.common_error_title), stringResource(R.string.common_error_body), icon = Icons.Filled.Map)
            } else {
                GoogleMap(
                    modifier = Modifier.fillMaxSize(),
                    cameraPositionState = camera,
                    properties = MapProperties(mapStyleOptions = calmMapStyle(dark)),
                    uiSettings = MapUiSettings(zoomControlsEnabled = false, myLocationButtonEnabled = false, mapToolbarEnabled = false, tiltGesturesEnabled = false),
                ) {
                    here?.let { UserDot(it) }
                }
                // The pin's tip marks the map's centre.
                Icon(
                    Icons.Filled.Place,
                    contentDescription = null,
                    modifier = Modifier.align(Alignment.Center).size(44.dp).offset(y = (-22).dp),
                    tint = LocalPalette.current.text,
                )
                val locateLabel = stringResource(R.string.picker_locate)
                Surface(
                    onClick = {
                        lastKnownLocation(context)?.let {
                            val p = LatLng(it.latitude, it.longitude)
                            here = p
                            scope.launch { camera.animate(CameraUpdateFactory.newLatLngZoom(p, 16f), 400) }
                        }
                    },
                    modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp).size(52.dp).semantics { contentDescription = locateLabel },
                    shape = CircleShape,
                    color = MaterialTheme.colorScheme.surfaceContainer,
                    shadowElevation = 4.dp,
                ) {
                    Box(contentAlignment = Alignment.Center) { Icon(Icons.Filled.MyLocation, contentDescription = null, tint = LocalPalette.current.locate) }
                }
            }
        }
    }
}
