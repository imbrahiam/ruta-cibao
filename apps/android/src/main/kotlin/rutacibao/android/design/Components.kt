package rutacibao.android.design

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.WifiOff
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import rutacibao.android.R
import rutacibao.presentation.UiError

// ---------------------------------------------------------------- touch

/** Any custom tappable: an immediate pressed state at the finger, then the action. */
@Composable
fun Modifier.pressable(enabled: Boolean = true, scale: Float = 0.96f, role: Role = Role.Button, haptic: Boolean = false, onClick: () -> Unit): Modifier {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val amount by animateFloatAsState(if (pressed) scale else 1f, spring(stiffness = Spring.StiffnessMediumLow), label = "press")
    val feedback = LocalHapticFeedback.current
    return this
        .graphicsLayer { scaleX = amount; scaleY = amount; alpha = if (pressed) 0.75f else 1f }
        .clickable(source, indication = null, enabled = enabled, role = role) {
            if (haptic) feedback.performHapticFeedback(HapticFeedbackType.TextHandleMove)
            onClick()
        }
}

/** A floating surface: hairline ring and the landing's soft shadow, for things that sit over something else. */
@Composable
fun Modifier.floating(shape: Shape): Modifier =
    shadow(10.dp, shape, ambientColor = Color.Black.copy(alpha = 0.10f), spotColor = Color.Black.copy(alpha = 0.14f))
        .background(Ink.colors.card, shape)
        .border(1.dp, Ink.colors.ink.copy(alpha = 0.07f), shape)

// ---------------------------------------------------------------- buttons

enum class PillKind { Ink, Quiet, Outline, Danger }

