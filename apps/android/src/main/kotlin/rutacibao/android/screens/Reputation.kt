package rutacibao.android.screens

import android.Manifest
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.ContactsContract
import android.provider.Settings
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Forum
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.outlined.MenuBook
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.ClipEntry
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import androidx.core.content.ContextCompat
import coil3.compose.AsyncImage
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import rutacibao.android.R
import rutacibao.android.design.*
import rutacibao.presentation.account.BadgeId
import rutacibao.presentation.account.BadgeProgress
import rutacibao.presentation.account.ContributionKind
import rutacibao.presentation.account.Person
import rutacibao.presentation.account.RankId
import rutacibao.presentation.account.RankStep
import rutacibao.presentation.account.Redeem
import rutacibao.presentation.account.RedeemError
import rutacibao.presentation.account.Reputation

// ---------------------------------------------------------------- ranks: a personality each

/*
 * Each rank has its own emblem and colour, so the level never borrows the verification's check:
 * a house for the neighbour, a globe with a lens for the explorer, a compass for the guide and
 * a medal for the legend.
 */

@Composable
fun RankId.title(): String = stringResource(
    when (this) {
        RankId.Vecino -> R.string.reputation_rank_vecino
        RankId.Explorador -> R.string.reputation_rank_explorador
        RankId.Guia -> R.string.reputation_rank_guia
        RankId.Leyenda -> R.string.reputation_rank_leyenda
    },
)

@Composable
private fun RankId.line(): String = stringResource(
    when (this) {
        RankId.Vecino -> R.string.reputation_rank_line_vecino
        RankId.Explorador -> R.string.reputation_rank_line_explorador
        RankId.Guia -> R.string.reputation_rank_line_guia
        RankId.Leyenda -> R.string.reputation_rank_line_leyenda
    },
)

val RankId.icon: ImageVector
    get() = when (this) {
        RankId.Vecino -> Icons.Filled.Home
        RankId.Explorador -> Icons.Filled.TravelExplore
        RankId.Guia -> Icons.Filled.Explore
        RankId.Leyenda -> Icons.Filled.WorkspacePremium
    }

val RankId.tint: Color
    get() = when (this) {
        RankId.Vecino -> Color(0xFFC0623A)
        RankId.Explorador -> Color(0xFFA9740F)
        RankId.Guia -> Color(0xFF28594A)
        RankId.Leyenda -> Color(0xFF6A4A9E)
    }

/** A rank's emblem: its symbol on its colour, with a white ring when it sits on something. */
@Composable
fun RankEmblem(rank: RankId, size: Dp = 40.dp, reached: Boolean = true, ring: Boolean = false) {
    val p = Ink.colors
    Box(
        Modifier.size(size)
            .then(if (ring) Modifier.background(p.paper, CircleShape).padding(size * 0.08f) else Modifier)
            .clip(CircleShape).background(if (reached) rank.tint else p.paper)
            .then(if (!reached) Modifier.border(1.5.dp, p.ink4.copy(alpha = 0.6f), CircleShape) else Modifier)
            .clearAndSetSemantics {},
        Alignment.Center,
    ) { Icon(rank.icon, null, Modifier.size(size * 0.46f), tint = if (reached) Color.White else p.ink4) }
}

// ---------------------------------------------------------------- badges: names and glyphs

@Composable
private fun BadgeId.title(): String = stringResource(
    when (this) {
        BadgeId.FirstContribution -> R.string.reputation_badge_first_contribution_title
        BadgeId.Traveller -> R.string.reputation_badge_traveller_title
        BadgeId.ThreeTowns -> R.string.reputation_badge_three_towns_title
        BadgeId.Watchful -> R.string.reputation_badge_watchful_title
        BadgeId.CivicVoice -> R.string.reputation_badge_civic_voice_title
        BadgeId.RoadWatch -> R.string.reputation_badge_road_watch_title
        BadgeId.Host -> R.string.reputation_badge_host_title
    },
)

@Composable
private fun BadgeId.how(): String = stringResource(
    when (this) {
        BadgeId.FirstContribution -> R.string.reputation_badge_first_contribution_how
        BadgeId.Traveller -> R.string.reputation_badge_traveller_how
        BadgeId.ThreeTowns -> R.string.reputation_badge_three_towns_how
        BadgeId.Watchful -> R.string.reputation_badge_watchful_how
        BadgeId.CivicVoice -> R.string.reputation_badge_civic_voice_how
        BadgeId.RoadWatch -> R.string.reputation_badge_road_watch_how
        BadgeId.Host -> R.string.reputation_badge_host_how
    },
)

private val BadgeId.icon: ImageVector
    get() = when (this) {
        BadgeId.FirstContribution -> Icons.Filled.AutoAwesome
        BadgeId.Traveller -> Icons.AutoMirrored.Filled.MenuBook
        BadgeId.ThreeTowns -> Icons.Filled.Map
        BadgeId.Watchful -> Icons.Filled.Visibility
        BadgeId.CivicVoice -> Icons.Filled.Campaign
        BadgeId.RoadWatch -> Icons.Filled.AddRoad
        BadgeId.Host -> Icons.Filled.Groups
    }

@Composable
private fun ContributionKind.title(): String = stringResource(
    when (this) {
        ContributionKind.Place -> R.string.reputation_kind_place
        ContributionKind.Route -> R.string.reputation_kind_route
        ContributionKind.Consultation -> R.string.reputation_kind_consultation
        ContributionKind.Traffic -> R.string.reputation_kind_traffic
        ContributionKind.Confirmation -> R.string.reputation_kind_confirmation
        ContributionKind.Stamp -> R.string.reputation_kind_stamp
        ContributionKind.Support -> R.string.reputation_kind_support
        ContributionKind.Invite -> R.string.reputation_kind_invite
    },
)

private val ContributionKind.icon: ImageVector
    get() = when (this) {
        ContributionKind.Place -> Icons.Outlined.AddLocationAlt
        ContributionKind.Route -> Icons.Outlined.Hiking
        ContributionKind.Consultation -> Icons.Outlined.Forum
        ContributionKind.Traffic -> Icons.Outlined.ReportProblem
        ContributionKind.Confirmation -> Icons.Outlined.CheckCircle
        ContributionKind.Stamp -> Icons.AutoMirrored.Outlined.MenuBook
        ContributionKind.Support -> Icons.Outlined.ThumbUp
        ContributionKind.Invite -> Icons.Outlined.PersonAdd
    }

