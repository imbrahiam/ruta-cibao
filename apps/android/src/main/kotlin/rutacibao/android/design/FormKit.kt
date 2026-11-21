package rutacibao.android.design

import android.content.ContentResolver
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.MyLocation
import androidx.compose.material.icons.outlined.PhotoLibrary
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.UnfoldMore
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import android.media.ExifInterface
import coil3.compose.AsyncImage
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.rememberCameraPositionState
import java.io.ByteArrayOutputStream
import kotlin.coroutines.cancellation.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import rutacibao.android.R
import rutacibao.android.platform.calmMapStyle
import rutacibao.android.platform.lastKnownLocation
import rutacibao.android.platform.mapsAvailable
import rutacibao.android.platform.zoomForMeters

/** A form on paper: a title row, scrolling fields, and one ink pill pinned to the bottom. */
@Composable
fun FormScreen(title: String, submit: String, onBack: () -> Unit, onSend: () -> Unit, sending: Boolean = false, enabled: Boolean = true, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxSize().background(Ink.colors.paper).imePadding()) {
        TopRow(title, onBack, backIcon = Icons.Outlined.Close)
        Box(Modifier.weight(1f).fillMaxWidth(), Alignment.TopCenter) {
            Column(
                Modifier.widthIn(max = 640.dp).fillMaxWidth().verticalScroll(rememberScrollState()).padding(start = Metrics.gutter, end = Metrics.gutter, top = 8.dp, bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp), content = content,
            )
        }
        Pill(submit, onSend, Modifier.padding(horizontal = Metrics.gutter, vertical = 10.dp).fillMaxWidth(), enabled = enabled, busy = sending)
    }
}

/** Wrapping chips for a short list of options. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun <T> ChoiceFlow(items: List<T>, selected: T?, title: (T) -> String, icon: (T) -> ImageVector? = { null }, onPick: (T) -> Unit) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items.forEach { item -> Chip(title(item), item == selected, { onPick(item) }, icon = icon(item)) }
    }
}

/** One row that opens a menu: for lists too long to lay out as chips. */
@Composable
fun <T> MenuField(placeholder: String, items: List<T>, selected: T?, title: (T) -> String, icon: (T) -> ImageVector? = { null }, problem: Boolean = false, onPick: (T) -> Unit) {
    var open by remember { mutableStateOf(false) }
    val p = Ink.colors
    val shape = RoundedCornerShape(Metrics.radiusField)
    Box {
        Row(
            Modifier.fillMaxWidth().heightIn(min = 52.dp).clip(shape).background(p.paper2).border(1.5.dp, if (problem) p.danger else Color.Transparent, shape)
                .pressable(scale = 0.99f) { open = true }.padding(horizontal = 16.dp).semantics { contentDescription = placeholder },
            horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically,
        ) {
            selected?.let(icon)?.let { Icon(it, null, Modifier.size(18.dp), tint = p.ink) }
            Text(selected?.let(title) ?: placeholder, style = Type.body, color = if (selected == null) p.ink3 else p.ink, modifier = Modifier.weight(1f))
            Icon(Icons.Outlined.UnfoldMore, null, Modifier.size(18.dp), tint = p.ink3)
        }
        DropdownMenu(open, { open = false }, containerColor = p.card, shape = RoundedCornerShape(Metrics.radiusCard), modifier = Modifier.heightIn(max = 420.dp)) {
            items.forEach { item ->
                DropdownMenuItem(
                    text = { Text(title(item), style = Type.body, color = p.ink) },
                    leadingIcon = icon(item)?.let { { Icon(it, null, Modifier.size(18.dp), tint = p.ink2) } },
                    trailingIcon = if (item == selected) { { Icon(Icons.Outlined.Check, null, Modifier.size(18.dp), tint = p.ink) } } else null,
                    onClick = { open = false; onPick(item) },
                )
            }
        }
    }
}

// ---------------------------------------------------------------- photos

