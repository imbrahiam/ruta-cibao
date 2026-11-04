package rutacibao.android.feature.gestion

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.clickable
import androidx.compose.foundation.background
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Forum
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Report
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.PictureAsPdf
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LargeTopAppBar
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.rememberModalBottomSheetState
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import rutacibao.android.R
import rutacibao.android.ui.EmptyState
import rutacibao.android.ui.ErrorState
import rutacibao.android.ui.LoadingState
import rutacibao.android.ui.LocalAppGraph
import rutacibao.android.ui.LocalPalette
import rutacibao.android.ui.PrimaryButton
import rutacibao.android.ui.relativeTimeText
import rutacibao.api.generated.ReportsListItem
import rutacibao.presentation.UiError
import rutacibao.presentation.gestion.GestionUiState
import rutacibao.presentation.gestion.GestionViewModel
import rutacibao.presentation.gestion.NoteRequest
import rutacibao.presentation.gestion.PdfState
import rutacibao.presentation.gestion.Emphasis
import rutacibao.presentation.gestion.ReviewAction
import rutacibao.presentation.gestion.ReviewItem
import rutacibao.presentation.gestion.ReviewKind
import rutacibao.presentation.gestion.StepUpState

private val Inset = 16.dp

/**
 * Staff triage away from a desk: the latest weekly report, then one mixed queue of cards, each
 * with two equal buttons. Full admin stays on the web. `debugStepUp` is the debug-build hook
 * that shows the second-factor sheet without the server asking for it.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GestionScreen(
    onBack: () -> Unit,
    onOpenConsultation: (String) -> Unit = {},
    debugStepUp: Boolean = false,
    linkedReportId: String? = null,
    linkRequestId: Long = 0,
) {
    val graph = LocalAppGraph.current
    val vm: GestionViewModel = viewModel(key = "gestion") { graph.viewModels.gestion() }
    val state by vm.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var downloadFailed by remember { mutableStateOf(false) }
    var forcedStepUp by remember { mutableStateOf<StepUpState?>(if (debugStepUp) StepUpState.Asking() else null) }
    val scroll = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
    LaunchedEffect(linkedReportId, linkRequestId) {
        linkedReportId?.let(vm::openLinkedReport)
    }

    LaunchedEffect(state.pdfUrl) {
        val url = state.pdfUrl ?: return@LaunchedEffect
        val report = state.latestReport
        val opened = runCatching { downloadReport(context, url, report) }.getOrNull()
        if (opened == null) downloadFailed = true else openReport(context, opened)
        vm.pdfHandled()
    }

    Scaffold(
        modifier = Modifier.nestedScroll(scroll.nestedScrollConnection),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            LargeTopAppBar(
                title = { Text(stringResource(R.string.gestion_title), maxLines = 1, overflow = TextOverflow.Ellipsis) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.common_back))
                    }
                },
                scrollBehavior = scroll,
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    scrolledContainerColor = MaterialTheme.colorScheme.background,
                ),
            )
        },
    ) { padding ->
        PullToRefreshBox(isRefreshing = state.refreshing, onRefresh = vm::refresh, modifier = Modifier.padding(padding).fillMaxSize()) {
            Content(state, vm, downloadFailed = downloadFailed, onOpenConsultation = onOpenConsultation, onOpenReport = { downloadFailed = false; vm.openReport() })
        }
    }

    state.noteFor?.let { NoteSheet(it, onSend = vm::submitNote, onDismiss = vm::dismissNote) }

    val stepUp = forcedStepUp ?: state.stepUp
    StepUpSheet(
        state = stepUp,
        onVerify = { if (forcedStepUp == null) vm.verifyStepUp(it) },
        onUseRecovery = { recovery ->
            forcedStepUp = forcedStepUp?.let { StepUpState.Asking(recovery = recovery) }
            vm.useRecoveryCode(recovery)
        },
        onDismiss = { forcedStepUp = null; vm.dismissStepUp() },
    )

    if (state.error != null && state.phase != GestionUiState.Phase.Failed) {
        AlertDialog(
            onDismissRequest = vm::errorHandled,
            title = { Text(stringResource(R.string.common_error_title)) },
            text = { Text(stringResource(if (state.error == UiError.Offline) R.string.common_offline_body else R.string.common_error_body)) },
            confirmButton = { TextButton(onClick = vm::errorHandled) { Text(stringResource(R.string.common_close)) } },
        )
    }
}

@Composable
private fun Content(
    state: GestionUiState,
    vm: GestionViewModel,
    downloadFailed: Boolean,
    onOpenConsultation: (String) -> Unit,
    onOpenReport: () -> Unit,
) {
    when (state.phase) {
        GestionUiState.Phase.Loading -> LoadingState()
        GestionUiState.Phase.Failed -> ErrorState(state.error ?: UiError.Unknown, onRetry = vm::retry)
        GestionUiState.Phase.Empty, GestionUiState.Phase.Ready -> LazyColumn(
            Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            state.latestReport?.let { report ->
                item(key = "report") {
                    ReportRow(
                        report,
                        loading = state.pdf == PdfState.Loading,
                        unavailable = state.pdf == PdfState.Unavailable || downloadFailed,
                        onOpen = onOpenReport,
                    )
                }
            }
            if (state.phase == GestionUiState.Phase.Empty) {
                item(key = "empty") {
                    Box(Modifier.fillMaxWidth().height(320.dp)) {
                        EmptyState(stringResource(R.string.gestion_empty), null)
                    }
                }
            } else {
                item(key = "chips") { Chips(state, vm::select) }
                items(state.visibleItems, key = { it.id }) { item ->
                    ReviewCard(item, busy = item.id in state.inFlight) { action ->
                        when (action) {
                            is ReviewAction.Decide -> vm.decide(item, action)
                            is ReviewAction.OpenThread -> onOpenConsultation(action.slug)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Chips(state: GestionUiState, select: (ReviewKind?) -> Unit) {
    Row(
        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = Inset),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        KindChip(stringResource(R.string.gestion_all) + " " + state.total, Icons.Outlined.CheckCircle, state.filter == null) { select(null) }
        state.filters.forEach { entry ->
            KindChip("${stringResource(entry.kind.title)} ${entry.count}", entry.kind.glyph, state.filter == entry.kind) { select(entry.kind) }
        }
    }
}

@Composable
private fun KindChip(label: String, icon: ImageVector, selected: Boolean, onClick: () -> Unit) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = { Text(label, style = MaterialTheme.typography.labelLarge) },
        leadingIcon = { Icon(if (selected) Icons.Filled.Check else icon, contentDescription = null, Modifier.size(18.dp)) },
        modifier = Modifier.heightIn(min = 48.dp),
    )
}

@Composable
private fun ReportRow(report: ReportsListItem, loading: Boolean, unavailable: Boolean, onOpen: () -> Unit) {
    val palette = LocalPalette.current
    Column(Modifier.padding(horizontal = Inset), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(
            Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(MaterialTheme.colorScheme.surfaceContainer)
                .clickable(enabled = !loading, role = Role.Button, onClick = onOpen)
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Icon(Icons.Outlined.PictureAsPdf, contentDescription = null, Modifier.size(24.dp))
            Column(Modifier.weight(1f)) {
                Text(stringResource(R.string.gestion_weekly), style = MaterialTheme.typography.titleSmall)
                Text("${report.municipalityName} · ${period(report)}", style = MaterialTheme.typography.bodyMedium, color = palette.textSecondary)
            }
            if (loading) {
                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
            } else {
                Icon(Icons.AutoMirrored.Outlined.OpenInNew, contentDescription = null, Modifier.size(20.dp), tint = palette.textTertiary)
            }
        }
        if (unavailable) {
            Text(stringResource(R.string.gestion_weekly_unavailable), style = MaterialTheme.typography.bodyMedium, color = palette.dangerInk)
        }
    }
}

private val PeriodFormat = DateTimeFormatter.ofPattern("d MMM", Locale.forLanguageTag("es-DO"))

private fun period(report: ReportsListItem): String {
    val zone = ZoneId.systemDefault()
    fun day(i: kotlin.time.Instant) = PeriodFormat.format(Instant.ofEpochMilli(i.toEpochMilliseconds()).atZone(zone))
    return "${day(report.periodStart)} – ${day(report.periodEnd)}"
}

private suspend fun downloadReport(context: Context, url: String, report: ReportsListItem?): File = withContext(Dispatchers.IO) {
    val folder = File(context.cacheDir, "informes").apply { mkdirs() }
    val label = report?.municipalityName?.replace(Regex("[^\\p{L}\\p{N} ]"), "") ?: "Gestion"
    val target = File(folder, "Informe semanal $label.pdf")
    val connection = URL(url).openConnection() as HttpURLConnection
    try {
        connection.connectTimeout = 15_000
        connection.readTimeout = 30_000
        check(connection.responseCode in 200..299) { "HTTP ${connection.responseCode}" }
        connection.inputStream.use { input -> target.outputStream().use { input.copyTo(it) } }
    } finally {
        connection.disconnect()
    }
    target
}

/** Opens the PDF in whatever viewer is installed, and falls back to the share sheet. */
private fun openReport(context: Context, file: File) {
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
    val view = Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/pdf").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    try {
        context.startActivity(view.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    } catch (_: ActivityNotFoundException) {
        val send = Intent(Intent.ACTION_SEND)
            .setType("application/pdf")
            .putExtra(Intent.EXTRA_STREAM, uri)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        context.startActivity(Intent.createChooser(send, context.getString(R.string.common_share)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}

// ------------------------------------------------------------------ cards

private val ReviewKind.title: Int
    get() = when (this) {
        ReviewKind.Place -> R.string.gestion_kind_place
        ReviewKind.PlaceReport -> R.string.gestion_kind_place_report
        ReviewKind.Photo -> R.string.gestion_kind_photo
        ReviewKind.Claim -> R.string.gestion_kind_claim
        ReviewKind.Traffic -> R.string.gestion_kind_traffic
        ReviewKind.ContentReport -> R.string.gestion_kind_content_report
        ReviewKind.Consultation -> R.string.gestion_kind_consultation
    }

private val ReviewKind.glyph: ImageVector
    get() = when (this) {
        ReviewKind.Place -> Icons.Filled.LocationOn
        ReviewKind.PlaceReport -> Icons.Filled.Flag
        ReviewKind.Photo -> Icons.Filled.Image
        ReviewKind.Claim -> Icons.Filled.Storefront
        ReviewKind.Traffic -> Icons.Filled.Warning
        ReviewKind.ContentReport -> Icons.Filled.Report
        ReviewKind.Consultation -> Icons.Filled.Forum
    }

private fun stateLabel(key: String): Int = when (key) {
    "gestion.state.textPending" -> R.string.gestion_state_text_pending
    "gestion.state.textPublished" -> R.string.gestion_state_text_published
    "gestion.state.textHidden" -> R.string.gestion_state_text_hidden
    "gestion.state.casePending" -> R.string.gestion_state_case_pending
    else -> R.string.gestion_state_case_published
}

/** The catalogue key a review button names, as a string resource. */
private fun actionLabel(labelKey: String): Int = when (labelKey) {
    "gestion.action.publish" -> R.string.gestion_action_publish
    "gestion.action.reject" -> R.string.gestion_action_reject
    "gestion.action.resolve" -> R.string.gestion_action_resolve
    "gestion.action.dismiss" -> R.string.gestion_action_dismiss
    "gestion.action.approve" -> R.string.gestion_action_approve
    "gestion.action.hide" -> R.string.gestion_action_hide
    "gestion.action.remove" -> R.string.gestion_action_remove
    "gestion.action.removeTraffic" -> R.string.gestion_action_remove_traffic
    "gestion.action.publishText" -> R.string.gestion_action_publish_text
    "gestion.action.hideText" -> R.string.gestion_action_hide_text
    "gestion.action.hideCase" -> R.string.gestion_action_hide_case
    "gestion.action.respond" -> R.string.gestion_action_respond
    else -> R.string.gestion_action_reject
}

@Composable
private fun ReviewCard(item: ReviewItem, busy: Boolean, act: (ReviewAction) -> Unit) {
    val palette = LocalPalette.current
    Column(
        Modifier
            .padding(horizontal = Inset)
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(MaterialTheme.colorScheme.surfaceContainer)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Icon(item.kind.glyph, contentDescription = null, Modifier.size(16.dp), tint = palette.textSecondary)
            Text(
                stringResource(item.kind.title),
                style = MaterialTheme.typography.labelLarge,
                color = palette.textSecondary,
            )
            item.stateKey?.let { key ->
                Spacer(Modifier.weight(1f))
                Text(
                    stringResource(stateLabel(key)),
                    style = MaterialTheme.typography.labelMedium,
                    color = palette.textSecondary,
                    modifier = Modifier.clip(CircleShape).background(palette.inset).padding(horizontal = 10.dp, vertical = 4.dp),
                )
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(item.title, style = MaterialTheme.typography.titleMedium)
            Text(
                "${item.municipality} · ${relativeTimeText(item.createdAt)}",
                style = MaterialTheme.typography.bodyMedium,
                color = palette.textSecondary,
            )
        }
        item.imageUrl?.let { url ->
            AsyncImage(
                model = url,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxWidth().height(140.dp).clip(RoundedCornerShape(12.dp)).background(palette.inset),
            )
        }
        if (item is ReviewItem.Consultation) {
            item.photoUrls.forEachIndexed { index, url ->
                AsyncImage(
                    model = url,
                    contentDescription = stringResource(R.string.contribute_photos_photo_label, index + 1),
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.fillMaxWidth().height(240.dp).clip(RoundedCornerShape(12.dp)).background(palette.inset),
                )
            }
        }
        item.snippet?.takeIf { it.isNotBlank() }?.let {
            Text(it, style = MaterialTheme.typography.bodyMedium, maxLines = 3, overflow = TextOverflow.Ellipsis)
        }
        val primary = item.actions.firstOrNull { it.emphasis == Emphasis.Primary }
        val secondary = item.actions.filter { it.emphasis == Emphasis.Secondary }
        if (secondary.size <= 1) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                secondary.forEach { ActionButton(it, busy, act, primary = false, Modifier.weight(1f)) }
                primary?.let { ActionButton(it, busy, act, primary = true, Modifier.weight(1f)) }
            }
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                primary?.let { ActionButton(it, busy, act, primary = true, Modifier.fillMaxWidth()) }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    secondary.forEach { ActionButton(it, busy, act, primary = false, Modifier.weight(1f)) }
                }
            }
        }
    }
}

