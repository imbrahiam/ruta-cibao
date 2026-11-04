package rutacibao.android.feature.contribute

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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.UnfoldMore
import androidx.compose.material.icons.outlined.LocalOffer
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material.icons.outlined.VerifiedUser
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
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.google.android.gms.maps.model.LatLng
import kotlinx.coroutines.delay
import rutacibao.android.R
import rutacibao.android.feature.map.LocationPickerDialog
import rutacibao.android.feature.map.StaticPinMap
import rutacibao.android.ui.CategoryAvatar
import rutacibao.android.ui.LocalAppGraph
import rutacibao.android.ui.LocalPalette
import rutacibao.android.ui.Notice
import rutacibao.android.ui.PrimaryButton
import rutacibao.android.ui.PushedScreen
import rutacibao.android.ui.categoryIcon
import rutacibao.android.ui.parseCategoryColor
import rutacibao.presentation.UiError
import rutacibao.presentation.contribute.SuggestPlaceUiState
import rutacibao.presentation.contribute.SuggestPlaceViewModel
import rutacibao.presentation.contribute.TrafficReportViewModel

// ------------------------------------------------------------------ road report

/** "Reportar la vía": pick what it is (big tappable tiles), where, send. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun TrafficReportScreen(onBack: () -> Unit, onSent: () -> Unit) {
    val graph = LocalAppGraph.current
    val vm: TrafficReportViewModel = viewModel { graph.viewModels.trafficReport() }
    val state by vm.state.collectAsStateWithLifecycle()
    val palette = LocalPalette.current
    var picking by rememberSaveable { mutableStateOf(false) }
    var detail by rememberSaveable { mutableStateOf("") }

    if (state.sent) {
        DoneScreen(stringResource(R.string.contribute_traffic_sent), stringResource(R.string.contribute_traffic_sent_body)) { onSent(); onBack() }
        return
    }
    PushedScreen(
        title = stringResource(R.string.contribute_traffic_title),
        onBack = onBack,
        bottomBar = { SubmitBar(stringResource(R.string.contribute_traffic_submit), state.sending, state.canSend, vm::send) },
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(22.dp),
        ) {
            val columns = (((LocalConfiguration.current.screenWidthDp - 32) + 10) / (104 + 10)).coerceAtLeast(2)
            FlowRow(
                maxItemsInEachRow = columns,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                state.categories.forEach { c ->
                    val selected = c.id == state.categoryId
                    val color = parseCategoryColor(c.color, palette.textSecondary)
                    val onColor = if (color.luminance() > 0.5f) Color.Black else Color.White
                    Column(
                        Modifier
                            .weight(1f)
                            .heightIn(min = 48.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(if (selected) color else palette.inset)
                            .selectable(selected = selected, role = Role.RadioButton) { vm.selectCategory(c.id) }
                            .padding(vertical = 14.dp, horizontal = 6.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Icon(categoryIcon(c.icon), contentDescription = null, Modifier.size(24.dp), tint = if (selected) onColor else color)
                        Text(
                            c.name,
                            style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold),
                            color = if (selected) onColor else palette.text,
                            textAlign = TextAlign.Center,
                            minLines = 2,
                            maxLines = 2,
                        )
                    }
                }
            }

            LocationRow(state.latitude, state.longitude, label = stringResource(R.string.contribute_place_location)) { picking = true }

            FieldBox(
                value = detail,
                onChange = { detail = it.take(280); vm.updateDescription(it) },
                placeholder = stringResource(R.string.contribute_traffic_description),
                minLines = 2,
            )

            if (state.duplicate) {
                Notice(Icons.Filled.Group, stringResource(R.string.contribute_traffic_duplicate), stringResource(R.string.contribute_traffic_duplicate_body), palette.warningInk)
            } else if (state.error != null) {
                SendError(state.error)
            }
        }
    }
    if (picking) {
        LocationPickerDialog(
            start = state.latitude?.let { la -> state.longitude?.let { lo -> LatLng(la, lo) } },
            onDismiss = { picking = false },
            onPicked = { vm.setLocation(it.latitude, it.longitude) },
        )
    }
}

// ------------------------------------------------------------------ place suggestion

@Composable
fun SuggestPlaceScreen(onBack: () -> Unit, onSent: () -> Unit) {
    val graph = LocalAppGraph.current
    val vm: SuggestPlaceViewModel = viewModel { graph.viewModels.suggestPlace() }
    val state by vm.state.collectAsStateWithLifecycle()
    val palette = LocalPalette.current
    var picking by rememberSaveable { mutableStateOf(false) }
    var name by rememberSaveable { mutableStateOf("") }
    var about by rememberSaveable { mutableStateOf("") }
    var address by rememberSaveable { mutableStateOf("") }
    var menu by remember { mutableStateOf(false) }

    if (state.sent) {
        DoneScreen(stringResource(R.string.contribute_place_sent), stringResource(R.string.contribute_place_sent_body)) { onSent(); onBack() }
        return
    }
    val chosen = state.categories.firstOrNull { it.id == state.categoryId }
    PushedScreen(
        title = stringResource(R.string.contribute_place_title),
        onBack = onBack,
        bottomBar = { SubmitBar(stringResource(R.string.contribute_place_submit), state.sending, !state.sending, vm::send) },
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            FieldBox(name, { name = it.take(100); vm.updateName(it) }, stringResource(R.string.contribute_place_name), bold = true)
            Problem(SuggestPlaceUiState.Problem.Name in state.problems, stringResource(R.string.contribute_place_errors_name))

            FieldBox(about, { about = it.take(600); vm.updateDescription(it) }, stringResource(R.string.contribute_place_description_helper), minLines = 3)
            Problem(SuggestPlaceUiState.Problem.Description in state.problems, stringResource(R.string.contribute_place_errors_description))

            Box {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(palette.inset)
                        .clickable(role = Role.DropdownList) { menu = true }
                        .heightIn(min = 56.dp)
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    if (chosen != null) {
                        CategoryAvatar(chosen.icon, chosen.color, 32.dp)
                    } else {
                        Box(Modifier.size(32.dp), Alignment.Center) { Icon(Icons.Outlined.LocalOffer, contentDescription = null, Modifier.size(20.dp), tint = palette.textSecondary) }
                    }
                    Text(
                        chosen?.name ?: stringResource(R.string.contribute_place_category),
                        style = MaterialTheme.typography.bodyMedium.copy(fontSize = 15.sp),
                        color = if (chosen == null) palette.textTertiary else palette.text,
                        modifier = Modifier.weight(1f),
                    )
                    Icon(Icons.Filled.UnfoldMore, contentDescription = null, Modifier.size(18.dp), tint = palette.textTertiary)
                }
                DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                    state.categories.forEach { c ->
                        DropdownMenuItem(
                            text = { Text(c.name) },
                            leadingIcon = { Icon(categoryIcon(c.icon), contentDescription = null, tint = parseCategoryColor(c.color, palette.textSecondary)) },
                            onClick = { menu = false; vm.selectCategory(c.id) },
                        )
                    }
                }
            }
            Problem(SuggestPlaceUiState.Problem.Category in state.problems, stringResource(R.string.contribute_place_errors_category))

            LocationRow(state.latitude, state.longitude, label = stringResource(R.string.contribute_place_location)) { picking = true }
            Problem(SuggestPlaceUiState.Problem.Location in state.problems, stringResource(R.string.contribute_place_errors_location))

            FieldBox(address, { address = it.take(240); vm.updateAddress(it) }, stringResource(R.string.contribute_place_address))

            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(Icons.Outlined.VerifiedUser, contentDescription = null, Modifier.size(16.dp).padding(top = 2.dp), tint = palette.textTertiary)
                Text(stringResource(R.string.contribute_review_note), style = MaterialTheme.typography.bodySmall, color = palette.textTertiary)
            }
            if (state.error != null) SendError(state.error)
        }
    }
    if (picking) {
        LocationPickerDialog(
            start = state.latitude?.let { la -> state.longitude?.let { lo -> LatLng(la, lo) } },
            onDismiss = { picking = false },
            onPicked = { vm.setLocation(it.latitude, it.longitude) },
        )
    }
}

// ------------------------------------------------------------------ shared pieces

@Composable
internal fun SendError(error: UiError?) {
    Notice(
        Icons.Filled.ErrorOutline,
        stringResource(if (error == UiError.Offline) R.string.common_offline else R.string.common_error_title),
        null,
        LocalPalette.current.dangerInk,
    )
}

@Composable
internal fun Problem(show: Boolean, text: String) {
    if (!show) return
    Row(Modifier.padding(top = (-10).dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Filled.ErrorOutline, contentDescription = null, Modifier.size(16.dp), tint = LocalPalette.current.dangerInk)
        Text(text, style = MaterialTheme.typography.labelMedium, color = LocalPalette.current.dangerInk)
    }
}

/** A filled, rounded text field with its placeholder inside. */
@Composable
internal fun FieldBox(
    value: String,
    onChange: (String) -> Unit,
    placeholder: String,
    bold: Boolean = false,
    minLines: Int = 1,
    keyboardType: androidx.compose.ui.text.input.KeyboardType = androidx.compose.ui.text.input.KeyboardType.Text,
) {
    val palette = LocalPalette.current
    val style = TextStyle(fontSize = 15.sp, lineHeight = 21.sp, fontWeight = if (bold) FontWeight.SemiBold else FontWeight.Normal)
    BasicTextField(
        value = value,
        onValueChange = onChange,
        textStyle = style.copy(color = MaterialTheme.colorScheme.onSurface),
        cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
        minLines = minLines,
        maxLines = if (minLines > 1) minLines + 5 else 3,
        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = keyboardType),
        modifier = Modifier.fillMaxWidth(),
        decorationBox = { inner ->
            Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(palette.inset).heightIn(min = 52.dp).padding(14.dp), Alignment.CenterStart) {
                if (value.isEmpty()) Text(placeholder, style = style, color = palette.textTertiary)
                inner()
            }
        },
    )
}

