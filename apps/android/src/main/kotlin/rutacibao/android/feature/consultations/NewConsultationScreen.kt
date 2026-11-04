package rutacibao.android.feature.consultations

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.outlined.AccountBalance
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.LocalOffer
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.google.android.gms.maps.model.LatLng
import rutacibao.android.R
import rutacibao.android.feature.auth.SignInDialog
import rutacibao.android.feature.map.LocationPickerDialog
import rutacibao.android.ui.CategoryAvatar
import rutacibao.android.ui.LocalAppGraph
import rutacibao.android.ui.LocalPalette
import rutacibao.android.ui.PrimaryButton
import rutacibao.android.ui.PushedScreen
import rutacibao.android.ui.categoryIcon
import rutacibao.android.ui.parseCategoryColor
import rutacibao.presentation.consultations.NewConsultationUiState
import rutacibao.presentation.consultations.NewConsultationViewModel

/** Composing a case, Threads-composer style: write first, then attach the topic, the municipality and (optionally) a point. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun NewConsultationScreen(onBack: () -> Unit, onOpened: (String) -> Unit) {
    val graph = LocalAppGraph.current
    val vm: NewConsultationViewModel = viewModel { graph.viewModels.consultationComposer() }
    val state by vm.state.collectAsStateWithLifecycle()
    val palette = LocalPalette.current
    var title by rememberSaveable { mutableStateOf("") }
    var text by rememberSaveable { mutableStateOf("") }
    var picking by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(state.openedSlug) { state.openedSlug?.let(onOpened) }

    val category = state.categories.firstOrNull { it.id == state.categoryId }
    val municipality = state.municipalities.firstOrNull { it.id == state.municipalityId }
    val pinned = if (state.latitude != null && state.longitude != null) LatLng(state.latitude!!, state.longitude!!) else null

    PushedScreen(
        title = stringResource(R.string.consultations_new_title),
        onBack = onBack,
        bottomBar = {
            Surface(color = MaterialTheme.colorScheme.surfaceContainer, tonalElevation = 0.dp) {
                Column(Modifier.windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Bottom))) {
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        BodyRing(state.bodyLength, 40)
                        Box(Modifier.weight(1f))
                        PrimaryButton(
                            text = stringResource(R.string.consultations_submit),
                            onClick = vm::send,
                            busy = state.sending,
                            height = 44.dp,
                        )
                    }
                }
            }
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(top = 12.dp, bottom = 24.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                if (category != null) {
                    CategoryAvatar(category.icon, category.color, 36.dp)
                } else {
                    Box(Modifier.size(36.dp).background(palette.inset, CircleShape), Alignment.Center) {
                        Icon(Icons.Outlined.ChatBubbleOutline, contentDescription = null, Modifier.size(18.dp), tint = palette.textTertiary)
                    }
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    PlainField(
                        value = title,
                        onChange = { title = it.take(NewConsultationUiState.TITLE.last); vm.updateTitle(it) },
                        placeholder = stringResource(R.string.consultations_title_label),
                        style = TextStyle(fontSize = 16.sp, lineHeight = 22.sp, fontWeight = FontWeight.SemiBold),
                    )
                    Problem(NewConsultationUiState.Problem.Title in state.problems, stringResource(R.string.consultations_errors_title))
                    PlainField(
                        value = text,
                        onChange = { text = it.take(NewConsultationUiState.BODY.last); vm.updateBody(it) },
                        placeholder = stringResource(R.string.consultations_body_label),
                        style = TextStyle(fontSize = 15.sp, lineHeight = 21.sp),
                        minLines = 4,
                    )
                    Problem(NewConsultationUiState.Problem.Body in state.problems, stringResource(R.string.consultations_errors_body))

                    if (category != null || municipality != null || pinned != null) {
                        FlowRow(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            category?.let { Chip(it.name, categoryIcon(it.icon), parseCategoryColor(it.color, palette.textSecondary)) }
                            municipality?.let { Chip(it.name, Icons.Outlined.AccountBalance, palette.textSecondary) }
                            if (pinned != null) {
                                Chip(stringResource(R.string.consultations_pinned), Icons.Filled.LocationOn, palette.textSecondary, onClick = { picking = true })
                            }
                        }
                    }

                    Row(Modifier.offset(x = (-12).dp).padding(top = 2.dp)) {
                        MenuIcon(
                            icon = Icons.Outlined.LocalOffer,
                            label = stringResource(R.string.consultations_category),
                            problem = NewConsultationUiState.Problem.Category in state.problems,
                            items = state.categories.map { Triple(it.id, it.name, categoryIcon(it.icon)) },
                            onPick = vm::selectCategory,
                        )
                        MenuIcon(
                            icon = Icons.Outlined.AccountBalance,
                            label = stringResource(R.string.consultations_municipality),
                            problem = NewConsultationUiState.Problem.Municipality in state.problems,
                            items = state.municipalities.map { Triple(it.id, it.name, null) },
                            onPick = vm::selectMunicipality,
                        )
                        val locationLabel = stringResource(if (pinned == null) R.string.consultations_add_location else R.string.consultations_change_location)
                        AttachButton(if (pinned == null) Icons.Outlined.LocationOn else Icons.Filled.LocationOn, locationLabel, false) { picking = true }
                    }
                    Problem(NewConsultationUiState.Problem.Category in state.problems, stringResource(R.string.consultations_errors_category))
                    Problem(NewConsultationUiState.Problem.Municipality in state.problems, stringResource(R.string.consultations_errors_municipality))

                    Row(Modifier.padding(top = 28.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.Top) {
                        Icon(Icons.Outlined.Visibility, contentDescription = null, Modifier.size(16.dp).padding(top = 2.dp), tint = palette.textTertiary)
                        Text(stringResource(R.string.consultations_public_note), style = MaterialTheme.typography.bodySmall, color = palette.textTertiary)
                    }
                }
            }
        }
    }

    if (picking) {
        LocationPickerDialog(
            start = pinned,
            onDismiss = { picking = false },
            onPicked = { vm.setLocation(it.latitude, it.longitude) },
        )
    }
    if (state.signInRequested) SignInDialog(onDismiss = vm::signInHandled)
}

@Composable
private fun PlainField(value: String, onChange: (String) -> Unit, placeholder: String, style: TextStyle, minLines: Int = 1) {
    val palette = LocalPalette.current
    BasicTextField(
        value = value,
        onValueChange = onChange,
        textStyle = style.copy(color = MaterialTheme.colorScheme.onSurface),
        cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
        minLines = minLines,
        modifier = Modifier.fillMaxWidth(),
        decorationBox = { inner ->
            Box {
                if (value.isEmpty()) Text(placeholder, style = style, color = palette.textTertiary)
                inner()
            }
        },
    )
}

@Composable
private fun Problem(show: Boolean, text: String) {
    if (!show) return
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Filled.ErrorOutline, contentDescription = null, Modifier.size(16.dp), tint = LocalPalette.current.dangerInk)
        Text(text, style = MaterialTheme.typography.labelMedium, color = LocalPalette.current.dangerInk)
    }
}

@Composable
private fun Chip(text: String, icon: androidx.compose.ui.graphics.vector.ImageVector, tint: Color, onClick: (() -> Unit)? = null) {
    Row(
        Modifier
            .height(28.dp)
            .clip(CircleShape)
            .background(LocalPalette.current.inset)
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(horizontal = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Icon(icon, contentDescription = null, Modifier.size(14.dp), tint = tint)
        Text(text, style = MaterialTheme.typography.labelMedium, maxLines = 1)
    }
}

@Composable
private fun AttachButton(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, problem: Boolean, onClick: () -> Unit) {
    Box(
        Modifier.size(48.dp).clip(CircleShape).clickable(onClickLabel = label, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            icon,
            contentDescription = label,
            Modifier.size(22.dp),
            tint = if (problem) LocalPalette.current.danger else LocalPalette.current.textSecondary,
        )
    }
}

@Composable
private fun MenuIcon(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    problem: Boolean,
    items: List<Triple<String, String, androidx.compose.ui.graphics.vector.ImageVector?>>,
    onPick: (String) -> Unit,
) {
    var open by androidx.compose.runtime.remember { mutableStateOf(false) }
    Box {
        AttachButton(icon, label, problem) { open = true }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            items.forEach { (id, name, glyph) ->
                DropdownMenuItem(
                    text = { Text(name) },
                    leadingIcon = glyph?.let { { Icon(it, contentDescription = null) } },
                    onClick = { open = false; onPick(id) },
                )
            }
        }
    }
}

/** Fills toward the description's minimum; a check once it's enough. */
@Composable
private fun BodyRing(length: Int, minimum: Int) {
    val palette = LocalPalette.current
    val progress by animateFloatAsState((length.toFloat() / minimum).coerceAtMost(1f), label = "ring")
    val done = length >= minimum
    val ink = if (done) palette.success else palette.text
    val track = palette.hairline
    val description = stringResource(R.string.consultations_body_helper, length.toString())
    Box(Modifier.size(24.dp).semantics { contentDescription = description }, Alignment.Center) {
        Canvas(Modifier.fillMaxSize().clearAndSetSemantics { }) {
            val stroke = 2.5.dp.toPx()
            val inset = stroke / 2
            val arc = Size(size.width - stroke, size.height - stroke)
            drawArc(track, 0f, 360f, false, topLeft = androidx.compose.ui.geometry.Offset(inset, inset), size = arc, style = Stroke(stroke))
            drawArc(ink, -90f, 360f * progress, false, topLeft = androidx.compose.ui.geometry.Offset(inset, inset), size = arc, style = Stroke(stroke, cap = StrokeCap.Round))
        }
        if (done) Icon(Icons.Filled.Check, contentDescription = null, Modifier.size(12.dp), tint = ink)
    }
}