@Composable
private fun startText(step: RankStep): String = stringResource(R.string.reputation_range_from, step.min.toString())

@Composable
fun joinedText(count: Int): String =
    if (count == 0) stringResource(R.string.reputation_joined_zero) else pluralStringResource(R.plurals.reputation_joined, count, count)

// ---------------------------------------------------------------- people

private val ToneFills = listOf(Color(0xFFF7E3D9), Color(0xFFDDE8F4), Color(0xFFE6EFEB), Color(0xFFF6ECD2), Color(0xFFECE3F3), Color(0xFFDCEEEC))
private val ToneInks = listOf(Color(0xFFA44E2C), Color(0xFF2C5D8F), Color(0xFF1F4739), Color(0xFF8A6410), Color(0xFF6A4A9E), Color(0xFF2D706A))

private fun toneIndex(name: String) = name.sumOf { it.code } % ToneFills.size

private fun initialsOf(name: String?) =
    name.orEmpty().split(" ").filter { it.isNotBlank() }.take(2).joinToString("") { it.take(1).uppercase() }.ifEmpty { "·" }

/**
 * Someone shown by face: their photo when they have one, their initials on a soft colour of
 * their own otherwise. A name is never shown alone when there is a face to go with it.
 */
@Composable
fun PersonAvatar(name: String?, image: String? = null, size: Dp = 40.dp) {
    val tone = toneIndex(name.orEmpty())
    Box(Modifier.size(size).clip(CircleShape).background(ToneFills[tone]).clearAndSetSemantics {}, Alignment.Center) {
        Text(initialsOf(name), style = Type.label.copy(fontSize = (size.value * 0.38f).sp, fontWeight = FontWeight.SemiBold), color = ToneInks[tone])
        if (image != null) AsyncImage(model = image, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.matchParentSize())
    }
}

/** A few faces overlapping in a row: the people who joined. */
@Composable
private fun FacePile(people: List<Person>, size: Dp = 26.dp) {
    Row(horizontalArrangement = Arrangement.spacedBy(-size * 0.32f)) {
        people.take(4).forEachIndexed { index, person ->
            Box(Modifier.zIndex(10f - index).background(Ink.colors.paper, CircleShape).padding(2.dp)) { PersonAvatar(person.name, person.image, size) }
        }
    }
}

/** The invite's illustration: four neighbours, drawn in code, overlapping in a row. */
@Composable
fun FaceRow(size: Dp = 52.dp) {
    val faces = listOf(Color(0xFFD97345), Color(0xFFD6AD4A), Color(0xFF28594A), Color(0xFF5473B8))
    Row(horizontalArrangement = Arrangement.spacedBy(-size * 0.28f), modifier = Modifier.clearAndSetSemantics {}) {
        faces.forEachIndexed { index, tone ->
            Box(
                Modifier.zIndex(index.toFloat()).rotate(if (index % 2 == 0) -4f else 4f).size(size)
                    .background(Ink.colors.paper, CircleShape).padding(maxOf(size * 0.06f, 2.dp))
                    .background(Brush.verticalGradient(listOf(tone.copy(alpha = 0.82f), tone)), CircleShape),
                contentAlignment = Alignment.Center,
            ) { Icon(Icons.Filled.SentimentSatisfied, null, Modifier.size(size * 0.62f), tint = Color.White.copy(alpha = 0.92f)) }
        }
    }
}