/** Attached photos as a row of rounded tiles, with library and camera tiles until the limit. */
@Composable
fun PhotoTray(photos: List<ByteArray>, max: Int, add: (ByteArray) -> Unit, remove: (Int) -> Unit) {
    val resolver = LocalContext.current.contentResolver
    val scope = rememberCoroutineScope()
    var failed by remember { mutableStateOf(false) }
    val library = rememberLauncherForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(maxItems = max.coerceAtLeast(2))) { uris ->
        scope.launch {
            failed = false
            for (uri in uris.take((max - photos.size).coerceAtLeast(0))) {
                try { add(withContext(Dispatchers.IO) { preparePhoto(resolver, uri) }) }
                catch (cancelled: CancellationException) { throw cancelled }
                catch (_: Exception) { failed = true }
            }
        }
    }
    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicturePreview()) { bitmap ->
        if (bitmap != null) scope.launch {
            try {
                add(withContext(Dispatchers.Default) { ByteArrayOutputStream().use { out -> check(bitmap.compress(Bitmap.CompressFormat.JPEG, 80, out)); out.toByteArray() } })
            } catch (cancelled: CancellationException) { throw cancelled } catch (_: Exception) { failed = true }
        }
    }
    val shape = RoundedCornerShape(Metrics.radiusField)
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            photos.forEachIndexed { index, jpeg ->
                Box(Modifier.size(84.dp)) {
                    AsyncImage(model = jpeg, contentDescription = stringResource(R.string.contribute_photos_photo_label, index + 1), contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize().clip(shape))
                    val removeLabel = stringResource(R.string.contribute_photos_remove, index + 1)
                    Box(Modifier.align(Alignment.TopEnd).size(36.dp).pressable { remove(index) }.semantics { contentDescription = removeLabel }, Alignment.Center) {
                        Box(Modifier.size(22.dp).background(Ink.colors.action, CircleShape), Alignment.Center) { Icon(Icons.Outlined.Close, null, Modifier.size(12.dp), tint = Ink.colors.onInk) }
                    }
                }
            }
            if (photos.size < max) {
                PhotoTile(Icons.Outlined.PhotoLibrary, stringResource(R.string.contribute_photos_library_short)) { library.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }
                PhotoTile(Icons.Outlined.CameraAlt, stringResource(R.string.contribute_photos_camera)) { try { camera.launch(null) } catch (_: android.content.ActivityNotFoundException) { failed = true } }
            }
        }
        if (failed) Text(stringResource(R.string.contribute_photos_read_error), style = Type.caption, color = Ink.colors.danger)
    }
}

@Composable
private fun PhotoTile(icon: ImageVector, label: String, onClick: () -> Unit) {
    Column(
        Modifier.size(84.dp).clip(RoundedCornerShape(Metrics.radiusField)).background(Ink.colors.paper2).pressable(onClick = onClick),
        verticalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterVertically), horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(icon, null, Modifier.size(22.dp), tint = Ink.colors.ink2)
        Text(label, style = Type.caption, color = Ink.colors.ink2, textAlign = TextAlign.Center, maxLines = 1)
    }
}

private fun preparePhoto(resolver: ContentResolver, uri: Uri): ByteArray {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    resolver.openInputStream(uri).use { BitmapFactory.decodeStream(it, null, bounds) }
    require(bounds.outWidth > 0 && bounds.outHeight > 0)
    var sample = 1
    while (maxOf(bounds.outWidth, bounds.outHeight) / sample > 2048) sample *= 2
    val decoded = resolver.openInputStream(uri).use { requireNotNull(BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample })) }
    val orientation = resolver.openInputStream(uri).use { ExifInterface(requireNotNull(it)).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL) }
    val transform = Matrix().apply {
        when (orientation) {
            ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> setScale(-1f, 1f)
            ExifInterface.ORIENTATION_ROTATE_180 -> setRotate(180f)
            ExifInterface.ORIENTATION_FLIP_VERTICAL -> setScale(1f, -1f)
            ExifInterface.ORIENTATION_TRANSPOSE -> { setRotate(90f); postScale(-1f, 1f) }
            ExifInterface.ORIENTATION_ROTATE_90 -> setRotate(90f)
            ExifInterface.ORIENTATION_TRANSVERSE -> { setRotate(270f); postScale(-1f, 1f) }
            ExifInterface.ORIENTATION_ROTATE_270 -> setRotate(270f)
        }
    }
    val oriented = Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, transform, true)
    try {
        return ByteArrayOutputStream().use { out -> check(oriented.compress(Bitmap.CompressFormat.JPEG, 80, out)); out.toByteArray().also { require(it.size <= 8 * 1024 * 1024) } }
    } finally {
        if (oriented !== decoded) oriented.recycle()
        decoded.recycle()
    }
}

