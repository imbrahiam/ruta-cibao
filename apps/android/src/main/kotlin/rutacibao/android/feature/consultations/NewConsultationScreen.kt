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
import androidx.compose.runtime.remember
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
import rutacibao.android.ui.Notice
import rutacibao.android.ui.FillingColumn
import rutacibao.android.ui.PhotoAttach
import rutacibao.android.ui.grow
import rutacibao.android.feature.contribute.SubmitBar
import androidx.compose.foundation.border
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.semantics.Role
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.shape.RoundedCornerShape
import rutacibao.android.ui.PrimaryButton
import rutacibao.android.ui.PushedScreen
import rutacibao.android.ui.categoryIcon
import rutacibao.android.ui.parseCategoryColor
import rutacibao.presentation.consultations.NewConsultationUiState
import rutacibao.presentation.consultations.NewConsultationViewModel
import rutacibao.presentation.UiError

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
    if (state.queued) {
        PushedScreen(title = stringResource(R.string.consultations_new_title), onBack = onBack) { padding ->
            Column(Modifier.fillMaxSize().padding(padding).padding(24.dp), verticalArrangement = Arrangement.Center) {
                Text(stringResource(R.string.offline_queued_toast), style = MaterialTheme.typography.headlineSmall)
                Text(stringResource(R.string.offline_queued_toast_body))
                PrimaryButton(text = stringResource(R.string.common_close), onClick = onBack)
            }
        }
        return
    }

    val category = state.categories.firstOrNull { it.id == state.categoryId }
    val municipality = state.municipalities.firstOrNull { it.id == state.municipalityId }
    val pinned = if (state.latitude != null && state.longitude != null) LatLng(state.latitude!!, state.longitude!!) else null

    PushedScreen(
        title = stringResource(R.string.consultations_new_title),
        onBack = onBack,
        bottomBar = {
            SubmitBar(
                title = stringResource(if (state.submitted) R.string.common_retry else R.string.consultations_submit),
                busy = state.sending,
                enabled = title.isNotBlank() && text.isNotBlank(),
                onClick = vm::send,
            )
        },
    ) { padding ->
        FillingColumn(padding, spacing = 6.dp, growMin = 120.dp) {
            val titleFocus = remember { FocusRequester() }
            LaunchedEffect(Unit) { titleFocus.requestFocus() }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
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
                        enabled = !state.submitted,
                        modifier = Modifier.focusRequester(titleFocus),
                        filled = true,
                        minHeight = 48.dp,
                    )
                    Problem(NewConsultationUiState.Problem.Title in state.problems, stringResource(R.string.consultations_errors_title))
                }
            }
            PlainField(
                value = text,
                onChange = { text = it.take(NewConsultationUiState.BODY.last); vm.updateBody(it) },
                placeholder = stringResource(R.string.consultations_body_label),
                style = TextStyle(fontSize = 15.sp, lineHeight = 21.sp),
                enabled = !state.submitted,
                modifier = Modifier.grow(),
                counter = state.bodyLength to 40,
            )
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Problem(NewConsultationUiState.Problem.Body in state.problems, stringResource(R.string.consultations_errors_body))
                FlowRow(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    MenuChip(
                        icon = category?.let { categoryIcon(it.icon) } ?: Icons.Outlined.LocalOffer,
                        label = category?.name ?: stringResource(R.string.consultations_category),
                        tint = category?.let { parseCategoryColor(it.color, palette.textSecondary) },
                        chosen = category != null,
                        problem = NewConsultationUiState.Problem.Category in state.problems,
                        items = state.categories.map { Triple(it.id, it.name, categoryIcon(it.icon)) },
                        onPick = vm::selectCategory,
                    )
                    MenuChip(
                        icon = Icons.Outlined.AccountBalance,
                        label = municipality?.name ?: stringResource(R.string.consultations_municipality),
                        tint = null,
                        chosen = municipality != null,
                        problem = NewConsultationUiState.Problem.Municipality in state.problems,
                        items = state.municipalities.map { Triple(it.id, it.name, null) },
                        onPick = vm::selectMunicipality,
                    )
                    AttachChip(
                        icon = if (pinned == null) Icons.Outlined.LocationOn else Icons.Filled.LocationOn,
                        label = stringResource(R.string.consultations_location),
                        tint = null,
                        chosen = pinned != null,
                        problem = false,
                        description = stringResource(if (pinned == null) R.string.consultations_add_location else R.string.consultations_change_location),
                    ) { picking = true }
                }
                Problem(NewConsultationUiState.Problem.Category in state.problems, stringResource(R.string.consultations_errors_category))
                Problem(NewConsultationUiState.Problem.Municipality in state.problems, stringResource(R.string.consultations_errors_municipality))
                Box(Modifier.padding(top = 4.dp)) {
                    PhotoAttach(
                        max = NewConsultationUiState.MAX_PHOTOS,
                        photos = state.photos.map { it.jpeg },
                        enabled = !state.submitted,
                        add = vm::addPhoto,
                        remove = vm::removePhoto,
                    )
                }
                state.error?.let { error ->
                    Notice(Icons.Filled.ErrorOutline, stringResource(if (error == UiError.Offline) R.string.common_offline else R.string.common_error_title), null, palette.dangerInk)
                }
                Row(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.Top) {
                    Icon(Icons.Outlined.Visibility, contentDescription = null, Modifier.size(16.dp).padding(top = 2.dp), tint = palette.textSecondary)
                    Text(stringResource(R.string.consultations_public_note), style = MaterialTheme.typography.bodySmall, color = palette.textSecondary)
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
private fun PlainField(
    value: String,
    onChange: (String) -> Unit,
    placeholder: String,
    style: TextStyle,
    enabled: Boolean = true,
    modifier: Modifier = Modifier,
    counter: Pair<Int, Int>? = null,
    filled: Boolean = counter != null,
    minHeight: androidx.compose.ui.unit.Dp = 120.dp,
) {
    val palette = LocalPalette.current
    BasicTextField(
        value = value,
        onValueChange = onChange,
        enabled = enabled,
        textStyle = style.copy(color = MaterialTheme.colorScheme.onSurface),
        cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
        modifier = modifier.fillMaxWidth(),
        decorationBox = { inner ->
            Box(Modifier.fillMaxSize().then(if (filled) Modifier.clip(RoundedCornerShape(14.dp)).background(palette.inset).heightIn(min = minHeight).padding(14.dp) else Modifier)) {
                if (value.isEmpty()) Text(placeholder, style = style, color = palette.textTertiary)
                inner()
                if (counter != null && counter.first > 0 && counter.first < counter.second) {
                    Text(
                        stringResource(R.string.contribute_counter, counter.first.toString(), counter.second.toString()),
                        style = MaterialTheme.typography.labelMedium,
                        color = palette.textSecondary,
                        modifier = Modifier.align(Alignment.BottomEnd),
                    )
                }
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

/** A 48 dp chip with its label: the field's name until chosen, the choice after. */
@Composable
private fun AttachChip(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    tint: Color?,
    chosen: Boolean,
    problem: Boolean,
    description: String = label,
    onClick: () -> Unit,
) {
    val palette = LocalPalette.current
    Row(
        Modifier
            .heightIn(min = 48.dp)
            .clip(CircleShape)
            .background(palette.inset)
            .border(1.5.dp, if (problem) palette.dangerInk else Color.Transparent, CircleShape)
            .clickable(onClickLabel = description, role = Role.Button, onClick = onClick)
            .padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(icon, contentDescription = null, Modifier.size(18.dp), tint = tint ?: if (problem) palette.dangerInk else palette.textSecondary)
        Text(
            label,
            style = MaterialTheme.typography.labelLarge.copy(fontWeight = if (chosen) FontWeight.SemiBold else FontWeight.Normal),
            color = if (problem) palette.dangerInk else palette.text,
            maxLines = 1,
        )
    }
}

@Composable
private fun MenuChip(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    tint: Color?,
    chosen: Boolean,
    problem: Boolean,
    items: List<Triple<String, String, androidx.compose.ui.graphics.vector.ImageVector?>>,
    onPick: (String) -> Unit,
) {
    var open by androidx.compose.runtime.remember { mutableStateOf(false) }
    Box {
        AttachChip(icon, label, tint, chosen, problem) { open = true }
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