/** A small fact with its icon, in place of text strung together with dots. */
@Composable
fun MetaTag(icon: ImageVector, text: String, background: Color = Ink.colors.paper) {
    Row(
        Modifier.height(28.dp).background(background, CircleShape).padding(horizontal = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Icon(icon, null, Modifier.size(14.dp), tint = Ink.colors.ink3)
        Text(text, style = Type.label.copy(fontSize = 13.5.sp), color = Ink.colors.ink2, maxLines = 1)
    }
}

// ---------------------------------------------------------------- seal

/** A scalloped seal: twelve soft bumps around a circle. */
object SealShape : Shape {
    override fun createOutline(size: androidx.compose.ui.geometry.Size, layoutDirection: LayoutDirection, density: Density): Outline {
        val path = Path()
        val cx = size.width / 2
        val cy = size.height / 2
        val radius = min(size.width, size.height) / 2
        val steps = 240
        for (step in 0..steps) {
            val angle = step.toDouble() / steps * 2 * PI
            val r = radius * (1 - 0.075f + 0.075f * cos(12 * angle).toFloat())
            val x = cx + r * cos(angle).toFloat()
            val y = cy + r * sin(angle).toFloat()
            if (step == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        path.close()
        return Outline.Generic(path)
    }
}

/** Green with a white glyph once earned; a quiet seal with its progress ring until then. */
@Composable
private fun BadgeSeal(badge: BadgeProgress, size: Dp = 64.dp) {
    val p = Ink.colors
    Box(Modifier.size(size), contentAlignment = Alignment.Center) {
        Box(Modifier.matchParentSize().background(if (badge.earned) p.brand else p.paper3, SealShape))
        if (!badge.earned) {
            Canvas(Modifier.matchParentSize().padding(size * 0.1f)) {
                drawArc(p.brand, -90f, 360f * badge.fraction, false, style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round))
            }
        }
        Icon(badge.id.icon, null, Modifier.size(size * 0.36f), tint = if (badge.earned) p.onInk else p.ink3)
    }
}

// ---------------------------------------------------------------- profile hero

/**
 * Who you are here: a sage band, your face with your rank's emblem pinned to it, your name with
 * the resident seal you can ask about, and your town and time here as tags.
 */
@Composable
fun ProfileHero(
    name: String?,
    place: String?,
    residencyVerified: Boolean,
    reputation: Reputation?,
    onEditProfile: () -> Unit,
    onExplainResident: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val p = Ink.colors
    Column(modifier.fillMaxWidth().clip(RoundedCornerShape(Metrics.radiusPanel)).background(p.paper2), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.fillMaxWidth().height(132.dp)) {
            Box(
                Modifier.fillMaxWidth().height(84.dp).background(p.brandSoft).drawBehind {
                    for (index in 0 until 6) {
                        val y = size.height * (0.15f + index * 0.17f)
                        val line = Path().apply {
                            moveTo(-20f, y)
                            cubicTo(size.width * 0.3f, y - 26.dp.toPx(), size.width * 0.65f, y + 22.dp.toPx(), size.width + 20f, y - 14.dp.toPx())
                        }
                        drawPath(line, p.brand.copy(alpha = 0.16f), style = Stroke(1.2.dp.toPx()))
                    }
                },
            )
            val edit = stringResource(R.string.reputation_edit_profile)
            Box(
                Modifier.align(Alignment.TopEnd).padding(8.dp).size(44.dp).clip(CircleShape)
                    .pressable(onClick = onEditProfile).semantics { contentDescription = edit },
                Alignment.Center,
            ) { Box(Modifier.size(36.dp).background(p.paper, CircleShape), Alignment.Center) { Icon(Icons.Outlined.Edit, null, Modifier.size(17.dp), tint = p.ink) } }
            Box(Modifier.align(Alignment.BottomCenter)) {
                Box(Modifier.background(p.paper, CircleShape).padding(4.dp)) { PersonAvatar(name, null, 88.dp) }
                reputation?.let { rep ->
                    val rankName = rep.rank.title()
                    Box(Modifier.align(Alignment.BottomEnd).offset(x = 2.dp, y = 2.dp).semantics { contentDescription = rankName }) {
                        RankEmblem(rep.rank, 34.dp, ring = true)
                    }
                }
            }
        }
        Row(Modifier.padding(top = 12.dp, start = 16.dp, end = 16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(name ?: " ", style = Type.title, color = p.ink, textAlign = TextAlign.Center)
            if (residencyVerified) {
                val label = stringResource(R.string.account_resident_verified)
                Box(Modifier.size(40.dp).clip(CircleShape).pressable(onClick = onExplainResident).semantics { contentDescription = label }, Alignment.Center) {
                    Icon(Icons.Filled.Verified, null, Modifier.size(20.dp), tint = p.brand)
                }
            }
        }
        Row(Modifier.padding(top = 8.dp, bottom = 20.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            place?.let { MetaTag(Icons.Outlined.Place, it) }
            reputation?.let {
                val date = SimpleDateFormat("MMM yyyy", Locale.forLanguageTag("es-DO")).format(Date(it.joinedAt.toEpochMilliseconds()))
                MetaTag(Icons.Outlined.CalendarMonth, stringResource(R.string.reputation_member_since, date))
            }
        }
    }
}

// ---------------------------------------------------------------- rank card

/**
 * Where you stand: your rank with its emblem and its line, your points as the one big number,
 * the way to the next rank, and the four ranks with where each starts.
 */
@Composable
fun RankCard(reputation: Reputation, onKnowMore: () -> Unit, modifier: Modifier = Modifier) {
    val p = Ink.colors
    val rank = reputation.rank
    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { delay(150); shown = true }
    val filled by animateFloatAsState(if (shown) reputation.rankProgress else 0f, spring(dampingRatio = 0.85f, stiffness = 120f), label = "rank")
    Column(
        modifier.fillMaxWidth().clip(RoundedCornerShape(Metrics.radiusCard)).background(p.paper2).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            RankEmblem(rank, 44.dp)
            Column {
                Text(stringResource(R.string.reputation_you_are, rank.title()), style = Type.title, color = p.ink)
                Text(rank.line(), style = Type.callout, color = p.ink2)
            }
        }
        Row(verticalAlignment = Alignment.Bottom, modifier = Modifier.semantics(mergeDescendants = true) {}) {
            Row(Modifier.weight(1f), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("${reputation.points}", style = Type.display.copy(fontSize = 40.sp, lineHeight = 42.sp), color = p.ink)
                Text(stringResource(R.string.reputation_points_label), style = Type.body, color = p.ink2, modifier = Modifier.padding(bottom = 5.dp))
            }
            reputation.next?.let { next ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(bottom = 6.dp)) {
                    RankEmblem(next, 22.dp)
                    Text(
                        stringResource(R.string.reputation_to_next, reputation.pointsToGo.toString(), next.title()),
                        style = Type.label.copy(fontWeight = FontWeight.SemiBold), color = next.tint,
                    )
                }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.semantics(mergeDescendants = true) {}) {
            Box(Modifier.fillMaxWidth().height(8.dp).clip(CircleShape).background(p.paper3)) {
                Box(Modifier.fillMaxWidth(filled).fillMaxHeight().clip(CircleShape).background(rank.tint))
            }
            val step = reputation.ranks.firstOrNull { it.id == rank }
            val max = step?.max
            val next = reputation.next
            Text(
                if (step != null && max != null && next != null) {
                    stringResource(R.string.reputation_progress_to, (reputation.points - step.min).toString(), (max - step.min).toString(), next.title())
                } else {
                    stringResource(R.string.reputation_progress_top)
                },
                style = Type.caption.copy(fontSize = 13.sp, fontWeight = FontWeight.Medium), color = p.ink2,
            )
        }
        RankLadder(reputation)
        Row(
            Modifier.heightIn(min = 44.dp).clip(CircleShape).pressable(onClick = onKnowMore),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(stringResource(R.string.reputation_know_more), style = Type.bodyStrong.copy(fontSize = 15.sp), color = p.brandDeep)
            Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, null, Modifier.size(18.dp), tint = p.brandDeep)
        }
    }
}

/** The four ranks as a ladder: each one's emblem in its own colour once reached, and where it starts. */
@Composable
private fun RankLadder(reputation: Reputation) {
    val p = Ink.colors
    val index = reputation.rankIndex
    val count = reputation.ranks.size
    Box {
        Canvas(Modifier.fillMaxWidth().height(34.dp)) {
            val column = size.width / count
            val start = column / 2
            val end = size.width - column / 2
            val reached = start + (end - start) * index / (count - 1).coerceAtLeast(1)
            drawLine(p.paper3, Offset(start, size.height / 2), Offset(end, size.height / 2), 3.dp.toPx(), StrokeCap.Round)
            drawLine(p.ink4, Offset(start, size.height / 2), Offset(reached, size.height / 2), 3.dp.toPx(), StrokeCap.Round)
        }
        Row {
            reputation.ranks.forEachIndexed { i, step ->
                Column(
                    Modifier.weight(1f).semantics(mergeDescendants = true) {},
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Box(Modifier.height(34.dp), Alignment.Center) { RankEmblem(step.id, if (i == index) 34.dp else 28.dp, reached = i <= index, ring = true) }
                    Text(
                        step.id.title(),
                        style = Type.label.copy(fontSize = 13.sp, fontWeight = if (i == index) FontWeight.SemiBold else FontWeight.Medium),
                        color = if (i == index) p.ink else p.ink2,
                    )
                    Text(startText(step), style = Type.caption.copy(fontSize = 11.5.sp), color = p.ink3)
                }
            }
        }
    }
}

// ---------------------------------------------------------------- badges

@Composable
fun BadgesCard(reputation: Reputation, onOpen: (BadgeProgress) -> Unit, modifier: Modifier = Modifier) {
    val p = Ink.colors
    Column(
        modifier.fillMaxWidth().clip(RoundedCornerShape(Metrics.radiusCard)).background(p.paper2).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(stringResource(R.string.reputation_badges_title), style = Type.heading, color = p.ink, modifier = Modifier.weight(1f).semantics { heading() })
            Row(
                Modifier.height(28.dp).background(p.brandSoft, CircleShape).padding(horizontal = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                Icon(Icons.Filled.Verified, null, Modifier.size(14.dp), tint = p.brandDeep)
                Text(
                    stringResource(R.string.reputation_badges_count, reputation.earnedBadges.toString(), reputation.badges.size),
                    style = Type.label.copy(fontSize = 13.sp, fontWeight = FontWeight.SemiBold), color = p.brandDeep,
                )
            }
        }
        reputation.badges.chunked(4).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { badge ->
                    val title = badge.id.title()
                    val state = if (badge.earned) {
                        stringResource(R.string.reputation_badge_earned)
                    } else {
                        stringResource(R.string.reputation_badge_progress, badge.current.toString(), badge.target.toString())
                    }
                    Column(
                        Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).pressable { onOpen(badge) }
                            .semantics(mergeDescendants = true) { contentDescription = title; stateDescription = state }
                            .padding(vertical = 4.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        BadgeSeal(badge, 58.dp)
                        Text(
                            title,
                            style = Type.caption.copy(fontSize = 12.sp, fontWeight = if (badge.earned) FontWeight.SemiBold else FontWeight.Medium),
                            color = if (badge.earned) p.ink else p.ink2, textAlign = TextAlign.Center, maxLines = 2,
                        )
                        if (!badge.earned) Text("${badge.current}/${badge.target}", style = Type.caption.copy(fontSize = 11.sp), color = p.ink3)
                    }
                }
                repeat(4 - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

// ---------------------------------------------------------------- rewards

/**
 * The reward and its state together: what inviting earns, whether the badge is already yours,
 * who joined, the way to invite, and who invited you (or where to enter their code).
 */
@Composable
fun RewardsSection(reputation: Reputation, onInvite: () -> Unit, onEnterCode: () -> Unit, modifier: Modifier = Modifier) {
    val p = Ink.colors
    Column(modifier.fillMaxWidth().padding(vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text(stringResource(R.string.reputation_rewards_title), style = Type.heading, color = p.ink, modifier = Modifier.semantics { heading() })
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            FaceRow(34.dp)
            Column {
                Text(stringResource(R.string.reputation_invite_card), style = Type.heading, color = p.ink)
                Text(stringResource(R.string.reputation_invite_points), style = Type.label.copy(fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold), color = p.brandDeep)
            }
        }
        Row(
            Modifier.height(34.dp).background(if (reputation.hostEarned) p.brandSoft else p.paper2, CircleShape).padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(if (reputation.hostEarned) Icons.Filled.Verified else Icons.Outlined.Verified, null, Modifier.size(17.dp), tint = if (reputation.hostEarned) p.brand else p.ink3)
            Text(
                stringResource(if (reputation.hostEarned) R.string.reputation_host_earned else R.string.reputation_host_pending),
                style = Type.label.copy(fontWeight = FontWeight.SemiBold), color = if (reputation.hostEarned) p.brandDeep else p.ink2,
            )
        }
        if (reputation.joinedPeople.isNotEmpty()) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.semantics(mergeDescendants = true) {}) {
                FacePile(reputation.joinedPeople)
                Text(joinedText(reputation.joined), style = Type.callout, color = p.ink2)
            }
        }
        Pill(stringResource(R.string.reputation_invite_action), onInvite, Modifier.fillMaxWidth(), icon = Icons.Outlined.PersonAdd)
        Hairline(Modifier.padding(top = 2.dp))
        val inviter = reputation.invitedBy
        if (inviter != null) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.semantics(mergeDescendants = true) {}) {
                PersonAvatar(inviter.name, inviter.image, 36.dp)
                Column {
                    Text(stringResource(R.string.reputation_invited_by), style = Type.caption, color = p.ink3)
                    Text(inviter.name, style = Type.bodyStrong, color = p.ink)
                }
            }
        } else {
            Row(
                Modifier.fillMaxWidth().heightIn(min = 44.dp).clip(RoundedCornerShape(12.dp)).pressable(onClick = onEnterCode),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Box(Modifier.size(36.dp).background(p.paper2, CircleShape), Alignment.Center) {
                    Icon(Icons.Outlined.ConfirmationNumber, null, Modifier.size(18.dp), tint = p.ink)
                }
                Text(stringResource(R.string.reputation_have_code), style = Type.bodyStrong, color = p.ink, modifier = Modifier.weight(1f))
                Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, null, Modifier.size(18.dp), tint = p.ink4)
            }
        }
    }
}