// ---------------------------------------------------------------- location

/** The landing's location pin: a teardrop with a paper eye (`location-pin.tsx`, 24 by 28 box). */
@Composable
fun TeardropPin(height: Dp = 42.dp, modifier: Modifier = Modifier, color: Color = Ink.colors.brand) {
    Canvas(modifier.size(height * 24f / 28f, height)) {
        val w = size.width / 24f; val h = size.height / 28f
        val drop = Path().apply {
            moveTo(12 * w, 27 * h)
            cubicTo(12 * w, 27 * h, 22 * w, 16.9f * h, 22 * w, 11 * h)
            arcTo(androidx.compose.ui.geometry.Rect(2 * w, 11 * h - 10 * w, 22 * w, 11 * h + 10 * w), 0f, -180f, false)
            cubicTo(2 * w, 16.9f * h, 12 * w, 27 * h, 12 * w, 27 * h)
            close()
        }
        drawPath(drop, color)
        drawCircle(Color(0xFFFFFAF7), radius = 4 * w, center = Offset(12 * w, 11 * h))
    }
}

/** A still map of one point under the landing's pin. */
@Composable
fun PlaceCard(latitude: Double, longitude: Double, modifier: Modifier = Modifier, height: Dp = 170.dp) {
    val shape = RoundedCornerShape(Metrics.radiusCard)
    Box(modifier.fillMaxWidth().height(height).clip(shape).background(Ink.colors.paper3), Alignment.Center) {
        if (mapsAvailable) {
            val point = LatLng(latitude, longitude)
            val camera = rememberCameraPositionState(key = "$latitude,$longitude") { position = CameraPosition.fromLatLngZoom(point, 15.5f) }
            GoogleMap(
                modifier = Modifier.fillMaxSize(), cameraPositionState = camera,
                properties = MapProperties(mapStyleOptions = calmMapStyle(isSystemInDarkTheme())),
                uiSettings = MapUiSettings(zoomControlsEnabled = false, myLocationButtonEnabled = false, mapToolbarEnabled = false, scrollGesturesEnabled = false, zoomGesturesEnabled = false, tiltGesturesEnabled = false, rotationGesturesEnabled = false, compassEnabled = false),
            )
        }
        TeardropPin(38.dp, Modifier.offset(y = (-19).dp))
    }
}

/** The chosen point as a still map with a "change" pill, or a dashed invitation to choose one. */
@Composable
fun LocationField(latitude: Double?, longitude: Double?, title: String, onPick: (Double, Double) -> Unit) {
    var picking by remember { mutableStateOf(false) }
    val p = Ink.colors
    if (latitude != null && longitude != null) {
        Box {
            PlaceCard(latitude, longitude, height = 200.dp)
            // The map swallows touches; a clear layer on top opens the picker.
            Box(Modifier.matchParentSize().clip(RoundedCornerShape(Metrics.radiusCard)).pressable(scale = 0.99f) { picking = true })
            Row(Modifier.padding(10.dp).height(34.dp).floating(CircleShape).padding(horizontal = 12.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Place, null, Modifier.size(16.dp), tint = p.ink)
                Text(stringResource(R.string.consultations_change_location), style = Type.label, color = p.ink)
            }
        }
    } else {
        val line = p.line
        Row(
            Modifier.fillMaxWidth().height(56.dp).clip(RoundedCornerShape(Metrics.radiusField)).pressable(scale = 0.99f) { picking = true }
                .dashed(line, Metrics.radiusField).padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Outlined.Place, null, Modifier.size(20.dp), tint = p.ink2)
            Text(title, style = Type.body, color = p.ink2)
        }
    }
    if (picking) LocationPicker(latitude?.let { lat -> longitude?.let { LatLng(lat, it) } }, { picking = false }) { onPick(it.latitude, it.longitude); picking = false }
}