/** Where it is: a small live map once marked, a "Marcar" row before. */
@Composable
fun LocationRow(latitude: Double?, longitude: Double?, label: String, pick: () -> Unit) {
    val palette = LocalPalette.current
    if (latitude != null && longitude != null) {
        Box(Modifier.fillMaxWidth().height(140.dp).clip(RoundedCornerShape(16.dp)).clickable(role = Role.Button, onClick = pick)) {
            StaticPinMap(latitude, longitude, palette.pin, 500.0, Modifier.fillMaxSize())
            // Taps go to the row, not the lite map underneath.
            Box(Modifier.fillMaxSize().clickable(role = Role.Button, onClick = pick))
            Surface(
                Modifier.align(Alignment.BottomEnd).padding(10.dp),
                shape = RoundedCornerShape(50),
                color = MaterialTheme.colorScheme.surfaceContainer,
                shadowElevation = 3.dp,
            ) {
                Text(
                    stringResource(R.string.contribute_change),
                    style = MaterialTheme.typography.labelLarge,
                    modifier = Modifier.padding(horizontal = 12.dp).heightIn(min = 30.dp).wrapContentHeightCenter(),
                )
            }
        }
    } else {
        Row(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(palette.inset)
                .clickable(role = Role.Button, onClick = pick)
                .heightIn(min = 56.dp)
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(Modifier.size(32.dp), Alignment.Center) { Icon(Icons.Outlined.LocationOn, contentDescription = null, Modifier.size(20.dp), tint = palette.textSecondary) }
            Text(label, style = MaterialTheme.typography.bodyMedium.copy(fontSize = 15.sp), color = palette.textTertiary, modifier = Modifier.weight(1f))
            Text(stringResource(R.string.contribute_mark), style = MaterialTheme.typography.titleSmall)
        }
    }
}

private fun Modifier.wrapContentHeightCenter(): Modifier = this.then(Modifier.padding(vertical = 6.dp))

@Composable
internal fun SubmitBar(title: String, busy: Boolean, enabled: Boolean, onClick: () -> Unit) {
    Surface(color = MaterialTheme.colorScheme.surfaceContainer) {
        Box(Modifier.windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Bottom)).padding(horizontal = 16.dp, vertical = 8.dp)) {
            PrimaryButton(title, onClick, Modifier.fillMaxWidth(), enabled = enabled, busy = busy)
        }
    }
}

/** Sent: a big check, two short lines, then back. */
@Composable
fun DoneScreen(title: String, detail: String, finish: () -> Unit) {
    val palette = LocalPalette.current
    LaunchedEffect(Unit) {
        delay(1600)
        finish()
    }
    Column(
        Modifier.fillMaxSize().padding(32.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(Icons.Filled.CheckCircle, contentDescription = null, Modifier.size(72.dp), tint = palette.success)
        Text(title, style = MaterialTheme.typography.titleLarge, textAlign = TextAlign.Center)
        Text(detail, style = MaterialTheme.typography.bodyMedium, color = palette.textSecondary, textAlign = TextAlign.Center)
    }
}