// ---------------------------------------------------------------- sheets

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AppSheet(
    onDismiss: () -> Unit,
    full: Boolean = false,
    handle: Boolean = true,
    /** The colour behind the handle, when the sheet's first block is coloured. */
    tint: Color = Ink.colors.paper,
    content: @Composable ColumnScope.() -> Unit,
) {
    ModalBottomSheet(
        onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = full),
        containerColor = Ink.colors.paper,
        shape = RoundedCornerShape(topStart = Metrics.radiusPanel, topEnd = Metrics.radiusPanel),
        dragHandle = if (handle) ({
            Box(Modifier.fillMaxWidth().background(tint), Alignment.Center) { BottomSheetDefaults.DragHandle(color = Ink.colors.ink4) }
        }) else null,
        content = content,
    )
}

@Composable
private fun SheetTitle(title: String) {
    Text(
        title, style = Type.bodyStrong, color = Ink.colors.ink, textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp).semantics { heading() },
    )
}

/** How the ranks work: each one with its emblem and where it starts, and what earns points. */
@Composable
fun RankSheet(reputation: Reputation, onDismiss: () -> Unit) {
    val p = Ink.colors
    AppSheet(onDismiss) {
        Column(
            Modifier.verticalScroll(rememberScrollState()).padding(horizontal = Metrics.gutter).padding(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            SheetTitle(stringResource(R.string.reputation_rank_sheet_title))
            Text(stringResource(R.string.reputation_rank_sheet_body), style = Type.body, color = p.ink2)
            RowGroup {
                reputation.ranks.forEachIndexed { i, step ->
                    Row(
                        Modifier.padding(horizontal = 16.dp, vertical = 11.dp).semantics(mergeDescendants = true) {},
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        RankEmblem(step.id, 34.dp, reached = i <= reputation.rankIndex)
                        Column(Modifier.weight(1f)) {
                            Text(step.id.title(), style = if (step.id == reputation.rank) Type.bodyStrong else Type.body, color = p.ink)
                            Text(step.id.line(), style = Type.caption, color = p.ink3)
                        }
                        Text(startText(step), style = Type.label, color = p.ink3)
                    }
                    if (i < reputation.ranks.size - 1) Hairline(inset = 62.dp)
                }
            }
            RowGroup {
                reputation.breakdown.forEachIndexed { i, line ->
                    Row(
                        Modifier.padding(horizontal = 16.dp, vertical = 11.dp).semantics(mergeDescendants = true) {},
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Icon(line.kind.icon, null, Modifier.size(20.dp), tint = p.ink)
                        Column(Modifier.weight(1f)) {
                            Text(line.kind.title(), style = Type.body, color = p.ink)
                            Text(stringResource(R.string.reputation_yours, line.count.toString()), style = Type.caption, color = p.ink3)
                        }
                        Text(
                            stringResource(R.string.reputation_points_each, line.each.toString()),
                            style = Type.label.copy(fontWeight = FontWeight.Bold), color = p.brandDeep,
                            modifier = Modifier.background(p.brandSoft, CircleShape).padding(horizontal = 9.dp, vertical = 3.dp),
                        )
                    }
                    if (i < reputation.breakdown.size - 1) Hairline(inset = 52.dp)
                }
            }
        }
    }
}

@Composable
fun BadgeSheet(badge: BadgeProgress, onDismiss: () -> Unit) {
    val p = Ink.colors
    var settled by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(if (settled) 1f else 0.8f, spring(dampingRatio = 0.5f), label = "seal")
    val haptics = LocalHapticFeedback.current
    LaunchedEffect(Unit) {
        settled = true
        if (badge.earned) haptics.performHapticFeedback(HapticFeedbackType.Confirm)
    }
    AppSheet(onDismiss) {
        Column(
            Modifier.fillMaxWidth().padding(horizontal = Metrics.gutter).padding(bottom = 36.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            SheetTitle(stringResource(R.string.reputation_badges_title))
            Box(Modifier.scale(scale)) { BadgeSeal(badge, 108.dp) }
            Text(badge.id.title(), style = Type.title, color = p.ink)
            Text(badge.id.how(), style = Type.body, color = p.ink2, textAlign = TextAlign.Center)
            if (badge.earned) {
                Row(
                    Modifier.background(p.brandSoft, CircleShape).height(32.dp).padding(horizontal = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Icon(Icons.Filled.Verified, null, Modifier.size(16.dp), tint = p.brandDeep)
                    Text(stringResource(R.string.reputation_badge_earned), style = Type.label, color = p.brandDeep)
                }
            } else {
                LinearProgressIndicator(progress = { badge.fraction }, modifier = Modifier.width(180.dp).clip(CircleShape), color = p.brand, trackColor = p.paper3)
                Text(stringResource(R.string.reputation_badge_progress, badge.current.toString(), badge.target.toString()), style = Type.label, color = p.ink2)
            }
        }
    }
}

/** What the resident seal beside a name means, asked by tapping it. */
@Composable
fun ResidentSheet(place: String?, onDismiss: () -> Unit) {
    val p = Ink.colors
    AppSheet(onDismiss) {
        Column(
            Modifier.fillMaxWidth().padding(horizontal = 28.dp).padding(bottom = 36.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            SheetTitle(stringResource(R.string.account_resident_verified))
            Icon(Icons.Filled.Verified, null, Modifier.size(56.dp), tint = p.brand)
            Text(
                place?.let { stringResource(R.string.reputation_resident_body, it) } ?: stringResource(R.string.reputation_resident_body_no_place),
                style = Type.body, color = p.ink2, textAlign = TextAlign.Center,
            )
        }
    }
}

private fun shareInvite(context: Context, message: String) {
    val send = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, message)
    }
    context.startActivity(Intent.createChooser(send, null))
}

/**
 * Inviting: one flow in one sheet. The faces and the ask on top, sharing the link first (it opens
 * WhatsApp or whatever the person already uses), contacts as the second way, and the code in one
 * quiet row. Contacts is a step inside: Atrás comes back here, the X leaves.
 */
@Composable
fun InviteFlow(reputation: Reputation, onDismiss: () -> Unit) {
    var contacts by remember { mutableStateOf(false) }
    val message = stringResource(R.string.reputation_message, reputation.inviteCode, reputation.inviteUrl)
    AppSheet(onDismiss, full = true, handle = !contacts, tint = if (contacts) Ink.colors.paper else Ink.colors.brandSoft) {
        if (contacts) {
            BackHandler { contacts = false }
            ContactsStep(message, onBack = { contacts = false }, onClose = onDismiss)
        } else {
            InviteHome(reputation, message, onChooseContacts = { contacts = true }, onClose = onDismiss)
        }
    }
}

@Composable
private fun InviteHome(reputation: Reputation, message: String, onChooseContacts: () -> Unit, onClose: () -> Unit) {
    val p = Ink.colors
    val context = LocalContext.current
    val clipboard = LocalClipboard.current
    val haptics = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()
    var copied by remember { mutableStateOf(false) }
    Column(Modifier.verticalScroll(rememberScrollState()).padding(bottom = 28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        // The faces on a sage band, as on iOS; the sheet's own handle sits on the same green.
        Box(Modifier.fillMaxWidth().background(p.brandSoft).padding(top = 14.dp, bottom = 26.dp)) {
            Box(Modifier.align(Alignment.TopEnd).padding(end = 12.dp)) { IconDisc(Icons.Outlined.Close, stringResource(R.string.common_close), onClose) }
            Box(Modifier.align(Alignment.Center).padding(top = 20.dp)) { FaceRow(64.dp) }
        }
        Column(
            Modifier.padding(horizontal = Metrics.gutter).padding(top = 18.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                stringResource(R.string.reputation_invite_title),
                style = Type.display.copy(fontSize = 30.sp, lineHeight = 34.sp, fontWeight = FontWeight.ExtraBold), color = p.ink, textAlign = TextAlign.Center,
            )
            Text(
                stringResource(if (reputation.hostEarned) R.string.reputation_invite_points else R.string.reputation_invite_body),
                style = Type.body, color = p.ink2, textAlign = TextAlign.Center,
            )
        }
        Column(Modifier.padding(horizontal = Metrics.gutter).padding(top = 22.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Pill(stringResource(R.string.reputation_share_link), { shareInvite(context, message) }, Modifier.fillMaxWidth(), icon = Icons.Outlined.Share)
            Pill(stringResource(R.string.reputation_choose_contacts), onChooseContacts, Modifier.fillMaxWidth(), kind = PillKind.Outline, icon = Icons.Outlined.PersonAdd)
        }
        Row(
            Modifier.padding(horizontal = Metrics.gutter).padding(top = 18.dp).fillMaxWidth().clip(RoundedCornerShape(Metrics.radiusCard))
                .background(p.paper2).padding(start = 16.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(stringResource(R.string.reputation_code_label), style = Type.caption, color = p.ink3)
                Text(
                    reputation.inviteCode,
                    style = Type.title.copy(fontSize = 20.sp, fontFamily = FontFamily.Monospace, letterSpacing = 2.sp, fontWeight = FontWeight.SemiBold),
                    color = p.brandDeep,
                )
            }
            Box(Modifier.width(1.dp).height(34.dp).background(p.line))
            Row(
                Modifier.widthIn(min = 132.dp).heightIn(min = 44.dp).clip(CircleShape).pressable {
                    scope.launch {
                        clipboard.setClipEntry(ClipEntry(ClipData.newPlainText(null, reputation.inviteCode)))
                        haptics.performHapticFeedback(HapticFeedbackType.Confirm)
                        copied = true
                        delay(2000)
                        copied = false
                    }
                },
                horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(if (copied) Icons.Filled.Check else Icons.Outlined.ContentCopy, null, Modifier.size(17.dp), tint = p.brandDeep)
                Text(
                    stringResource(if (copied) R.string.reputation_code_copied else R.string.reputation_copy),
                    style = Type.label.copy(fontSize = 15.sp, fontWeight = FontWeight.SemiBold), color = p.brandDeep,
                )
            }
        }
        Row(Modifier.padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            if (reputation.joinedPeople.isNotEmpty()) FacePile(reputation.joinedPeople, 24.dp)
            Text(joinedText(reputation.joined), style = Type.callout, color = p.ink3)
        }
    }
}

private data class InviteNumber(val label: String?, val value: String)

private data class InviteContact(val id: String, val name: String, val numbers: List<InviteNumber>, val photo: String?)

/** Phone numbers as people here write them: 809-555-0123 for any North American number, anything else as it came. */
private fun displayPhone(raw: String): String {
    val digits = raw.filter { it.isDigit() }
    val local = when {
        digits.length == 10 -> digits
        digits.length == 11 && digits.startsWith("1") -> digits.drop(1)
        else -> null
    }
    // Every North American number (Dominican ones included) reads the same way: 809-555-0123.
    return if (local != null) {
        "${local.take(3)}-${local.substring(3, 6)}-${local.takeLast(4)}"
    } else {
        raw.trim()
    }
}

/** One contact per person, with each of their numbers (deduplicated) and its label. */
private fun readContacts(context: Context): List<InviteContact> {
    val byId = LinkedHashMap<String, InviteContact>()
    context.contentResolver.query(
        ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
        arrayOf(
            ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER,
            ContactsContract.CommonDataKinds.Phone.TYPE,
            ContactsContract.CommonDataKinds.Phone.LABEL,
            ContactsContract.CommonDataKinds.Phone.PHOTO_THUMBNAIL_URI,
        ),
        null, null,
        "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} COLLATE LOCALIZED ASC",
    )?.use { cursor ->
        while (cursor.moveToNext()) {
            val id = cursor.getString(0) ?: continue
            val name = cursor.getString(1)?.takeIf { it.isNotBlank() } ?: continue
            val number = cursor.getString(2)?.takeIf { it.isNotBlank() } ?: continue
            val label = ContactsContract.CommonDataKinds.Phone.getTypeLabel(context.resources, cursor.getInt(3), cursor.getString(4))?.toString()
            val entry = InviteNumber(label, number)
            val existing = byId[id]
            if (existing == null) {
                byId[id] = InviteContact(id, name, listOf(entry), cursor.getString(5))
            } else if (existing.numbers.none { it.value.filter(Char::isDigit) == number.filter(Char::isDigit) }) {
                byId[id] = existing.copy(numbers = existing.numbers + entry)
            }
        }
    }
    return byId.values.toList()
}

/**
 * Pick who to invite, as a step of the invite flow. The address book is read on this phone and
 * stays here; "Invitar por SMS" opens the messaging app with a personal link you can still read
 * and edit, and the row confirms in place.
 */
@Composable
private fun ContactsStep(message: String, onBack: () -> Unit, onClose: () -> Unit) {
    val p = Ink.colors
    val context = LocalContext.current
    var granted by remember { mutableStateOf<Boolean?>(null) }
    var contacts by remember { mutableStateOf<List<InviteContact>?>(null) }
    var query by remember { mutableStateOf("") }
    var choosing by remember { mutableStateOf<InviteContact?>(null) }
    val invited = remember { mutableStateListOf<String>() }
    val ask = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted = it }
    LaunchedEffect(Unit) {
        val has = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED
        if (has) granted = true else ask.launch(Manifest.permission.READ_CONTACTS)
    }
    LaunchedEffect(granted) { if (granted == true) contacts = withContext(Dispatchers.IO) { readContacts(context) } }
    fun text(contact: InviteContact, number: String) {
        val sms = Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:${Uri.encode(number)}")).putExtra("sms_body", message)
        runCatching { context.startActivity(sms) }.onFailure { shareInvite(context, message) }
        if (contact.id !in invited) invited += contact.id
    }

    Column(Modifier.fillMaxHeight(0.94f).statusBarsPadding()) {
        // A compact header: back to the invite, its title, and the way out of the whole flow.
        Box(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 6.dp)) {
            Row(
                Modifier.align(Alignment.CenterStart).heightIn(min = 44.dp).clip(CircleShape).pressable(onClick = onBack).padding(horizontal = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Icon(Icons.AutoMirrored.Outlined.ArrowBack, null, Modifier.size(20.dp), tint = p.ink)
                Text(stringResource(R.string.common_back), style = Type.bodyStrong, color = p.ink)
            }
            Text(
                stringResource(R.string.reputation_invite_contacts), style = Type.bodyStrong, color = p.ink,
                modifier = Modifier.align(Alignment.Center).semantics { heading() },
            )
            Box(Modifier.align(Alignment.CenterEnd)) { IconDisc(Icons.Outlined.Close, stringResource(R.string.common_close), onClose) }
        }
        when (granted) {
            null -> LoadingDots(Modifier.fillMaxWidth().height(240.dp))
            false -> Column(Modifier.padding(horizontal = Metrics.gutter).padding(top = 20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(stringResource(R.string.reputation_contacts_denied_title), style = Type.title, color = p.ink)
                Text(stringResource(R.string.reputation_contacts_denied_body), style = Type.body, color = p.ink2)
                Pill(
                    stringResource(R.string.reputation_open_settings),
                    { context.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null))) },
                    Modifier.fillMaxWidth().padding(top = 8.dp),
                )
                Pill(stringResource(R.string.reputation_share_link), { shareInvite(context, message) }, Modifier.fillMaxWidth(), kind = PillKind.Outline, icon = Icons.Outlined.Share)
            }
            true -> {
                Field(
                    query, { query = it }, stringResource(R.string.reputation_search_contacts),
                    Modifier.padding(horizontal = Metrics.gutter).padding(top = 4.dp), icon = Icons.Outlined.Search,
                )
                Row(
                    Modifier.padding(horizontal = Metrics.gutter, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Outlined.Lock, null, Modifier.size(14.dp), tint = p.ink3)
                    Text(stringResource(R.string.reputation_contacts_private), style = Type.caption, color = p.ink3)
                }
                val all = contacts
                val needle = query.trim().lowercase()
                val shown = all?.filter { needle.isEmpty() || it.name.lowercase().contains(needle) }
                when {
                    all == null -> LoadingDots(Modifier.fillMaxWidth().height(200.dp))
                    all.isEmpty() -> StateView(
                        stringResource(R.string.reputation_contacts_empty), Modifier.fillMaxWidth().height(280.dp), icon = Icons.Outlined.PersonOutline,
                        action = stringResource(R.string.reputation_share_link), onAction = { shareInvite(context, message) },
                    )
                    shown.isNullOrEmpty() -> Text(stringResource(R.string.reputation_no_matches), style = Type.body, color = p.ink3, modifier = Modifier.padding(Metrics.gutter))
                    else -> LazyColumn(Modifier.fillMaxWidth()) {
                        items(shown, key = { it.id }) { contact -> ContactRow(contact, contact.id in invited) {
                            if (contact.numbers.size > 1) choosing = contact else text(contact, contact.numbers.first().value)
                        } }
                        item { Spacer(Modifier.height(24.dp)) }
                    }
                }
            }
        }
    }
    choosing?.let { contact ->
        AlertDialog(
            onDismissRequest = { choosing = null },
            title = { Text(stringResource(R.string.reputation_choose_number), style = Type.heading) },
            text = {
                Column {
                    contact.numbers.forEach { number ->
                        TextButton(onClick = { choosing = null; text(contact, number.value) }, modifier = Modifier.fillMaxWidth()) {
                            Column(Modifier.fillMaxWidth()) {
                                number.label?.let { Text(it, style = Type.caption, color = p.ink3) }
                                Text(displayPhone(number.value), style = Type.body, color = p.ink)
                            }
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = { TextButton(onClick = { choosing = null }) { Text(stringResource(R.string.common_close), color = p.ink) } },
            containerColor = p.paper,
        )
    }
}

@Composable
private fun ContactRow(contact: InviteContact, done: Boolean, onInvite: () -> Unit) {
    val p = Ink.colors
    val label = stringResource(if (done) R.string.reputation_invited else R.string.reputation_invite_by_sms)
    Row(
        Modifier.fillMaxWidth().padding(horizontal = Metrics.gutter, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        PersonAvatar(contact.name, contact.photo, 40.dp)
        Column(Modifier.weight(1f)) {
            // The name reads first; the number is there to tell two Marías apart.
            Text(contact.name, style = Type.bodyStrong, color = p.ink, maxLines = 1)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(displayPhone(contact.numbers.first().value), style = Type.callout, color = p.ink3, maxLines = 1)
                if (contact.numbers.size > 1) {
                    Text(
                        "+${contact.numbers.size - 1}",
                        style = Type.caption.copy(fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold), color = p.ink3,
                        modifier = Modifier.background(p.paper2, CircleShape).padding(horizontal = 6.dp, vertical = 1.dp),
                    )
                }
            }
        }
        Box(
            Modifier.heightIn(min = 44.dp).clip(CircleShape).pressable(onClick = onInvite).clearAndSetSemantics { contentDescription = "$label, ${contact.name}" },
            Alignment.Center,
        ) {
            Row(
                Modifier.height(30.dp).background(if (done) p.paper2 else p.brandSoft, CircleShape).padding(horizontal = 11.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                Icon(if (done) Icons.Filled.Check else Icons.Outlined.Sms, null, Modifier.size(13.dp), tint = if (done) p.ink2 else p.brandDeep)
                Text(label, style = Type.label.copy(fontSize = 13.sp, fontWeight = FontWeight.SemiBold), color = if (done) p.ink2 else p.brandDeep, maxLines = 1)
            }
        }
    }
}

/** "Who invited you?": one field, checked on the phone first, answered in place, and the inviter thanked by face and name. */
@Composable
fun RedeemSheet(state: Redeem, onSubmit: (String) -> Unit, onReset: () -> Unit, onDismiss: () -> Unit) {
    val p = Ink.colors
    var code by remember { mutableStateOf("") }
    val failure = (state as? Redeem.Failed)?.error?.let {
        stringResource(
            when (it) {
                RedeemError.InvalidCode -> R.string.reputation_error_invalid_code
                RedeemError.UnknownCode -> R.string.reputation_error_unknown_code
                RedeemError.OwnCode -> R.string.reputation_error_own_code
                RedeemError.AlreadyRedeemed -> R.string.reputation_error_already_redeemed
                RedeemError.RateLimited -> R.string.sign_in_rate_limited
                RedeemError.Failed -> R.string.common_error_title
            },
        )
    }
    val label = stringResource(R.string.reputation_redeem_placeholder)
    val haptics = LocalHapticFeedback.current
    LaunchedEffect(state) { if (state is Redeem.Done) haptics.performHapticFeedback(HapticFeedbackType.Confirm) }
    AppSheet(onDismiss) {
        Column(
            Modifier.fillMaxWidth().padding(horizontal = Metrics.gutter).padding(bottom = 28.dp).imePadding(),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            SheetTitle(stringResource(R.string.reputation_have_code))
            if (state is Redeem.Done) {
                Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box {
                        PersonAvatar(state.inviterName, null, 76.dp)
                        Box(Modifier.align(Alignment.BottomEnd).offset(4.dp, 4.dp).size(30.dp).background(p.brand, SealShape), Alignment.Center) {
                            Icon(Icons.Filled.Check, null, Modifier.size(15.dp), tint = p.onInk)
                        }
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(stringResource(R.string.reputation_invited_by), style = Type.caption, color = p.ink3)
                        Text(state.inviterName, style = Type.title, color = p.ink)
                    }
                    Text(stringResource(R.string.reputation_redeemed_thanks, state.inviterName), style = Type.body, color = p.ink2, textAlign = TextAlign.Center)
                    Pill(stringResource(R.string.common_close), onDismiss, Modifier.fillMaxWidth().padding(top = 6.dp))
                }
            } else {
                Text(stringResource(R.string.reputation_redeem_title), style = Type.title, color = p.ink)
                Text(stringResource(R.string.reputation_redeem_body), style = Type.body, color = p.ink2)
                BasicTextField(
                    value = code,
                    onValueChange = { value ->
                        code = value.uppercase().filter { it.isLetterOrDigit() }.take(8)
                        if (failure != null) onReset()
                    },
                    singleLine = true,
                    textStyle = Type.title.copy(fontFamily = FontFamily.Monospace, letterSpacing = 3.sp, fontWeight = FontWeight.SemiBold, color = p.ink),
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters, autoCorrectEnabled = false),
                    modifier = Modifier.fillMaxWidth().height(56.dp).clip(RoundedCornerShape(Metrics.radiusField)).background(p.paper2)
                        .then(if (failure != null) Modifier.border(1.5.dp, p.danger, RoundedCornerShape(Metrics.radiusField)) else Modifier)
                        .semantics { contentDescription = label },
                    decorationBox = { inner ->
                        Box(Modifier.padding(horizontal = 16.dp), contentAlignment = Alignment.CenterStart) {
                            if (code.isEmpty()) Text(label, style = Type.title.copy(fontFamily = FontFamily.Monospace), color = p.ink3)
                            inner()
                        }
                    },
                )
                failure?.let {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.ErrorOutline, null, Modifier.size(16.dp), tint = p.danger)
                        Text(it, style = Type.callout, color = p.danger)
                    }
                }
                Pill(
                    stringResource(R.string.reputation_redeem_action), { onSubmit(code) }, Modifier.fillMaxWidth().padding(top = 4.dp),
                    enabled = code.length == 8, busy = state is Redeem.Working,
                )
            }
        }
    }
}

// ---------------------------------------------------------------- header face

/** Your face in every header (or a person glyph signed out), with your rank's emblem on it; opens the account. */
@Composable
fun AccountButton(name: String?, image: String?, rank: RankId?, signedIn: Boolean, onClick: () -> Unit) {
    val label = stringResource(R.string.reputation_account)
    // A white disc the size of the add button; the face sits inside it, the rank's emblem on its edge.
    Box(Modifier.size(HeaderButtonSize).pressable(onClick = onClick).semantics { contentDescription = label }) {
        Box(Modifier.matchParentSize().background(Color.White, CircleShape), Alignment.Center) {
            if (signedIn) PersonAvatar(name, image, HeaderButtonSize - 8.dp)
            else Icon(Icons.Filled.Person, null, Modifier.size(22.dp), tint = Ink.colors.brandDeep)
        }
        if (signedIn && rank != null) Box(Modifier.align(Alignment.BottomEnd).offset(2.dp, 2.dp)) { RankEmblem(rank, 18.dp, ring = true) }
    }
}
