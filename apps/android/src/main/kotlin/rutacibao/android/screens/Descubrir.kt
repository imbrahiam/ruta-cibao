package rutacibao.android.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bed
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Hiking
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.ShoppingBasket
import androidx.compose.material.icons.outlined.GridView
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.Route
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import java.util.Locale
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import rutacibao.android.R
import rutacibao.android.app.LocalBarClearance
import rutacibao.android.design.*
import rutacibao.api.generated.PlacesCategoriesItem
import rutacibao.api.generated.RoutesBrowseOutput
import rutacibao.data.DiscoverPlace
import rutacibao.presentation.discover.DiscoverViewModel
import rutacibao.presentation.discover.Shelf
import rutacibao.presentation.discover.ShelfId

@Composable
fun discoverViewModel(): DiscoverViewModel {
    val graph = LocalAppGraph.current
    return rootViewModel("discover") { graph.viewModels.discover() }
}

/**
 * The province to browse without the map: a shortcut per kind of place, the eco routes, and
 * shelves of cards for what you would go out for. Every card opens its place on the map.
 */
@Composable
fun DiscoverScreen(onOpenPlace: (String) -> Unit, onOpenRoute: (String) -> Unit, onOpenCategory: (PlacesCategoriesItem) -> Unit) {
    val vm = discoverViewModel()
    val state by vm.state.collectAsStateWithLifecycle()
    Column(Modifier.fillMaxSize().background(Ink.colors.paper)) {
        RootHeader(stringResource(R.string.discover_title)) {
            Chip(stringResource(R.string.discover_all), state.municipalityId == null, { vm.selectMunicipality(null) }, onBrand = true)
            state.municipalities.forEach { town ->
                Chip(town.name, state.municipalityId == town.id, { vm.selectMunicipality(town.id) }, onBrand = true)
            }
        }
        val error = state.error
        when {
            state.loading && state.shelves.isEmpty() && state.routes.isEmpty() -> DiscoverSkeleton()
            error != null && state.shelves.isEmpty() -> ErrorView(error, Modifier.fillMaxSize(), vm::refresh)
            state.isEmpty -> StateView(
                stringResource(R.string.discover_empty), Modifier.fillMaxSize(), icon = Icons.Outlined.GridView,
                message = stringResource(R.string.discover_empty_body),
            )
            else -> PullToRefreshBox(isRefreshing = state.loading, onRefresh = vm::refresh, modifier = Modifier.weight(1f)) {
                LazyColumn(
                    Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(top = 18.dp, bottom = LocalBarClearance.current + 32.dp),
                    verticalArrangement = Arrangement.spacedBy(30.dp),
                ) {
                    if (state.categories.isNotEmpty()) item("categories") { Categories(state.categories, onOpenCategory, Modifier.rise(0)) }
                    if (state.routes.isNotEmpty()) item("routes") { Routes(state.routes, onOpenRoute, Modifier.rise(1)) }
                    state.shelves.forEachIndexed { index, shelf ->
                        item(shelf.id.name) { ShelfRow(shelf, { onOpenPlace(it.slug) }, Modifier.rise(min(index + 2, 5))) }
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------- sections

/** A section's title: its glyph in the brand's ink, the title, and a line on what is in it. */
@Composable
private fun SectionTitle(title: String, icon: ImageVector? = null, subtitle: String? = null) {
    val p = Ink.colors
    Column(Modifier.padding(horizontal = Metrics.gutter), verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (icon != null) {
                Box(Modifier.size(28.dp).background(p.brandSoft, CircleShape), Alignment.Center) { Icon(icon, null, Modifier.size(15.dp), tint = p.brandDeep) }
            }
            Text(title, style = Type.title, color = p.ink, modifier = Modifier.semantics { heading() })
        }
        if (subtitle != null) Text(subtitle, style = Type.callout, color = p.ink3)
    }
}

@Composable
private fun Categories(categories: List<PlacesCategoriesItem>, onOpen: (PlacesCategoriesItem) -> Unit, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionTitle(stringResource(R.string.discover_categories))
        LazyRow(contentPadding = PaddingValues(horizontal = Metrics.gutter), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            items(categories, key = { it.id }) { category -> CategoryTile(category) { onOpen(category) } }
        }
    }
}

/** A kind of place: its glyph on a soft wash of its own colour, and its name. */
@Composable
private fun CategoryTile(category: PlacesCategoriesItem, onClick: () -> Unit) {
    val p = Ink.colors
    val tone = parseCategoryColor(category.color, p.brand)
    Column(
        Modifier.width(80.dp).clip(RoundedCornerShape(14.dp)).pressable(onClick = onClick).semantics(mergeDescendants = true) {}.padding(vertical = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        Box(Modifier.size(58.dp).background(tone.copy(alpha = 0.13f), CircleShape), Alignment.Center) {
            Icon(categoryIcon(category.icon), null, Modifier.size(24.dp), tint = tone)
        }
        Text(
            category.name, style = Type.caption.copy(fontSize = 12.5.sp, fontWeight = FontWeight.Medium), color = p.ink,
            maxLines = 2, textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
    }
}

@Composable
private fun Routes(routes: List<RoutesBrowseOutput.Item>, onOpen: (String) -> Unit, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionTitle(stringResource(R.string.discover_routes), Icons.Filled.Hiking, stringResource(R.string.discover_routes_body))
        LazyRow(contentPadding = PaddingValues(horizontal = Metrics.gutter), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            items(routes, key = { it.id }) { route -> RouteCard(route) { onOpen(route.id) } }
        }
    }
}

private val ShelfId.title: Int
    get() = when (this) {
        ShelfId.Todo -> R.string.discover_todo
        ShelfId.Eat -> R.string.discover_eat
        ShelfId.Shop -> R.string.discover_shop
        ShelfId.Stay -> R.string.discover_stay
        ShelfId.Services -> R.string.discover_services
    }

private val ShelfId.icon: ImageVector
    get() = when (this) {
        ShelfId.Todo -> Icons.Filled.AutoAwesome
        ShelfId.Eat -> Icons.Filled.Restaurant
        ShelfId.Shop -> Icons.Filled.ShoppingBasket
        ShelfId.Stay -> Icons.Filled.Bed
        ShelfId.Services -> Icons.Filled.Build
    }

@Composable
private fun ShelfRow(shelf: Shelf, onOpen: (DiscoverPlace) -> Unit, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionTitle(stringResource(shelf.id.title), shelf.id.icon)
        LazyRow(contentPadding = PaddingValues(horizontal = Metrics.gutter), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            items(shelf.places, key = { it.id }) { place -> DiscoverCard(place) { onOpen(place) } }
        }
    }
}

// ---------------------------------------------------------------- cards

/** A place's picture, or its glyph on its colour when there is none. */
@Composable
private fun PlacePicture(place: DiscoverPlace, modifier: Modifier = Modifier, glyph: Int = 34) {
    val tone = parseCategoryColor(place.categoryColor, Ink.colors.brand)
    Box(modifier.background(tone.copy(alpha = 0.14f)), Alignment.Center) {
        Icon(categoryIcon(place.categoryIcon), null, Modifier.size(glyph.dp), tint = tone.copy(alpha = 0.7f))
        if (place.imageUrl != null) AsyncImage(model = place.imageUrl, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.matchParentSize())
    }
}

/** The kind of place beside the other place details. */
@Composable
private fun KindChip(place: DiscoverPlace, modifier: Modifier = Modifier) {
    val p = Ink.colors
    Row(
        modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Icon(categoryIcon(place.categoryIcon), null, Modifier.size(12.dp), tint = parseCategoryColor(place.categoryColor, p.brand))
        Text(place.categoryName, style = Type.caption.copy(fontSize = 12.sp, fontWeight = FontWeight.SemiBold), color = p.ink, maxLines = 1)
    }
}

@Composable
private fun DiscoverCard(place: DiscoverPlace, onClick: () -> Unit) {
    val p = Ink.colors
    Column(Modifier.width(228.dp).clip(RoundedCornerShape(Metrics.radiusCard)).pressable(scale = 0.98f, onClick = onClick).semantics(mergeDescendants = true) {}) {
        Box(Modifier.size(228.dp, 152.dp).clip(RoundedCornerShape(Metrics.radiusCard))) {
            PlacePicture(place, Modifier.matchParentSize())
        }
        Text(place.name, style = Type.bodyStrong, color = p.ink, maxLines = 2, modifier = Modifier.padding(top = 10.dp))
        KindChip(place, Modifier.padding(top = 3.dp))
        Row(Modifier.padding(top = 3.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Icon(Icons.Outlined.Place, null, Modifier.size(14.dp), tint = p.ink3)
            Text(place.municipalityName, style = Type.callout.copy(fontSize = 13.sp, fontWeight = FontWeight.Medium), color = p.ink3, maxLines = 1)
        }
    }
}

@Composable
private fun RoutesBrowseOutput.Item.difficultyTitle(): String = stringResource(
    when (difficulty) {
        RoutesBrowseOutput.Item.Difficulty.Easy -> R.string.discover_difficulty_easy
        RoutesBrowseOutput.Item.Difficulty.Moderate -> R.string.discover_difficulty_moderate
        RoutesBrowseOutput.Item.Difficulty.Hard -> R.string.discover_difficulty_hard
    },
)

private val RoutesBrowseOutput.Item.difficultyTint: Color
    @Composable get() = when (difficulty) {
        RoutesBrowseOutput.Item.Difficulty.Easy -> Ink.colors.success
        RoutesBrowseOutput.Item.Difficulty.Moderate -> Color(0xFFA9740F)
        RoutesBrowseOutput.Item.Difficulty.Hard -> Color(0xFFC0623A)
    }

/** An eco route: its line drawn over contours, how hard it is, and how long and far. */
@Composable
private fun RouteCard(route: RoutesBrowseOutput.Item, onClick: () -> Unit) {
    val p = Ink.colors
    Column(
        Modifier.width(300.dp).clip(RoundedCornerShape(Metrics.radiusCard)).background(p.paper2)
            .pressable(scale = 0.98f, onClick = onClick).semantics(mergeDescendants = true) {},
    ) {
        Box(Modifier.fillMaxWidth().height(140.dp)) {
            RouteSketch(route.path, Modifier.matchParentSize())
            Row(
                Modifier.padding(10.dp).height(26.dp).background(p.paper, CircleShape).padding(horizontal = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Box(Modifier.size(8.dp).background(route.difficultyTint, CircleShape))
                Text(route.difficultyTitle(), style = Type.caption.copy(fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold), color = p.ink)
            }
        }
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(route.name, style = Type.heading, color = p.ink, maxLines = 2)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                MetaTag(Icons.Outlined.Schedule, stringResource(R.string.discover_minutes, route.durationMinutes.toInt().toString()))
                MetaTag(Icons.Outlined.Route, stringResource(R.string.discover_km, String.format(Locale.forLanguageTag("es-DO"), "%.1f", route.distanceMeters / 1000)))
            }
            MetaTag(Icons.Outlined.Place, route.municipalityName)
        }
    }
}

/** The route's line, fitted into the card over faint contour lines, with its start and end. */
@Composable
private fun RouteSketch(path: List<RoutesBrowseOutput.Item.PathItem>, modifier: Modifier = Modifier) {
    val p = Ink.colors
    Canvas(modifier.background(p.brandSoft)) {
        for (index in 0 until 7) {
            val y = size.height * (0.1f + index * 0.14f)
            val line = Path().apply {
                moveTo(-10f, y)
                cubicTo(size.width * 0.35f, y - 22.dp.toPx(), size.width * 0.7f, y + 18.dp.toPx(), size.width + 10f, y - 10.dp.toPx())
            }
            drawPath(line, p.brand.copy(alpha = 0.12f), style = Stroke(1.dp.toPx()))
        }
        if (path.size < 2) return@Canvas
        val latitude = path[0].lat * PI / 180
        val xs = path.map { it.lng * cos(latitude) }
        val ys = path.map { it.lat }
        val minX = xs.min(); val maxX = xs.max(); val minY = ys.min(); val maxY = ys.max()
        val pad = 26.dp.toPx()
        val scale = min((size.width - pad * 2) / max(maxX - minX, 1e-9), (size.height - pad * 2) / max(maxY - minY, 1e-9))
        val offX = (size.width - (maxX - minX) * scale) / 2
        val offY = (size.height - (maxY - minY) * scale) / 2
        val points = xs.indices.map { i -> Offset(((xs[i] - minX) * scale + offX).toFloat(), (size.height - ((ys[i] - minY) * scale + offY)).toFloat()) }
        val trail = Path().apply {
            moveTo(points[0].x, points[0].y)
            points.drop(1).forEach { lineTo(it.x, it.y) }
        }
        drawPath(trail, Color.White, style = Stroke(8.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
        drawPath(trail, p.brand, style = Stroke(4.5.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
        drawCircle(Color.White, 7.dp.toPx(), points.first())
        drawCircle(p.brand, 4.dp.toPx(), points.first(), style = Stroke(3.dp.toPx()))
        drawCircle(p.brand, 6.5.dp.toPx(), points.last())
    }
}

/** Every place of one kind, as a list of cards. */
@Composable
fun DiscoverCategoryScreen(categoryId: String, onBack: () -> Unit, onOpenPlace: (String) -> Unit) {
    val vm = discoverViewModel()
    val state by vm.state.collectAsStateWithLifecycle()
    val category = state.categories.firstOrNull { it.id == categoryId }
    val p = Ink.colors
    LaunchedEffect(category?.id) { category?.let(vm::openCategory) }
    DisposableEffect(Unit) { onDispose { vm.closeCategory() } }
    val places = if (state.category?.id == categoryId) state.categoryPlaces else null
    Column(Modifier.fillMaxSize().background(p.paper)) {
        TopRow(category?.name.orEmpty(), onBack)
        if (places == null) {
            CategorySkeleton()
        } else if (places.isEmpty()) {
            StateView(
                stringResource(R.string.discover_empty), Modifier.fillMaxWidth().height(300.dp),
                icon = category?.let { categoryIcon(it.icon) }, message = stringResource(R.string.discover_empty_body),
            )
        } else {
            LazyColumn(
                Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = Metrics.gutter, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                item { Text(pluralStringResource(R.plurals.discover_count, places.size, places.size), style = Type.callout, color = p.ink3) }
                items(places, key = { it.id }) { place ->
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(Metrics.radiusCard)).background(p.paper2)
                            .pressable(scale = 0.98f) { onOpenPlace(place.slug) }.semantics(mergeDescendants = true) {}.padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(14.dp),
                    ) {
                        PlacePicture(place, Modifier.size(84.dp).clip(RoundedCornerShape(14.dp)), glyph = 28)
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(place.name, style = Type.bodyStrong, color = p.ink, maxLines = 2)
                            KindChip(place)
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                Icon(Icons.Outlined.Place, null, Modifier.size(14.dp), tint = p.ink3)
                                Text(place.municipalityName, style = Type.callout.copy(fontSize = 13.sp, fontWeight = FontWeight.Medium), color = p.ink3, maxLines = 1)
                            }
                        }
                        Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, null, Modifier.size(18.dp), tint = p.ink4)
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------- loading

/** The page as it will land: the shortcuts, two route cards and a shelf, under their real titles. */
@Composable
private fun DiscoverSkeleton() {
    Column(Modifier.fillMaxSize().padding(top = 18.dp), verticalArrangement = Arrangement.spacedBy(30.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            SectionTitle(stringResource(R.string.discover_categories))
            Skeleton {
                Row(Modifier.padding(horizontal = Metrics.gutter), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    repeat(6) {
                        Column(Modifier.width(80.dp).padding(vertical = 4.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(7.dp)) {
                            Bone(Modifier.size(58.dp))
                            Box(Modifier.height(32.dp)) { BoneLine(50.dp, lineHeight = 15.dp, barHeight = 9.dp) }
                        }
                    }
                }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            SectionTitle(stringResource(R.string.discover_routes), Icons.Filled.Hiking, stringResource(R.string.discover_routes_body))
            Skeleton {
                Row(Modifier.padding(horizontal = Metrics.gutter), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    repeat(2) {
                        Column(Modifier.width(300.dp).clip(RoundedCornerShape(Metrics.radiusCard)).background(Ink.colors.paper2)) {
                            Box(Modifier.fillMaxWidth().height(140.dp)) {
                                Bone(Modifier.matchParentSize(), RoundedCornerShape(0.dp))
                                Box(Modifier.padding(10.dp).size(88.dp, 26.dp).background(Ink.colors.paper3, CircleShape))
                            }
                            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                BoneLine(164.dp, lineHeight = 20.dp)
                                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { listOf(76, 68, 78).forEach { Bone(Modifier.size(it.dp, 28.dp)) } }
                            }
                        }
                    }
                }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            SectionTitle(stringResource(R.string.discover_todo))
            Skeleton {
                Row(Modifier.padding(horizontal = Metrics.gutter), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    repeat(2) {
                        Column(Modifier.width(228.dp)) {
                            Bone(Modifier.size(228.dp, 152.dp), RoundedCornerShape(Metrics.radiusCard))
                            Spacer(Modifier.height(10.dp))
                            BoneLine(160.dp)
                            Spacer(Modifier.height(3.dp))
                            BoneLine(76.dp, lineHeight = 16.dp, barHeight = 10.dp)
                            Spacer(Modifier.height(3.dp))
                            BoneLine(92.dp, lineHeight = 16.dp, barHeight = 10.dp)
                        }
                    }
                }
            }
        }
    }
}

/** A category's list on its way: cards with the picture and two lines. */
@Composable
private fun CategorySkeleton() {
    Skeleton {
        Column(Modifier.padding(horizontal = Metrics.gutter, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            BoneLine(90.dp, lineHeight = 18.dp, barHeight = 11.dp)
            repeat(4) {
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(Metrics.radiusCard)).background(Ink.colors.paper2).padding(10.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    Bone(Modifier.size(84.dp), RoundedCornerShape(14.dp))
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        BoneLine(170.dp)
                        BoneLine(96.dp, lineHeight = 18.dp, barHeight = 11.dp)
                    }
                }
            }
        }
    }
}
