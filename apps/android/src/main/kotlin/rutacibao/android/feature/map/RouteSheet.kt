package rutacibao.android.feature.map

import android.content.Intent
import android.icu.text.MeasureFormat
import android.icu.text.NumberFormat
import android.icu.util.Measure
import android.icu.util.MeasureUnit
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DirectionsBike
import androidx.compose.material.icons.filled.Hiking
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.Directions
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.util.Locale
import rutacibao.android.R
import rutacibao.android.ui.Hairline
import rutacibao.android.ui.LocalPalette
import rutacibao.android.ui.PrimaryButton
import rutacibao.api.generated.RoutesBrowseOutput

typealias EcoRoute = RoutesBrowseOutput.Item

/** Hiking green, cycling orange. */
val EcoRoute.tint: Color get() = if (categoryId == "ciclismo") Color(0xFFF08C00) else Color(0xFF2F9E44)
val EcoRoute.symbol: ImageVector get() = if (categoryId == "ciclismo") Icons.Filled.DirectionsBike else Icons.Filled.Hiking

@Composable
fun EcoRoute.distanceText(): String {
    val locale = LocalConfiguration.current.locales[0] ?: Locale.getDefault()
    return remember(distanceMeters, locale) {
        val numbers = NumberFormat.getInstance(locale).apply { maximumFractionDigits = 1; minimumFractionDigits = 1 }
        MeasureFormat.getInstance(locale, MeasureFormat.FormatWidth.SHORT, numbers)
            .format(Measure(distanceMeters / 1000, MeasureUnit.KILOMETER))
    }
}

@Composable
private fun EcoRoute.durationText(): String {
    val total = durationMinutes.toInt()
    val hours = total / 60
    val minutes = total % 60
    return listOfNotNull(
        if (hours > 0) pluralStringResource(R.plurals.explore_duration_hours, hours, hours) else null,
        if (minutes > 0 || hours == 0) pluralStringResource(R.plurals.explore_duration_minutes, minutes, minutes) else null,
    ).joinToString(" ")
}

@Composable
private fun EcoRoute.difficultyText(): String = stringResource(
    when (difficulty) {
        RoutesBrowseOutput.Item.Difficulty.Easy -> R.string.explore_difficulty_easy
        RoutesBrowseOutput.Item.Difficulty.Moderate -> R.string.explore_difficulty_moderate
        RoutesBrowseOutput.Item.Difficulty.Hard -> R.string.explore_difficulty_hard
    },
)

private fun serviceRes(service: RoutesBrowseOutput.Item.Service): Int = when (service) {
    RoutesBrowseOutput.Item.Service.Water -> R.string.routes_service_water
    RoutesBrowseOutput.Item.Service.Food -> R.string.routes_service_food
    RoutesBrowseOutput.Item.Service.Lodging -> R.string.routes_service_lodging
    RoutesBrowseOutput.Item.Service.Guide -> R.string.routes_service_guide
    RoutesBrowseOutput.Item.Service.Parking -> R.string.routes_service_parking
    RoutesBrowseOutput.Item.Service.Restrooms -> R.string.routes_service_restrooms
}

/** Where a route starts: a rounded-square marker (places are circles), so the two read apart by shape as well as colour. */
@Composable
fun RoutePin(route: EcoRoute, selected: Boolean) {
    val size = if (selected) 44.dp else 32.dp
    val shape = RoundedCornerShape(size * 0.32f)
    Box(Modifier.size(size).background(route.tint, shape).border(2.5.dp, Color.White, shape), Alignment.Center) {
        Icon(route.symbol, contentDescription = null, Modifier.size(if (selected) 22.dp else 16.dp), tint = Color.White)
    }
}

/** Rounded tinted tile with the route's glyph; used in the sheet and in search rows. */
@Composable
fun RouteTile(route: EcoRoute, size: Dp, modifier: Modifier = Modifier) {
    Box(modifier.size(size).background(route.tint.copy(alpha = 0.15f), RoundedCornerShape(size / 4)), Alignment.Center) {
        Icon(route.symbol, contentDescription = null, Modifier.size(size * 0.45f), tint = route.tint)
    }
}

/** A route at a glance: name, where, the three numbers that decide whether to go, and one action. */
@Composable
fun RouteSheet(route: EcoRoute, modifier: Modifier = Modifier) {
    val palette = LocalPalette.current
    val context = LocalContext.current
    Column(
        modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(start = 20.dp, end = 20.dp, top = 4.dp, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            RouteTile(route, 48.dp)
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(route.name, style = MaterialTheme.typography.titleLarge.copy(fontSize = 20.sp, fontWeight = FontWeight.Bold), maxLines = 2, overflow = TextOverflow.Ellipsis)
                Text("${route.categoryName} · ${route.municipalityName}", style = MaterialTheme.typography.bodyMedium, color = palette.textSecondary)
            }
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Stat(stringResource(R.string.routes_distance), route.distanceText(), Modifier.weight(1f))
            Box(Modifier.width(0.5.dp).height(32.dp).background(MaterialTheme.colorScheme.outlineVariant))
            Stat(stringResource(R.string.routes_duration), route.durationText(), Modifier.weight(1f))
            Box(Modifier.width(0.5.dp).height(32.dp).background(MaterialTheme.colorScheme.outlineVariant))
            Stat(stringResource(R.string.routes_difficulty), route.difficultyText(), Modifier.weight(1f))
        }
        route.path.firstOrNull()?.let { start ->
            PrimaryButton(
                text = stringResource(R.string.routes_to_start),
                onClick = {
                    val uri = Uri.parse("https://www.google.com/maps/dir/?api=1&destination=${start.lat},${start.lng}")
                    context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                },
                icon = Icons.Filled.Directions,
                height = 48.dp,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (route.services.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(stringResource(R.string.routes_services), style = MaterialTheme.typography.titleSmall)
                val names = route.services.map { stringResource(serviceRes(it)) }
                Text(
                    names.joinToString(" · "),
                    style = MaterialTheme.typography.bodyMedium,
                    color = palette.textSecondary,
                )
            }
        }
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(palette.inset).padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(Icons.Filled.Warning, contentDescription = null, Modifier.size(18.dp), tint = palette.warningInk)
                Text(stringResource(R.string.routes_safety_title), style = MaterialTheme.typography.titleSmall, color = palette.warningInk)
            }
            Text(stringResource(R.string.routes_safety_body), style = MaterialTheme.typography.bodyMedium, color = palette.textSecondary)
        }
    }
}

@Composable
private fun Stat(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier.semantics(mergeDescendants = true) {},
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(value, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center, maxLines = 1)
        Text(label, style = MaterialTheme.typography.bodySmall, color = LocalPalette.current.textSecondary, maxLines = 1)
    }
}
