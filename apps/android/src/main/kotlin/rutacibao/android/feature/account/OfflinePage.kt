package rutacibao.android.feature.account

import android.text.format.DateUtils
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.outlined.CloudDownload
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.ui.Alignment
import rutacibao.android.ui.LocalPalette
import rutacibao.android.ui.raised
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import rutacibao.android.R
import rutacibao.android.ui.LocalAppGraph
import rutacibao.android.ui.PushedScreen
import rutacibao.android.ui.rutaButtonColors
import rutacibao.data.PendingContribution

@Composable
fun OfflinePage(onBack: () -> Unit) {
    val offline = LocalAppGraph.current.offline
    val state by offline.state.collectAsStateWithLifecycle()
    var query by rememberSaveable { mutableStateOf("") }
    val places = remember(state.version, query) { offline.cachedPlaces().filter { "$it".contains(query, ignoreCase = true) } }
    val routes = remember(state.version, query) { offline.cachedRoutes().filter { "${it.name} ${it.description} ${it.municipalityName}".contains(query, ignoreCase = true) } }
    val roads = remember(state.version, query) { offline.cachedRoads().filter { it.name.orEmpty().contains(query, ignoreCase = true) } }
    val palette = LocalPalette.current
    val dark = isSystemInDarkTheme()
    val ready = state.version != null
    // The snapshot's ISO timestamp as "hace 3 días", never the raw string.
    val updated = remember(state.generatedAt) {
        state.generatedAt?.let { raw ->
            runCatching { java.time.Instant.parse(raw).toEpochMilli() }.getOrNull()
                ?.let { DateUtils.getRelativeTimeSpanString(it, System.currentTimeMillis(), DateUtils.DAY_IN_MILLIS).toString() }
        }
    }
    PushedScreen(title = stringResource(R.string.offline_title), onBack = onBack) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(bottom = 24.dp)) {
            item {
                Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    // Status first: one glance says whether the phone is ready without signal.
                    Column(
                        Modifier.fillMaxWidth().background(palette.raised(dark), RoundedCornerShape(24.dp)).padding(vertical = 24.dp, horizontal = 16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Icon(
                            if (ready) Icons.Filled.CheckCircle else Icons.Outlined.CloudDownload,
                            contentDescription = null,
                            modifier = Modifier.size(52.dp).padding(bottom = 4.dp),
                            tint = if (ready) palette.success else palette.textSecondary,
                        )
                        Text(stringResource(if (ready) R.string.offline_ready_badge else R.string.offline_not_downloaded_badge), style = MaterialTheme.typography.titleLarge)
                        if (ready && updated != null) {
                            Text("${stringResource(R.string.offline_version_date)} $updated", style = MaterialTheme.typography.bodyMedium, color = palette.textSecondary)
                        }
                    }
                    Text(stringResource(R.string.offline_lede), style = MaterialTheme.typography.bodySmall, color = palette.textSecondary, modifier = Modifier.padding(horizontal = 4.dp))
                    Button(onClick = offline::download, enabled = !state.downloading, colors = rutaButtonColors(), modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) {
                        if (state.downloading) {
                            CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = LocalContentColor.current)
                            Spacer(Modifier.width(10.dp))
                        }
                        Text(stringResource(if (state.downloading) R.string.offline_downloading_action else if (ready) R.string.offline_update_action else R.string.offline_download_action))
                    }
                    state.error?.let { Text(stringResource(offlineError(it)), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                    if (ready) {
                        TextButton(onClick = offline::removeSnapshot, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)) {
                            Text(stringResource(R.string.offline_remove_action))
                        }
                    }
                }
            }
            // The outbox only earns its place when something is waiting.
            item { PendingContributions(hideWhenEmpty = true) }
            if (ready) {
                item {
                    OutlinedTextField(
                        query, { query = it },
                        placeholder = { Text(stringResource(R.string.search_placeholder)) },
                        leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null) },
                        singleLine = true,
                        shape = RoundedCornerShape(28.dp),
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                    )
                }
                if (places.isNotEmpty()) item { SectionTitle(stringResource(R.string.offline_places_row_title)) }
                items(places, key = { "place-${it.id}" }) { place -> OfflineRow(place.name, "${place.category} · ${place.municipality}") }
                if (routes.isNotEmpty()) item { SectionTitle(stringResource(R.string.offline_routes_row_title)) }
                items(routes, key = { "route-${it.id}" }) { route -> OfflineRow(route.name, route.municipalityName) }
                if (roads.isNotEmpty()) item { SectionTitle(stringResource(R.string.offline_roads_row_title)) }
                items(roads, key = { "road-${it.id}" }) { road -> OfflineRow(road.name ?: road.kind, null) }
            }
        }
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(text, style = MaterialTheme.typography.titleSmall, color = LocalPalette.current.textSecondary, modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 20.dp, bottom = 4.dp))
}