@Composable
private fun ActionButton(action: ReviewAction, busy: Boolean, act: (ReviewAction) -> Unit, primary: Boolean, modifier: Modifier) {
    val label = @Composable { Text(stringResource(actionLabel(action.labelKey)), fontWeight = FontWeight.SemiBold) }
    val size = modifier.heightIn(min = 48.dp)
    if (primary) Button(onClick = { act(action) }, enabled = !busy, modifier = size) { label() }
    else OutlinedButton(onClick = { act(action) }, enabled = !busy, modifier = size) { label() }
}

// ------------------------------------------------------------------ reason sheet

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NoteSheet(request: NoteRequest, onSend: (String) -> Unit, onDismiss: () -> Unit) {
    var note by rememberSaveable { mutableStateOf("") }
    val palette = LocalPalette.current
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(
            Modifier.fillMaxWidth().imePadding().navigationBarsPadding().padding(horizontal = 24.dp).padding(bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                stringResource(R.string.gestion_note_title),
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier.semantics { heading() },
            )
            Text(request.item.title, style = MaterialTheme.typography.bodyMedium, color = palette.textSecondary, maxLines = 2, overflow = TextOverflow.Ellipsis)
            OutlinedTextField(
                value = note,
                onValueChange = { note = it },
                placeholder = { Text(stringResource(R.string.gestion_note_hint)) },
                minLines = 3,
                maxLines = 6,
                isError = request.tooShort,
                modifier = Modifier.fillMaxWidth(),
            )
            if (request.tooShort) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.ErrorOutline, contentDescription = null, Modifier.size(18.dp), tint = palette.dangerInk)
                    Text(stringResource(R.string.gestion_note_too_short), style = MaterialTheme.typography.bodyMedium, color = palette.dangerInk)
                }
            }
            PrimaryButton(
                stringResource(actionLabel(request.action.labelKey)),
                { onSend(note) },
                Modifier.fillMaxWidth(),
            )
        }
    }
}
