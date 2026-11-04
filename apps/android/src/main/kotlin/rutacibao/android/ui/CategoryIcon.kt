package rutacibao.android.ui

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Church
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.Cloud
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
    "cloud-rain" -> Icons.Filled.Cloud
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
