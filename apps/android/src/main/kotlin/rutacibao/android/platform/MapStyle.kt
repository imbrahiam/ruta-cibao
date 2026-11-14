package rutacibao.android.platform

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import com.google.android.gms.maps.model.MapStyleOptions
import rutacibao.android.generated.RutaTheme
import rutacibao.android.generated.rutaMapPalette

/** Calm basemap: no POIs, no transit, muted colour, so our places carry the map. */
private fun LIGHT(natural: String) = """[
{"featureType":"poi","stylers":[{"visibility":"off"}]},
{"featureType":"poi","elementType":"labels","stylers":[{"visibility":"off"}]},
{"featureType":"poi.business","stylers":[{"visibility":"off"}]},
{"featureType":"poi.school","stylers":[{"visibility":"off"}]},
{"featureType":"poi.government","stylers":[{"visibility":"off"}]},
{"featureType":"poi.medical","stylers":[{"visibility":"off"}]},
{"featureType":"poi.attraction","stylers":[{"visibility":"off"}]},
{"featureType":"poi.place_of_worship","stylers":[{"visibility":"off"}]},
{"featureType":"poi.sports_complex","stylers":[{"visibility":"off"}]},
{"featureType":"transit","stylers":[{"visibility":"off"}]},
{"featureType":"landscape","stylers":[{"saturation":-70},{"lightness":10}]},
{"featureType":"landscape.natural","elementType":"geometry","stylers":[{"color":"$natural"}]},
{"featureType":"water","stylers":[{"saturation":-50},{"lightness":15}]},
{"featureType":"road","elementType":"geometry","stylers":[{"saturation":-90},{"lightness":25}]},
{"featureType":"road","elementType":"labels.icon","stylers":[{"visibility":"off"}]},
{"featureType":"administrative","elementType":"geometry.stroke","stylers":[{"color":"#c9c6bb"}]}
]"""

private fun DARK(natural: String) = """[
{"elementType":"geometry","stylers":[{"color":"#1c1c1a"}]},
{"elementType":"labels.text.fill","stylers":[{"color":"#a8a59c"}]},
{"elementType":"labels.text.stroke","stylers":[{"color":"#121211"}]},
{"featureType":"poi","stylers":[{"visibility":"off"}]},
{"featureType":"poi","elementType":"labels","stylers":[{"visibility":"off"}]},
{"featureType":"poi.business","stylers":[{"visibility":"off"}]},
{"featureType":"poi.school","stylers":[{"visibility":"off"}]},
{"featureType":"poi.government","stylers":[{"visibility":"off"}]},
{"featureType":"poi.medical","stylers":[{"visibility":"off"}]},
{"featureType":"poi.attraction","stylers":[{"visibility":"off"}]},
{"featureType":"poi.place_of_worship","stylers":[{"visibility":"off"}]},
{"featureType":"poi.sports_complex","stylers":[{"visibility":"off"}]},
{"featureType":"transit","stylers":[{"visibility":"off"}]},
{"featureType":"road","elementType":"geometry","stylers":[{"color":"#2c2c29"}]},
{"featureType":"road","elementType":"labels.icon","stylers":[{"visibility":"off"}]},
{"featureType":"road.highway","elementType":"geometry","stylers":[{"color":"#3a3a36"}]},
{"featureType":"water","elementType":"geometry","stylers":[{"color":"#101a22"}]},
{"featureType":"landscape.natural","elementType":"geometry","stylers":[{"color":"$natural"}]},
{"featureType":"administrative","elementType":"geometry.stroke","stylers":[{"color":"#3a3a36"}]}
]"""

private fun Color.hex() = "#%06x".format(toArgb() and 0xFFFFFF)

/** The vegetation green comes from the shared map palette, so it matches the other platforms. */
fun calmMapStyle(dark: Boolean): MapStyleOptions {
    val natural = rutaMapPalette(RutaTheme.Clasico, dark).natural.hex()
    return MapStyleOptions(if (dark) DARK(natural) else LIGHT(natural))
}
