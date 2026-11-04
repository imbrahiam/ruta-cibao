package rutacibao.android.feature.account

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
    PushedScreen(title = stringResource(R.string.offline_title), onBack = onBack) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(stringResource(R.string.offline_lede))
                    Text(stringResource(R.string.offline_map_note), style = MaterialTheme.typography.bodySmall)
                    Text(stringResource(if (state.version != null) R.string.offline_ready_badge else R.string.offline_not_downloaded_badge), style = MaterialTheme.typography.titleMedium)
                    state.generatedAt?.let { Text(stringResource(R.string.offline_saved_copy_notice, it)) }
                    if (state.downloading) CircularProgressIndicator()
                    Button(onClick = offline::download, enabled = !state.downloading, colors = rutaButtonColors()) { Text(stringResource(if (state.version == null) R.string.offline_download_action else R.string.offline_update_action)) }
                    state.error?.let { Text(stringResource(offlineError(it)), color = MaterialTheme.colorScheme.error) }
                    if (state.version != null) TextButton(onClick = offline::removeSnapshot) { Text(stringResource(R.string.offline_remove_action)) }
                }
            }
            item { PendingContributions() }
            if (state.version != null) {
                item { OutlinedTextField(query, { query = it }, label = { Text(stringResource(R.string.search_placeholder)) }, modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)) }
                item { Text("${stringResource(R.string.offline_places_row_title)} · ${places.size}", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(horizontal = 16.dp)) }
                items(places, key = { "place-${it.id}" }) { place ->
                    Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(place.name, style = MaterialTheme.typography.titleSmall)
                        Text("${place.category} · ${place.municipality}")
                        place.description?.let { Text(it) }
                        place.address?.let { Text(it) }
                        Text("${place.latitude}, ${place.longitude}", style = MaterialTheme.typography.bodySmall)
                    }
                }
                item { Text("${stringResource(R.string.offline_routes_row_title)} · ${routes.size}", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(horizontal = 16.dp)) }
                items(routes, key = { "route-${it.id}" }) { route ->
                    Column(Modifier.padding(horizontal = 16.dp)) {
                        Text(route.name, style = MaterialTheme.typography.titleSmall)
                        Text(route.description)
                        Text(route.municipalityName)
                    }
                }
                item { Text("${stringResource(R.string.offline_roads_row_title)} · ${roads.size}", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(horizontal = 16.dp)) }
                items(roads, key = { "road-${it.id}" }) { road -> Text(road.name ?: road.kind, modifier = Modifier.padding(horizontal = 16.dp)) }
            }
        }
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
