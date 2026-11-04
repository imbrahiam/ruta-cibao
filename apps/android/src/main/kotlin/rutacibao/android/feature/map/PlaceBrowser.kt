package rutacibao.android.feature.map

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Map
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import rutacibao.android.R
import rutacibao.android.ui.ErrorState
import rutacibao.android.ui.Hairline
import rutacibao.android.ui.LoadingState
import rutacibao.android.ui.LocalPalette
import rutacibao.android.ui.Notice
import rutacibao.presentation.UiError
import rutacibao.presentation.map.MapUiState
import rutacibao.presentation.map.MapViewModel
import rutacibao.presentation.map.PlaceSheet

/** First-party content remains usable when this build cannot initialize Google's basemap. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun PlaceBrowser(vm: MapViewModel, state: MapUiState, modifier: Modifier = Modifier) {
    var query by rememberSaveable { mutableStateOf("") }
    Column(modifier.fillMaxSize()) {
        Notice(
            Icons.Outlined.Map, stringResource(R.string.map_basemap_unavailable),
            stringResource(R.string.map_basemap_unavailable_body), LocalPalette.current.textSecondary,
            Modifier.padding(16.dp),
        )
        OutlinedTextField(
            value = query, onValueChange = { query = it },
            label = { Text(stringResource(R.string.map_search_placeholder)) },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp), singleLine = true,
        )
        when (state.phase) {
            MapUiState.Phase.Loading -> LoadingState()
            MapUiState.Phase.Failed -> ErrorState(state.error ?: UiError.Unknown, vm::retry)
            MapUiState.Phase.Ready -> LazyColumn {
                items(state.routes.filter { query.isBlank() || it.name.contains(query, ignoreCase = true) }, key = { "route:${it.id}" }) { route ->
                    BrowserRow(route.name, route.categoryName) { vm.selectRoute(route.id) }
                }
                items(state.places.filter { query.isBlank() || it.name.contains(query, ignoreCase = true) || it.categoryName.contains(query, ignoreCase = true) }, key = { it.id }) { place ->
                    BrowserRow(place.name, place.categoryName) { vm.select(place.id) }
                }
            }
        }
    }
    state.sheet?.let { sheet ->
        ModalBottomSheet(onDismissRequest = vm::dismissSheet) { PlaceDetail(sheet, vm) }
    }
    state.route?.let { route ->
        ModalBottomSheet(onDismissRequest = vm::dismissRoute) { RouteSheet(route) }
    }
    state.selectedTraffic?.let { notice ->
        ModalBottomSheet(onDismissRequest = vm::dismissTraffic) {
            TrafficSheet(notice, state.trafficError, vm::confirmTraffic, onClose = vm::dismissTraffic)
        }
    }
}

@Composable
private fun BrowserRow(title: String, subtitle: String, onClick: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().heightIn(min = 64.dp).clickable(role = Role.Button, onClick = onClick).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(title, style = MaterialTheme.typography.titleMedium)
        Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = LocalPalette.current.textSecondary)
    }
    Hairline()
}

@Composable
internal fun PlaceDetail(sheet: PlaceSheet, vm: MapViewModel, modifier: Modifier = Modifier) {
    PlaceSheet(
        sheet, onSave = vm::toggleSaved, onRequestClaim = vm::requestClaim, onBusinessChanged = vm::refreshBusiness,
        onConfirm = vm::confirmPlace, onReport = vm::openPlaceReport,
        onReportReason = vm::updatePlaceReportReason, onReportDetails = vm::updatePlaceReportDetails,
        onSubmitReport = vm::submitPlaceReport, onCloseReport = vm::closePlaceReport, onClose = vm::dismissSheet, modifier = modifier,
    )
}