/** The landing's pill: ink for the one main action, paper for the rest. */
@Composable
fun Pill(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    kind: PillKind = PillKind.Ink,
    compact: Boolean = false,
    enabled: Boolean = true,
    busy: Boolean = false,
    icon: ImageVector? = null,
) {
    val p = Ink.colors
    val fill = when (kind) { PillKind.Ink -> p.action; PillKind.Quiet, PillKind.Danger -> p.paper2; PillKind.Outline -> Color.Transparent }
    val content = when (kind) { PillKind.Ink -> p.onInk; PillKind.Danger -> p.danger; else -> p.ink }
    Row(
        modifier
            .graphicsLayer { alpha = if (enabled) 1f else 0.4f }
            .heightIn(min = if (compact) 40.dp else 52.dp)
            .clip(CircleShape)
            .background(fill)
            .then(if (kind == PillKind.Outline) Modifier.border(1.dp, p.line, CircleShape) else Modifier)
            .pressable(enabled = enabled && !busy, scale = 0.97f, onClick = onClick)
            .padding(horizontal = if (compact) 16.dp else 22.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (busy) {
            CircularProgressIndicator(Modifier.size(16.dp), color = content, strokeWidth = 2.dp)
            Spacer(Modifier.width(10.dp))
        } else if (icon != null) {
            Icon(icon, null, Modifier.size(18.dp), tint = content)
            Spacer(Modifier.width(8.dp))
        }
        Text(text, style = if (compact) Type.label else Type.bodyStrong, color = content, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/** A round icon button: 44 dp, paper fill (or floating over the map), one thin glyph. */
@Composable
fun IconDisc(icon: ImageVector, label: String, onClick: () -> Unit, modifier: Modifier = Modifier, floating: Boolean = false, tint: Color = Ink.colors.ink) {
    Box(
        modifier
            .size(44.dp)
            .then(if (floating) Modifier.floating(CircleShape) else Modifier.background(Ink.colors.paper2, CircleShape))
            .clip(CircleShape)
            .pressable(onClick = onClick)
            .semantics { contentDescription = label },
        Alignment.Center,
    ) { Icon(icon, null, Modifier.size(20.dp), tint = tint) }
}

@Composable
fun Chip(
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    floating: Boolean = false,
    onBrand: Boolean = false,
    badge: Int? = null,
) {
    val p = Ink.colors
    // On the green header: translucent white idle, solid white picked. On paper: grey idle, the
    // pick in the pine's soft wash with a pine ring, so it never rests on colour alone.
    val fill by animateColorAsState(
        when {
            onBrand && selected -> Color.White
            onBrand -> Color.White.copy(alpha = 0.14f)
            selected -> p.brandSoft
            else -> p.paper2
        },
        label = "chip",
    )
    val content = when { onBrand && selected -> p.brandDeep; onBrand -> Color.White; selected -> p.brandDeep; else -> p.ink }
    Row(
        modifier
            .height(38.dp)
            .then(if (floating && !selected) Modifier.shadow(5.dp, CircleShape, ambientColor = Color.Black.copy(alpha = 0.08f), spotColor = Color.Black.copy(alpha = 0.1f)) else Modifier)
            .clip(CircleShape)
            .background(fill)
            .then(if (!onBrand && selected) Modifier.border(1.5.dp, p.brand, CircleShape) else Modifier)
            .pressable(haptic = true, role = Role.Tab, onClick = onClick)
            .semantics { this.selected = selected }
            .padding(horizontal = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(7.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) Icon(icon, null, Modifier.size(15.dp), tint = content)
        Text(text, style = Type.label.copy(fontWeight = if (selected) androidx.compose.ui.text.font.FontWeight.SemiBold else androidx.compose.ui.text.font.FontWeight.Medium), color = content, maxLines = 1)
        // Counts are badges, never "(3)".
        if (badge != null && badge > 0) {
            Box(Modifier.defaultMinSize(20.dp, 20.dp).background(if (onBrand && !selected) Color.White else p.brand, CircleShape).padding(horizontal = 6.dp), Alignment.Center) {
                Text("$badge", style = Type.caption.copy(fontSize = 11.5.sp), color = if (onBrand && !selected) p.brandDeep else Color.White)
            }
        }
    }
}

// ---------------------------------------------------------------- fields

/** A text field on paper: no border until focused, the placeholder is the label. */
@Composable
fun Field(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    minLines: Int = 1,
    maxLines: Int = 1,
    icon: ImageVector? = null,
    keyboard: KeyboardOptions = KeyboardOptions.Default,
    onDone: (() -> Unit)? = null,
    textStyle: TextStyle = Type.body,
) {
    val p = Ink.colors
    var focused by remember { mutableStateOf(false) }
    val ring by animateColorAsState(if (focused) p.brand else Color.Transparent, label = "ring")
    val shape = RoundedCornerShape(Metrics.radiusField)
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier.fillMaxWidth().onFocusChanged { focused = it.isFocused },
        textStyle = textStyle.copy(color = p.ink),
        cursorBrush = SolidColor(p.ink),
        minLines = minLines,
        maxLines = maxLines,
        singleLine = maxLines == 1,
        keyboardOptions = keyboard,
        keyboardActions = KeyboardActions(onDone = { onDone?.invoke() }, onSearch = { onDone?.invoke() }, onGo = { onDone?.invoke() }),
        decorationBox = { inner ->
            Row(
                Modifier.background(p.paper2, shape).border(1.5.dp, ring, shape).padding(horizontal = 16.dp, vertical = 15.dp).defaultMinSize(minHeight = 22.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = if (maxLines == 1) Alignment.CenterVertically else Alignment.Top,
            ) {
                if (icon != null) Icon(icon, null, Modifier.size(18.dp), tint = p.ink3)
                Box(Modifier.weight(1f)) {
                    if (value.isEmpty()) Text(placeholder, style = textStyle, color = p.ink3, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    inner()
                }
            }
        },
    )
}

// ---------------------------------------------------------------- small pieces

@Composable
fun Hairline(modifier: Modifier = Modifier, inset: Dp = 0.dp) {
    Box(modifier.padding(start = inset).fillMaxWidth().height(1.dp).background(Ink.colors.line))
}

/** A glyph on a soft disc in one of the landing's accents. Saturated colour stays on the map. */
@Composable
fun GlyphDisc(icon: ImageVector, modifier: Modifier = Modifier, size: Dp = 40.dp, tint: Tint = Tint.Neutral) {
    Box(modifier.size(size).background(tint.fill(), CircleShape), Alignment.Center) {
        Icon(icon, null, Modifier.size(size * 0.46f), tint = tint.ink())
    }
}

@Composable
fun Avatar(name: String?, size: Dp = 40.dp) {
    val initials = name.orEmpty().split(" ").filter { it.isNotBlank() }.take(2).joinToString("") { it.take(1).uppercase() }.ifEmpty { "·" }
    Box(Modifier.size(size).background(Ink.colors.paper3, CircleShape).clearAndSetSemantics {}, Alignment.Center) {
        Text(initials, style = Type.label.copy(fontSize = (size.value * 0.36f).sp), color = Ink.colors.ink2)
    }
}

/** A state: a glyph in the state's colour and its word on a soft wash of it (white over photos). */
@Composable
fun StatusTag(text: String, color: Color = Ink.colors.ink3, icon: ImageVector? = null, solid: Boolean = false) {
    Row(
        Modifier.height(24.dp).background(if (solid) Color.White else color.copy(alpha = 0.12f), CircleShape).padding(horizontal = 9.dp),
        horizontalArrangement = Arrangement.spacedBy(5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) Icon(icon, null, Modifier.size(12.dp), tint = color)
        Text(text, style = Type.caption.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.Medium), color = Ink.colors.ink, maxLines = 1)
    }
}

/**
 * The mark ("Vínculo"): two links of a chain in white on the brand pine, drawn from the same
 * paths as the brand's SVG and iOS's `MarkLinks` (256 unit box, links at 75% around the centre).
 */
@Composable
fun Mark(size: Dp = 56.dp, modifier: Modifier = Modifier) {
    Canvas(modifier.size(size).clip(RoundedCornerShape(size * 0.235f)).background(Ink.colors.brand).clearAndSetSemantics {}) {
        val k = this.size.width / 256f
        fun x(v: Float) = (v * 0.75f + 32f) * k
        val links = Path().apply {
            moveTo(x(112f), x(78f)); lineTo(x(94f), x(60f))
            cubicTo(x(78f), x(44f), x(52f), x(44f), x(36f), x(60f))
            cubicTo(x(20f), x(76f), x(20f), x(102f), x(36f), x(118f))
            lineTo(x(74f), x(156f))
            cubicTo(x(90f), x(172f), x(116f), x(172f), x(132f), x(156f))
            lineTo(x(148f), x(140f))
            moveTo(x(144f), x(178f)); lineTo(x(162f), x(196f))
            cubicTo(x(178f), x(212f), x(204f), x(212f), x(220f), x(196f))
            cubicTo(x(236f), x(180f), x(236f), x(154f), x(220f), x(138f))
            lineTo(x(182f), x(100f))
            cubicTo(x(166f), x(84f), x(140f), x(84f), x(124f), x(100f))
            lineTo(x(108f), x(116f))
        }
        drawPath(links, Color.White, style = Stroke(width = 27f * 0.75f * k, cap = StrokeCap.Round, join = androidx.compose.ui.graphics.StrokeJoin.Round))
    }
}

// ---------------------------------------------------------------- states

/** Three quiet dots: the app is fetching. No grey boxes pretending to be content. */
@Composable
fun LoadingDots(modifier: Modifier = Modifier) {
    val label = stringResource(R.string.common_loading)
    val transition = rememberInfiniteTransition(label = "dots")
    Row(modifier.fillMaxWidth().semantics { contentDescription = label }, Arrangement.Center, Alignment.CenterVertically) {
        repeat(3) { index ->
            val alpha by transition.animateFloat(0.25f, 0.9f, infiniteRepeatable(tween(700, delayMillis = index * 160), RepeatMode.Reverse), label = "dot")
            Box(Modifier.padding(horizontal = 3.dp).size(6.dp).graphicsLayer { this.alpha = alpha }.background(Ink.colors.ink3, CircleShape))
        }
    }
}

/** Empty, offline or failed: one glyph (or the mark), one line, one way forward. */
@Composable
fun StateView(title: String, modifier: Modifier = Modifier, icon: ImageVector? = null, message: String? = null, action: String? = null, prominent: Boolean = false, onAction: (() -> Unit)? = null) {
    Column(modifier.fillMaxWidth().padding(32.dp), Arrangement.spacedBy(12.dp, Alignment.CenterVertically), Alignment.CenterHorizontally) {
        if (icon != null) Icon(icon, null, Modifier.size(32.dp), tint = Ink.colors.ink3) else Mark(44.dp)
        Text(title, style = Type.title, color = Ink.colors.ink, textAlign = TextAlign.Center)
        if (message != null) Text(message, style = Type.callout, color = Ink.colors.ink3, textAlign = TextAlign.Center)
        // A real button, so an empty or failed state reads as a next step.
        if (action != null && onAction != null) {
            if (prominent) Pill(action, onAction, Modifier.widthIn(max = 300.dp).fillMaxWidth().padding(top = 4.dp))
            else Pill(action, onAction, kind = PillKind.Outline, compact = true)
        }
    }
}

@Composable
fun ErrorView(error: UiError, modifier: Modifier = Modifier, onRetry: () -> Unit) {
    val offline = error == UiError.Offline
    StateView(
        title = stringResource(if (offline) R.string.common_offline else R.string.common_error_title),
        modifier = modifier,
        icon = if (offline) Icons.Outlined.WifiOff else Icons.Outlined.ErrorOutline,
        message = if (offline) stringResource(R.string.common_offline_body) else null,
        action = stringResource(R.string.common_retry),
        onAction = onRetry,
    )
}

// ---------------------------------------------------------------- screen furniture

/** A root screen's title in the landing's display type, with optional trailing controls. */
@Composable
fun ScreenTitle(title: String, modifier: Modifier = Modifier, trailing: @Composable RowScope.() -> Unit = {}) {
    Row(modifier.fillMaxWidth().padding(start = Metrics.gutter, end = Metrics.gutter, top = 10.dp, bottom = 14.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(title, style = Type.display, color = Ink.colors.ink, modifier = Modifier.weight(1f).semantics { heading() })
        trailing()
    }
}

/** A pushed page's top row: back (or close), a centred title, an optional action. */
@Composable
fun TopRow(title: String, onBack: () -> Unit, modifier: Modifier = Modifier, backIcon: ImageVector = Icons.AutoMirrored.Outlined.ArrowBack, trailing: @Composable () -> Unit = {}) {
    Box(modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
        IconDisc(backIcon, stringResource(R.string.common_back), onBack, Modifier.align(Alignment.CenterStart), floating = true)
        Text(title, style = Type.bodyStrong, color = Ink.colors.ink, modifier = Modifier.align(Alignment.Center).padding(horizontal = 56.dp).semantics { heading() }, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Box(Modifier.align(Alignment.CenterEnd)) { trailing() }
    }
}

/** A pushed page: the top row, then scrolling content on paper at a comfortable width. */
@Composable
fun Page(title: String, onBack: () -> Unit, trailing: @Composable () -> Unit = {}, bottom: @Composable () -> Unit = {}, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxSize().background(Ink.colors.paper)) {
        TopRow(title, onBack, trailing = trailing)
        Box(Modifier.weight(1f).fillMaxWidth(), Alignment.TopCenter) {
            Column(
                Modifier.widthIn(max = 640.dp).fillMaxWidth().verticalScroll(rememberScrollState()).padding(start = Metrics.gutter, end = Metrics.gutter, top = 10.dp, bottom = 28.dp + rutacibao.android.app.LocalBarClearance.current),
                verticalArrangement = Arrangement.spacedBy(14.dp),
                content = content,
            )
        }
        bottom()
    }
}

/** Rows that belong together, on one card with a hairline ring. */
@Composable
fun RowGroup(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    val shape = RoundedCornerShape(Metrics.radiusCard)
    Column(modifier.fillMaxWidth().clip(shape).background(Ink.colors.paper2), content = content)
}

/** One line of a group: a thin glyph, a title, an optional value, and where it leads. */
@Composable
fun RowLabel(
    title: String,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    value: String? = null,
    badge: Int? = null,
    chevron: Boolean = true,
    danger: Boolean = false,
    divider: Boolean = true,
    onClick: (() -> Unit)? = null,
) {
    val p = Ink.colors
    Column(modifier.then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)) {
        Row(Modifier.heightIn(min = 54.dp).padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
            if (icon != null) Icon(icon, null, Modifier.size(22.dp), tint = if (danger) p.danger else p.ink)
            Text(title, style = Type.body, color = if (danger) p.danger else p.ink, modifier = Modifier.weight(1f))
            if (badge != null && badge > 0) {
                Box(Modifier.defaultMinSize(22.dp, 22.dp).background(p.brand, CircleShape).padding(horizontal = 7.dp), Alignment.Center) {
                    Text("$badge", style = Type.caption, color = p.onInk)
                }
            }
            if (value != null) Text(value, style = Type.callout, color = p.ink3)
            if (chevron) Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, null, Modifier.size(18.dp), tint = p.ink4)
        }
        if (divider) Box(Modifier.padding(start = if (icon == null) 16.dp else 54.dp).fillMaxWidth().height(1.dp).background(p.paper3))
    }
}

/** A small caption above a group of controls. */
@Composable
fun FormLabel(text: String, problem: Boolean = false) {
    Text(text, style = Type.label, color = if (problem) Ink.colors.danger else Ink.colors.ink, modifier = Modifier.padding(top = 10.dp))
}

/** A quiet in-page notice: one glyph, a line, and its explanation. */
@Composable
fun Notice(icon: ImageVector, title: String, message: String? = null) {
    Row(Modifier.fillMaxWidth().background(Ink.colors.paper2, RoundedCornerShape(Metrics.radiusField)).padding(14.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Icon(icon, null, Modifier.size(18.dp), tint = Ink.colors.ink2)
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, style = Type.label, color = Ink.colors.ink)
            if (message != null) Text(message, style = Type.callout, color = Ink.colors.ink3)
        }
    }
}

/** Content rises into place once, staggered by its order on the page. */
@Composable
fun Modifier.rise(order: Int = 0): Modifier {
    val progress = remember { Animatable(0f) }
    LaunchedEffect(Unit) { progress.animateTo(1f, tween(480, delayMillis = order * 50)) }
    return graphicsLayer { alpha = progress.value; translationY = (1f - progress.value) * 10.dp.toPx() }
}