/** One saved item: its name and one quiet line of context, a hairline below. */
@Composable
private fun OfflineRow(title: String, detail: String?) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
        Column(Modifier.padding(vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, style = MaterialTheme.typography.bodyLarge)
            if (detail != null) Text(detail, style = MaterialTheme.typography.bodyMedium, color = LocalPalette.current.textSecondary)
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
    }
}

@Composable
fun PendingContributions(hideWhenEmpty: Boolean = false) {
    val offline = LocalAppGraph.current.offline
    val state by offline.state.collectAsStateWithLifecycle()
    if (hideWhenEmpty && state.pending.isEmpty()) return
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(stringResource(R.string.offline_outbox_section), style = MaterialTheme.typography.titleMedium)
        if (state.pending.isEmpty()) Text(stringResource(R.string.offline_outbox_empty))
        else {
            TextButton(onClick = offline::flush, enabled = !state.syncing) { Text(stringResource(if (state.syncing) R.string.offline_outbox_flushing else R.string.offline_outbox_flush_action)) }
            state.pending.forEach { entry ->
                Text(stringResource(procedureLabel(entry)), style = MaterialTheme.typography.titleSmall)
                Text(stringResource(if (entry.blocked) R.string.offline_outbox_status_blocked else R.string.offline_outbox_status_waiting))
                if (entry.blocked) Text(stringResource(outboxError(entry.error)), color = MaterialTheme.colorScheme.error)
                Row {
                    TextButton(onClick = { offline.retry(entry.id) }, enabled = !state.syncing) { Text(stringResource(R.string.offline_outbox_retry_action)) }
                    TextButton(onClick = { offline.discard(entry.id) }, enabled = !state.syncing) { Text(stringResource(R.string.offline_outbox_remove_action)) }
                }
            }
        }
    }
}

private fun procedureLabel(entry: PendingContribution): Int = when (entry.procedure) {
    "traffic_report" -> R.string.offline_outbox_procedure_traffic_report
    "consultations_open" -> R.string.offline_outbox_procedure_consultations_open
    "places_report" -> R.string.offline_outbox_procedure_places_report
    else -> R.string.offline_outbox_procedure_places_submit
}
private fun outboxError(error: String?): Int = when (error) {
    "stale_report" -> R.string.offline_outbox_errors_stale_report
    "duplicate" -> R.string.offline_outbox_errors_duplicate
    "municipality_mismatch" -> R.string.offline_outbox_errors_municipality_mismatch
    "outside_province" -> R.string.offline_outbox_errors_outside_province
    "invalid_street" -> R.string.offline_outbox_errors_invalid_street
    "unauthorized", "unauthenticated" -> R.string.offline_outbox_errors_unauthenticated
    else -> R.string.offline_outbox_errors_generic
}
private fun offlineError(error: String): Int = when (error) {
    "checksum_mismatch" -> R.string.offline_errors_checksum_mismatch
    "size_mismatch" -> R.string.offline_errors_size_mismatch
    "schema_invalid" -> R.string.offline_errors_schema_invalid
    "version_mismatch" -> R.string.offline_errors_version_mismatch
    "origin_mismatch" -> R.string.offline_errors_origin_mismatch
    "invalid_manifest" -> R.string.offline_errors_invalid_manifest
    else -> R.string.offline_errors_network
}
