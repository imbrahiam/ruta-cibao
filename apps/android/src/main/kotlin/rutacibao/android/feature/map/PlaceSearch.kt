package rutacibao.android.feature.map

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import java.text.Normalizer
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.Hiking
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.sp
import rutacibao.android.ui.categoryIcon
import rutacibao.android.ui.parseCategoryColor
import rutacibao.presentation.map.MapCategory
import rutacibao.android.R
import rutacibao.android.ui.CategoryAvatar
import rutacibao.android.ui.Hairline
import rutacibao.android.ui.LocalPalette
import rutacibao.android.ui.MessageState
import rutacibao.data.MapPlace

private val Diacritics = Regex("\\p{Mn}+")

private fun fold(text: String): String =
    Normalizer.normalize(text, Normalizer.Form.NFD).replace(Diacritics, "").lowercase()

private sealed interface Scope {
    data object All : Scope
    data object Routes : Scope
    data class Category(val id: String) : Scope
}

/**
 * Full-screen search that works before you type: scopes (everything, routes, each category) and the list
 * under them, routes first. Typing narrows by name, category or municipality, ignoring accents and case.
 */
@Composable
fun PlaceSearch(
    places: List<MapPlace>,
    routes: List<EcoRoute>,
    categories: List<MapCategory>,
    municipalities: Map<String, String>,
    onDismiss: () -> Unit,
    onPickPlace: (MapPlace) -> Unit,
    onPickRoute: (EcoRoute) -> Unit,
) {
    var query by remember { mutableStateOf("") }
    var scope by remember { mutableStateOf<Scope>(Scope.All) }
    val palette = LocalPalette.current
    val routeResults = remember(query, scope, routes) {
        if (scope != Scope.All && scope != Scope.Routes) return@remember emptyList()
        val q = fold(query.trim())
        val matches = if (q.isEmpty()) routes else routes.filter {
            fold(it.name).contains(q) || fold(it.categoryName).contains(q) || fold(it.municipalityName).contains(q)
        }
        matches.sortedBy { fold(it.name) }
    }
    val placeResults = remember(query, scope, places, municipalities) {
        val scoped = when (val sc = scope) {
            Scope.All -> places
            Scope.Routes -> emptyList()
            is Scope.Category -> places.filter { it.categoryId == sc.id }
        }
        val q = fold(query.trim())
        val matches = if (q.isEmpty()) scoped else scoped.filter {
            fold(it.name).contains(q) || fold(it.categoryName).contains(q) || fold(municipalities[it.municipalityId].orEmpty()).contains(q)
        }
        matches.sortedBy { fold(it.name) }
    }
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { focus.requestFocus() }
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            Column(Modifier.fillMaxSize().androidxSystemBars()) {
                Row(Modifier.padding(horizontal = 4.dp, vertical = 4.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.common_back))
                    }
                    TextField(
                        value = query,
                        onValueChange = { query = it },
                        placeholder = { Text(stringResource(R.string.search_placeholder)) },
                        leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                        colors = TextFieldDefaults.colors(
                            focusedContainerColor = palette.inset,
                            unfocusedContainerColor = palette.inset,
                            focusedIndicatorColor = androidx.compose.ui.graphics.Color.Transparent,
                            unfocusedIndicatorColor = androidx.compose.ui.graphics.Color.Transparent,
                        ),
                        shape = androidx.compose.foundation.shape.CircleShape,
                        modifier = Modifier.fillMaxWidth().focusRequester(focus),
                    )
                }
                ScopeChips(scope, routes.isNotEmpty(), categories) { scope = it }
                if (routeResults.isEmpty() && placeResults.isEmpty()) {
                    MessageState(
                        title = stringResource(R.string.search_empty_title),
                        body = stringResource(R.string.search_empty_body),
                        icon = Icons.Filled.Search,
                    )
                } else {
                    LazyColumn(Modifier.fillMaxSize()) {
                        if (routeResults.isNotEmpty()) {
                            if (scope == Scope.All) item(key = "h-routes") { SectionTitle(stringResource(R.string.map_routes)) }
                            items(routeResults, key = { "route:${it.id}" }) { route ->
                                val subtitle = "${route.categoryName} · ${route.municipalityName} · ${route.distanceText()}"
                                ResultRow(route.name, subtitle, { onPickRoute(route) }) { RouteTile(route, 36.dp) }
                            }
                        }
                        if (placeResults.isNotEmpty()) {
                            if (scope == Scope.All && routeResults.isNotEmpty()) item(key = "h-places") { SectionTitle(stringResource(R.string.search_places)) }
                            items(placeResults, key = { it.id }) { place ->
                                val subtitle = listOfNotNull(place.categoryName, municipalities[place.municipalityId]).joinToString(" · ")
                                ResultRow(place.name, subtitle, { onPickPlace(place) }) { CategoryAvatar(place.icon, place.color, 36.dp) }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.titleSmall,
        modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 4.dp).semantics { heading() },
    )
}

@Composable
private fun ResultRow(title: String, subtitle: String, onClick: () -> Unit, leading: @Composable () -> Unit) {
    Row(
        Modifier.fillMaxWidth().defaultMinSize(minHeight = 56.dp).clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
    ) {
        leading()
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = LocalPalette.current.textTertiary, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
    Hairline(Modifier.padding(start = 64.dp))
}

/** The scopes as one row of chips: "Todo" (ink when selected), "Rutas", then each category. */
@Composable
private fun ScopeChips(scope: Scope, hasRoutes: Boolean, categories: List<MapCategory>, onScope: (Scope) -> Unit) {
    val scheme = MaterialTheme.colorScheme
    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        item(key = "all") {
            ScopeChip(stringResource(R.string.search_all), Icons.Filled.GridView, scheme.onSurface, scope == Scope.All, scheme.surface) { onScope(Scope.All) }
        }
        if (hasRoutes) {
            item(key = "routes") {
                ScopeChip(stringResource(R.string.map_routes), Icons.Filled.Hiking, Color(0xFF2F9E44), scope == Scope.Routes) {
                    onScope(if (scope == Scope.Routes) Scope.All else Scope.Routes)
                }
            }
        }
        items(categories, key = { it.id }) { category ->
            val color = parseCategoryColor(category.color, scheme.onSurface)
            val me = Scope.Category(category.id)
            ScopeChip(category.name, categoryIcon(category.icon), color, scope == me) { onScope(if (scope == me) Scope.All else me) }
        }
    }
}

@Composable
private fun ScopeChip(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    color: Color,
    selected: Boolean,
    onColor: Color = if (color.luminance() > 0.5f) Color.Black else Color.White,
    onClick: () -> Unit,
) {
    val scheme = MaterialTheme.colorScheme
    Box(Modifier.height(48.dp).selectable(selected = selected, role = Role.RadioButton, onClick = onClick), contentAlignment = androidx.compose.ui.Alignment.Center) {
        Surface(
            shape = CircleShape,
            color = if (selected) color else scheme.surfaceContainer,
            border = if (selected) null else BorderStroke(0.5.dp, scheme.outlineVariant),
        ) {
            Row(
                Modifier.height(36.dp).padding(horizontal = 12.dp),
                verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Icon(icon, contentDescription = null, Modifier.size(16.dp), tint = if (selected) onColor else color)
                Text(
                    label,
                    style = MaterialTheme.typography.labelLarge.copy(fontSize = 13.sp, fontWeight = FontWeight.SemiBold),
                    color = if (selected) onColor else scheme.onSurface,
                    maxLines = 1,
                )
            }
        }
    }
}

@Composable
private fun Modifier.androidxSystemBars(): Modifier =
    this.then(Modifier.windowInsetsPadding(androidx.compose.foundation.layout.WindowInsets.safeDrawing))