private fun Modifier.dashed(color: Color, radius: Dp): Modifier = drawBehind {
    drawRoundRect(color, cornerRadius = CornerRadius(radius.toPx()), style = Stroke(width = 1.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 4.dp.toPx()))))
}

/** Santiago Rodríguez town centre, where the picker opens without a start point. */
private val TownCentre = LatLng(19.4757, -71.3418)

/** Move the map under a fixed pin, then confirm. The pin lifts while the map moves and lands when it stops. */
@Composable
fun LocationPicker(start: LatLng?, onDismiss: () -> Unit, onPicked: (LatLng) -> Unit) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        val context = LocalContext.current
        val scope = rememberCoroutineScope()
        val widthDp = LocalConfiguration.current.screenWidthDp
        val initial = start ?: lastKnownLocation(context)?.let { LatLng(it.latitude, it.longitude) } ?: TownCentre
        val camera = rememberCameraPositionState { position = CameraPosition.fromLatLngZoom(initial, zoomForMeters(initial.latitude, if (start != null) 700.0 else 2400.0, widthDp)) }
        val lift by animateDpAsState(if (camera.isMoving) (-36).dp else (-24).dp, label = "pin")
        Box(Modifier.fillMaxSize().background(Ink.colors.paper)) {
            if (mapsAvailable) {
                GoogleMap(
                    modifier = Modifier.fillMaxSize(), cameraPositionState = camera,
                    properties = MapProperties(mapStyleOptions = calmMapStyle(isSystemInDarkTheme())),
                    uiSettings = MapUiSettings(zoomControlsEnabled = false, myLocationButtonEnabled = false, mapToolbarEnabled = false, tiltGesturesEnabled = false, compassEnabled = false),
                )
            }
            Box(Modifier.align(Alignment.Center).size(if (camera.isMoving) 20.dp else 12.dp, 5.dp).background(Color.Black.copy(alpha = 0.2f), CircleShape))
            TeardropPin(48.dp, Modifier.align(Alignment.Center).offset(y = lift))
            Row(Modifier.fillMaxWidth().systemBarsPadding().padding(horizontal = 16.dp, vertical = 10.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                IconDisc(Icons.Outlined.Close, stringResource(R.string.common_cancel), onDismiss, floating = true)
                IconDisc(Icons.Outlined.MyLocation, stringResource(R.string.picker_locate), {
                    lastKnownLocation(context)?.let { scope.launch { camera.animate(CameraUpdateFactory.newLatLngZoom(LatLng(it.latitude, it.longitude), 16f), 400) } }
                }, floating = true)
            }
            Pill(stringResource(R.string.picker_confirm), { onPicked(camera.position.target) }, Modifier.align(Alignment.BottomCenter).systemBarsPadding().padding(horizontal = Metrics.gutter, vertical = 10.dp).widthIn(max = 640.dp).fillMaxWidth())
        }
    }
}

/** A submitted form's last word: the check draws in, one line, done. */
@Composable
fun SentView(title: String, message: String?, onDone: () -> Unit) {
    val scale = remember { androidx.compose.animation.core.Animatable(0.6f) }
    LaunchedEffect(Unit) { scale.animateTo(1f, androidx.compose.animation.core.spring(dampingRatio = 0.45f)) }
    Column(Modifier.fillMaxSize().background(Ink.colors.paper).padding(Metrics.gutter), horizontalAlignment = Alignment.CenterHorizontally) {
        Spacer(Modifier.weight(1f))
        Box(Modifier.size(76.dp).graphicsLayer { scaleX = scale.value; scaleY = scale.value }.background(Ink.colors.action, CircleShape), Alignment.Center) {
            Icon(Icons.Outlined.Check, null, Modifier.size(34.dp), tint = Ink.colors.onInk)
        }
        Text(title, style = Type.title, color = Ink.colors.ink, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 18.dp).rise(1))
        if (message != null) Text(message, style = Type.body, color = Ink.colors.ink2, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp).rise(2))
        Spacer(Modifier.weight(1f))
        Pill(stringResource(R.string.common_done), onDone, Modifier.fillMaxWidth().rise(3))
    }
}
