package rutacibao.android.feature.map

import com.google.android.gms.maps.model.MapStyleOptions

/** Calm basemap: no POIs, no transit, muted colour, so our places carry the map. */
private const val LIGHT = """[
{"featureType":"poi","stylers":[{"visibility":"off"}]},
{"featureType":"transit","stylers":[{"visibility":"off"}]},
{"featureType":"landscape","stylers":[{"saturation":-70},{"lightness":10}]},
{"featureType":"water","stylers":[{"saturation":-50},{"lightness":15}]},
{"featureType":"road","elementType":"geometry","stylers":[{"saturation":-90},{"lightness":25}]},
{"featureType":"road","elementType":"labels.icon","stylers":[{"visibility":"off"}]},
{"featureType":"administrative","elementType":"geometry.stroke","stylers":[{"color":"#c9c6bb"}]}
]"""

private const val DARK = """[
{"elementType":"geometry","stylers":[{"color":"#1c1c1a"}]},
{"elementType":"labels.text.fill","stylers":[{"color":"#a8a59c"}]},
{"elementType":"labels.text.stroke","stylers":[{"color":"#121211"}]},
{"featureType":"poi","stylers":[{"visibility":"off"}]},
{"featureType":"transit","stylers":[{"visibility":"off"}]},
{"featureType":"road","elementType":"geometry","stylers":[{"color":"#2c2c29"}]},
{"featureType":"road","elementType":"labels.icon","stylers":[{"visibility":"off"}]},
{"featureType":"road.highway","elementType":"geometry","stylers":[{"color":"#3a3a36"}]},
{"featureType":"water","elementType":"geometry","stylers":[{"color":"#101a22"}]},
{"featureType":"landscape.natural","elementType":"geometry","stylers":[{"color":"#1a1f1a"}]},
{"featureType":"administrative","elementType":"geometry.stroke","stylers":[{"color":"#3a3a36"}]}
]"""

fun calmMapStyle(dark: Boolean): MapStyleOptions = MapStyleOptions(if (dark) DARK else LIGHT)
