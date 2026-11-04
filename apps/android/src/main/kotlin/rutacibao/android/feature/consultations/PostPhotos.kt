package rutacibao.android.feature.consultations

import rutacibao.android.feature.map.absoluteUrl
import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.material.icons.Icons
import rutacibao.android.ui.CloseButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil3.compose.AsyncImage
import coil3.request.ImageRequest
import coil3.request.crossfade
import kotlin.math.roundToInt
import kotlinx.coroutines.launch
import rutacibao.android.R
import rutacibao.android.ui.LocalPalette
import rutacibao.api.generated.ConsultationsBrowseOutput

typealias Photo = ConsultationsBrowseOutput.Item.Photo

private fun Photo.aspect(min: Float, max: Float): Float =
    if (height > 0) (width.toFloat() / height).coerceIn(min, max) else 1f

/** Rendered inside the text column (which has no end padding) so the row can bleed to the screen edge. */
@Composable
fun PostPhotos(photos: List<Photo>, onOpen: (Int) -> Unit, modifier: Modifier = Modifier) {
    if (photos.isEmpty()) return
    if (photos.size == 1) {
        PhotoTile(
            photos[0],
            modifier.padding(end = 16.dp).fillMaxWidth().aspectRatio(photos[0].aspect(0.8f, 1.78f)).clip(RoundedCornerShape(12.dp)),
            onClick = { onOpen(0) },
        )
    } else {
        LazyRow(modifier, horizontalArrangement = Arrangement.spacedBy(6.dp), contentPadding = PaddingValues(end = 16.dp)) {
            itemsIndexed(photos) { i, photo ->
                PhotoTile(
                    photo,
                    Modifier.height(240.dp).width((240 * photo.aspect(0.6f, 1.5f)).dp).clip(RoundedCornerShape(12.dp)),
                    onClick = { onOpen(i) },
                )
            }
        }
    }
}

@Composable
private fun PhotoTile(photo: Photo, modifier: Modifier, onClick: () -> Unit) {
    val context = LocalContext.current
    AsyncImage(
        model = remember(photo.url) { ImageRequest.Builder(context).data(absoluteUrl(photo.url)).crossfade(true).build() },
        contentDescription = photo.alt,
        contentScale = ContentScale.Crop,
        modifier = modifier
            .background(LocalPalette.current.inset)
            .border(0.5.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(12.dp))
            .clickable(role = Role.Image, onClick = onClick),
    )
}

@Composable
fun PhotoViewer(photos: List<Photo>, start: Int, onDismiss: () -> Unit) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        val pager = rememberPagerState(initialPage = start.coerceIn(0, photos.lastIndex)) { photos.size }
        val scope = rememberCoroutineScope()
        val dragY = remember { Animatable(0f) }
        var zoomed by remember { mutableStateOf(false) }
        Box(
            Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = (1f - dragY.value / 1200f).coerceIn(0.2f, 1f)))
                .offset { IntOffset(0, dragY.value.roundToInt()) }
                .pointerInput(zoomed) {
                    if (!zoomed) {
                        detectVerticalDrag(
                            onDrag = { scope.launch { dragY.snapTo((dragY.value + it).coerceAtLeast(0f)) } },
                            onEnd = { scope.launch { if (dragY.value > 220f) onDismiss() else dragY.animateTo(0f) } },
                        )
                    }
                },
        ) {
            HorizontalPager(pager, Modifier.fillMaxSize(), userScrollEnabled = !zoomed) { page ->
                ZoomableImage(photos[page], onZoomChange = { zoomed = it })
            }
            CloseButton(
                onDismiss,
                Modifier.align(Alignment.TopStart).windowInsetsPadding(WindowInsets.safeDrawing).padding(start = 8.dp, top = 4.dp),
                onMedia = true,
            )
            if (photos.size > 1) {
                Box(
                    Modifier
                        .align(Alignment.TopEnd)
                        .windowInsetsPadding(WindowInsets.safeDrawing)
                        .padding(end = 16.dp, top = 6.dp)
                        .height(26.dp)
                        .background(Color.Black.copy(alpha = 0.45f), CircleShape)
                        .padding(horizontal = 10.dp),
                    Alignment.Center,
                ) {
                    Text("${pager.currentPage + 1}/${photos.size}", style = MaterialTheme.typography.labelMedium, color = Color.White)
                }
            }
        }
    }
}

@Composable
private fun ZoomableImage(photo: Photo, onZoomChange: (Boolean) -> Unit) {
    var scale by remember { mutableFloatStateOf(1f) }
    var offset by remember { mutableStateOf(androidx.compose.ui.geometry.Offset.Zero) }
    AsyncImage(
        model = absoluteUrl(photo.url),
        contentDescription = photo.alt,
        contentScale = ContentScale.Fit,
        modifier = Modifier
            .fillMaxSize()
            .pointerInput(Unit) {
                detectTransformGestures { _, pan, zoom, _ ->
                    scale = (scale * zoom).coerceIn(1f, 5f)
                    offset = if (scale == 1f) androidx.compose.ui.geometry.Offset.Zero else offset + pan
                    onZoomChange(scale > 1.01f)
                }
            }
            .graphicsLayer(scaleX = scale, scaleY = scale, translationX = offset.x, translationY = offset.y),
    )
}

private suspend fun androidx.compose.ui.input.pointer.PointerInputScope.detectVerticalDrag(
    onDrag: (Float) -> Unit,
    onEnd: () -> Unit,
) {
    detectVerticalDragGestures(
        onDragEnd = onEnd,
        onDragCancel = onEnd,
        onVerticalDrag = { _, dy -> onDrag(dy) },
    )
}
