package rutacibao.android.design

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountBalance
import androidx.compose.material.icons.outlined.Build
import androidx.compose.material.icons.outlined.Church
import androidx.compose.material.icons.outlined.Business
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Coffee
import androidx.compose.material.icons.outlined.Dangerous
import androidx.compose.material.icons.outlined.DirectionsBus
import androidx.compose.material.icons.outlined.DirectionsCar
import androidx.compose.material.icons.automirrored.outlined.DirectionsWalk
import androidx.compose.material.icons.outlined.Grass
import androidx.compose.material.icons.outlined.Hotel
import androidx.compose.material.icons.outlined.Lightbulb
import androidx.compose.material.icons.outlined.LocalGasStation
import androidx.compose.material.icons.outlined.LocalHospital
import androidx.compose.material.icons.outlined.Medication
import androidx.compose.material.icons.outlined.PedalBike
import androidx.compose.material.icons.outlined.Park
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.Restaurant
import androidx.compose.material.icons.outlined.School
import androidx.compose.material.icons.outlined.ShoppingBasket
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material.icons.outlined.Waves
import androidx.compose.material.icons.outlined.WaterDrop
import androidx.compose.material.icons.automirrored.outlined.AltRoute
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.dp
import androidx.compose.ui.graphics.vector.ImageVector

/** Lucide names come from the database; map to the nearest Material glyph. */
fun categoryIcon(name: String): ImageVector = when (name) {
    "droplets" -> Icons.Outlined.WaterDrop
    "landmark" -> Icons.Outlined.AccountBalance
    "wrench" -> Icons.Outlined.Build
    "waves" -> Icons.Outlined.Waves
    "utensils" -> Icons.Outlined.Restaurant
    "triangle-alert" -> Icons.Outlined.Warning
    "trees" -> Icons.Outlined.Park
    "shopping-basket" -> Icons.Outlined.ShoppingBasket
    "route" -> Icons.AutoMirrored.Outlined.AltRoute
    "pill" -> Icons.Outlined.Medication
    "octagon-x" -> Icons.Outlined.Dangerous
    "lightbulb" -> Icons.Outlined.Lightbulb
    "graduation-cap" -> Icons.Outlined.School
    "fuel" -> Icons.Outlined.LocalGasStation
    "footprints" -> Icons.AutoMirrored.Outlined.DirectionsWalk
    "cross" -> Icons.Outlined.LocalHospital
    "coffee" -> Icons.Outlined.Coffee
    "cloud-rain" -> CloudRain
    "church" -> Icons.Outlined.Church
    "car" -> Icons.Outlined.DirectionsCar
    "bus" -> Icons.Outlined.DirectionsBus
    "bike" -> Icons.Outlined.PedalBike
    "bed-double" -> Icons.Outlined.Hotel
    "wheat" -> Icons.Outlined.Grass
    "trash-2" -> Icons.Outlined.Delete
    "building-2" -> Icons.Outlined.Business
    else -> Icons.Outlined.Place
}

/** Category colours are data (admin-editable hex); fall back to neutral if malformed. */
fun parseCategoryColor(hex: String, fallback: Color): Color = runCatching {
    Color(android.graphics.Color.parseColor(hex))
}.getOrDefault(fallback)

/** Material has no rain cloud; this matches SF Symbols' cloud.rain.fill. */
private val CloudRain: ImageVector by lazy {
    ImageVector.Builder("CloudRain", 24.dp, 24.dp, 24f, 24f).apply {
        addPath(
            PathParser().parsePathString("M6.5 15a4.5 4.5 0 0 1-.4-8.98A6 6 0 0 1 17.6 7.2 4 4 0 0 1 17.5 15z").toNodes(),
            fill = SolidColor(Color.Black),
        )
        addPath(
            PathParser().parsePathString("M7.6 16.5h1.5l-1.7 4.5H5.9zM12.6 16.5h1.5l-1.7 4.5h-1.5zM17.6 16.5h1.5l-1.7 4.5h-1.5z").toNodes(),
            fill = SolidColor(Color.Black),
        )
    }.build()
}
