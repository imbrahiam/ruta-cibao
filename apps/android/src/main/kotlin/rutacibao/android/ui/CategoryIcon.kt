package rutacibao.android.ui

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Church
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Coffee
import androidx.compose.material.icons.filled.Dangerous
import androidx.compose.material.icons.filled.DirectionsBus
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.DirectionsWalk
import androidx.compose.material.icons.filled.Grass
import androidx.compose.material.icons.filled.Hotel
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.LocalGasStation
import androidx.compose.material.icons.filled.LocalHospital
import androidx.compose.material.icons.filled.Medication
import androidx.compose.material.icons.filled.PedalBike
import androidx.compose.material.icons.filled.Park
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.ShoppingBasket
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.Waves
import androidx.compose.material.icons.filled.WaterDrop
import androidx.compose.material.icons.filled.AltRoute
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.dp
import androidx.compose.ui.graphics.vector.ImageVector

/** Lucide names come from the database; map to the nearest Material glyph. */
fun categoryIcon(name: String): ImageVector = when (name) {
    "droplets" -> Icons.Filled.WaterDrop
    "landmark" -> Icons.Filled.AccountBalance
    "wrench" -> Icons.Filled.Build
    "waves" -> Icons.Filled.Waves
    "utensils" -> Icons.Filled.Restaurant
    "triangle-alert" -> Icons.Filled.Warning
    "trees" -> Icons.Filled.Park
    "shopping-basket" -> Icons.Filled.ShoppingBasket
    "route" -> Icons.Filled.AltRoute
    "pill" -> Icons.Filled.Medication
    "octagon-x" -> Icons.Filled.Dangerous
    "lightbulb" -> Icons.Filled.Lightbulb
    "graduation-cap" -> Icons.Filled.School
    "fuel" -> Icons.Filled.LocalGasStation
    "footprints" -> Icons.Filled.DirectionsWalk
    "cross" -> Icons.Filled.LocalHospital
    "coffee" -> Icons.Filled.Coffee
    "cloud-rain" -> CloudRain
    "church" -> Icons.Filled.Church
    "car" -> Icons.Filled.DirectionsCar
    "bus" -> Icons.Filled.DirectionsBus
    "bike" -> Icons.Filled.PedalBike
    "bed-double" -> Icons.Filled.Hotel
    "wheat" -> Icons.Filled.Grass
    "trash-2" -> Icons.Filled.Delete
    "building-2" -> Icons.Filled.Business
    else -> Icons.Filled.Place
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
