package rutacibao.android.ui

import android.content.ContentResolver
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material.icons.outlined.PhotoLibrary
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import java.io.ByteArrayOutputStream
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import rutacibao.android.R

/** System library/camera UI; draft bytes, not transient URI permissions, survive in the outbox. */
@Composable
fun PhotoAttach(max: Int, photos: List<ByteArray>, enabled: Boolean, add: (ByteArray) -> Unit, remove: (Int) -> Unit) {
    val resolver = LocalContext.current.contentResolver
    val scope = rememberCoroutineScope()
    var loading by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }
    val library = rememberLauncherForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(maxItems = max)) { uris ->
        if (uris.isNotEmpty()) scope.launch {
            loading = true
            failed = false
            try {
                for (uri in uris.take((max - photos.size).coerceAtLeast(0))) {
                    try { add(withContext(Dispatchers.IO) { preparePhoto(resolver, uri) }) }
                    catch (cancelled: CancellationException) { throw cancelled }
                    catch (_: Exception) { failed = true }
                }
            } finally { loading = false }
        }
    }
    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicturePreview()) { bitmap ->
        if (bitmap != null) scope.launch {
            loading = true
            try {
                val jpeg = withContext(Dispatchers.Default) { ByteArrayOutputStream().use { output ->
                    check(bitmap.compress(Bitmap.CompressFormat.JPEG, 80, output))
                    output.toByteArray()
                } }
                add(jpeg)
            } catch (cancelled: CancellationException) { throw cancelled
            } catch (_: Exception) { failed = true
            } finally { loading = false }
        }
    }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            photos.forEachIndexed { index, jpeg ->
                Box {
                    AsyncImage(model = jpeg, contentDescription = stringResource(R.string.contribute_photos_photo_label, index + 1), contentScale = ContentScale.Crop, modifier = Modifier.size(92.dp))
                    IconButton(onClick = { remove(index) }, enabled = enabled && !loading, modifier = Modifier.align(Alignment.TopEnd)) {
                        Icon(Icons.Filled.Close, contentDescription = stringResource(R.string.contribute_photos_remove, index + 1))
                    }
                }
            }
        }
        if (photos.size < max) Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            PhotoButton(Icons.Outlined.CameraAlt, stringResource(R.string.contribute_photos_camera), stringResource(R.string.contribute_photos_camera), Modifier.weight(1f), enabled && !loading) {
                try { camera.launch(null) } catch (_: android.content.ActivityNotFoundException) { failed = true }
            }
            PhotoButton(Icons.Outlined.PhotoLibrary, stringResource(R.string.contribute_photos_library_short), stringResource(R.string.contribute_photos_library), Modifier.weight(1f), enabled && !loading) {
                library.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
            }
        }
        if (failed) Text(stringResource(R.string.contribute_photos_read_error), color = LocalPalette.current.dangerInk)
    }
}

@Composable
private fun PhotoButton(icon: ImageVector, label: String, description: String, modifier: Modifier, enabled: Boolean, onClick: () -> Unit) {
    FilledTonalButton(
        onClick = onClick,
        enabled = enabled,
        shape = CircleShape,
        colors = ButtonDefaults.filledTonalButtonColors(containerColor = LocalPalette.current.inset, contentColor = MaterialTheme.colorScheme.onSurface),
        contentPadding = PaddingValues(horizontal = 12.dp),
        modifier = modifier.heightIn(min = 48.dp).semantics { contentDescription = description },
    ) {
        Icon(icon, contentDescription = null, Modifier.size(20.dp))
        Spacer(Modifier.width(8.dp))
        Text(label, style = MaterialTheme.typography.titleSmall, maxLines = 1)
    }
}

private fun preparePhoto(resolver: ContentResolver, uri: Uri): ByteArray {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    resolver.openInputStream(uri).use { BitmapFactory.decodeStream(it, null, bounds) }
    require(bounds.outWidth > 0 && bounds.outHeight > 0)
    var sample = 1
    while (maxOf(bounds.outWidth, bounds.outHeight) / sample > 2048) sample *= 2
    val decoded = resolver.openInputStream(uri).use {
        requireNotNull(BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample }))
    }
    val orientation = resolver.openInputStream(uri).use { stream ->
        ExifInterface(requireNotNull(stream)).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
    }
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
        return ByteArrayOutputStream().use { output ->
            check(oriented.compress(Bitmap.CompressFormat.JPEG, 80, output))
            output.toByteArray().also { require(it.size <= 8 * 1024 * 1024) }
        }
    } finally {
        if (oriented !== decoded) oriented.recycle()
        decoded.recycle()
    }
}
