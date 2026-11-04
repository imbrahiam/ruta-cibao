package rutacibao.android.feature.account

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.PersonOff
import androidx.compose.material.icons.filled.PhoneAndroid
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.semantics.toggleableState
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale
import rutacibao.android.BuildConfig
import rutacibao.android.R
import rutacibao.android.ui.BrandMark
import rutacibao.android.ui.CategoryAvatar
import rutacibao.android.ui.Hairline
import rutacibao.android.ui.LocalAppGraph
import rutacibao.android.ui.LocalPalette
import rutacibao.android.ui.MessageState
import rutacibao.android.ui.PushedScreen
import rutacibao.android.ui.rootViewModel
import rutacibao.presentation.account.AccountUiState
import rutacibao.presentation.account.AccountViewModel

@Composable
fun AccountPageScreen(page: AccountPage, onBack: () -> Unit) {
    val graph = LocalAppGraph.current
    val vm: AccountViewModel = rootViewModel("account") { graph.viewModels.account() }
    val state by vm.state.collectAsStateWithLifecycle()
    when (page) {
        AccountPage.Profile -> ProfileEditor(state, vm, onBack)
        AccountPage.Saved -> SavedPlaces(state, onBack)
        AccountPage.Passport -> PassportStamps(state, onBack)
        AccountPage.Notifications -> NotificationSettings(state, vm, onBack)
        AccountPage.Privacy -> PrivacyPage(onBack)
        AccountPage.About -> AboutPage(onBack)
        AccountPage.Deletion -> DeletionPage(state, vm, onBack)
    }
}

// ------------------------------------------------------------------ profile

@Composable
private fun ProfileEditor(state: AccountUiState, vm: AccountViewModel, onBack: () -> Unit) {
    val palette = LocalPalette.current
    var name by rememberSaveable { mutableStateOf(state.me?.displayName ?: "") }
    var municipality by rememberSaveable { mutableStateOf(state.me?.municipalityId) }
    var menu by remember { mutableStateOf(false) }
    val tooShort = name.trim().length < 2
    LaunchedEffect(state.profileSaved) {
        if (state.profileSaved) { vm.profileSavedHandled(); onBack() }
    }
    PushedScreen(
        title = stringResource(R.string.profile_title),
        onBack = onBack,
        actions = {
            TextButton(onClick = { vm.saveProfile(name, municipality) }, enabled = !tooShort && !state.savingProfile, modifier = Modifier.defaultMinSize(minHeight = 48.dp)) {
                Text(stringResource(R.string.common_save))
            }
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it.take(60) },
                label = { Text(stringResource(R.string.profile_name)) },
                isError = tooShort && name.isNotEmpty(),
                supportingText = {
                    Text(
                        stringResource(if (tooShort && name.isNotEmpty()) R.string.profile_name_error else R.string.profile_name_helper),
                        color = if (tooShort && name.isNotEmpty()) palette.dangerInk else palette.textTertiary,
                    )
                },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Box {
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(palette.inset)
                            .clickable(role = Role.DropdownList) { menu = true }
                            .defaultMinSize(minHeight = 56.dp)
                            .padding(horizontal = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(stringResource(R.string.profile_municipality), style = MaterialTheme.typography.labelMedium, color = palette.textSecondary)
                            Text(state.municipalities.firstOrNull { it.id == municipality }?.name ?: "—", style = MaterialTheme.typography.bodyLarge)
                        }
                    }
                    DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                        DropdownMenuItem(text = { Text("—") }, onClick = { municipality = null; menu = false })
                        state.municipalities.forEach { m ->
                            DropdownMenuItem(text = { Text(m.name) }, onClick = { municipality = m.id; menu = false })
                        }
                    }
                }
                Text(stringResource(R.string.profile_municipality_helper), style = MaterialTheme.typography.bodySmall, color = palette.textTertiary, modifier = Modifier.padding(horizontal = 4.dp))
            }
        }
    }
}

// ------------------------------------------------------------------ saved + passport

@Composable
private fun SavedPlaces(state: AccountUiState, onBack: () -> Unit) {
    val palette = LocalPalette.current
    PushedScreen(title = stringResource(R.string.account_saved), onBack = onBack) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            if (state.saved.isEmpty()) {
                MessageState(stringResource(R.string.explore_saved_empty), stringResource(R.string.explore_saved_empty_body), icon = Icons.Filled.Bookmark)
            } else {
                LazyColumn {
                    items(state.saved, key = { it.id }) { place ->
                        Row(
                            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            CategoryAvatar(place.icon, place.color, 36.dp)
                            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Text(place.name, style = MaterialTheme.typography.titleSmall)
                                Text("${place.categoryName} · ${place.municipalityName}", style = MaterialTheme.typography.bodyMedium, color = palette.textTertiary)
                            }
                        }
                        Hairline(Modifier.padding(start = 64.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun PassportStamps(state: AccountUiState, onBack: () -> Unit) {
    val palette = LocalPalette.current
    val items = state.passport?.items.orEmpty()
    val format = remember { DateTimeFormatter.ofLocalizedDate(FormatStyle.LONG).withLocale(Locale.forLanguageTag("es-DO")).withZone(ZoneId.systemDefault()) }
    PushedScreen(title = stringResource(R.string.account_passport), onBack = onBack) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            if (items.isEmpty()) {
                MessageState(stringResource(R.string.account_passport_empty), stringResource(R.string.account_passport_empty_body), icon = Icons.Filled.Verified)
            } else {
                LazyColumn {
                    items(items, key = { it.id }) { stamp ->
                        Row(
                            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(Icons.Filled.Verified, contentDescription = null, Modifier.size(28.dp), tint = androidx.compose.ui.graphics.Color(0xFFAF52DE))
                            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Text(stamp.place?.name ?: stringResource(R.string.account_passport_removed), style = MaterialTheme.typography.titleSmall)
                                Text(format.format(Instant.ofEpochMilli(stamp.stampedAt.toEpochMilliseconds())), style = MaterialTheme.typography.bodyMedium, color = palette.textTertiary)
                            }
                        }
                        Hairline(Modifier.padding(start = 56.dp))
                    }
                }
            }
        }
    }
}

// ------------------------------------------------------------------ notifications

@Composable
private fun NotificationSettings(state: AccountUiState, vm: AccountViewModel, onBack: () -> Unit) {
    val palette = LocalPalette.current
    val p = state.preferences
    PushedScreen(title = stringResource(R.string.notification_settings_title), onBack = onBack) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState())) {
            if (p == null) {
                Box(Modifier.fillMaxWidth().padding(48.dp), Alignment.Center) { CircularProgressIndicator() }
            } else {
                SwitchRow(stringResource(R.string.notification_settings_case_updates), stringResource(R.string.notification_settings_case_hint), p.caseUpdatesEnabled) {
                    vm.setPreferences(it, p.trafficEnabled, p.emailEnabled)
                }
                Hairline(Modifier.padding(start = 16.dp))
                SwitchRow(stringResource(R.string.notification_settings_traffic), stringResource(R.string.notification_settings_traffic_hint), p.trafficEnabled) {
                    vm.setPreferences(p.caseUpdatesEnabled, it, p.emailEnabled)
                }
                Hairline(Modifier.padding(start = 16.dp))
                SwitchRow(stringResource(R.string.notification_settings_email), stringResource(R.string.notification_settings_email_hint), p.emailEnabled) {
                    vm.setPreferences(p.caseUpdatesEnabled, p.trafficEnabled, it)
                }
                Text(
                    stringResource(R.string.notification_settings_intro),
                    style = MaterialTheme.typography.bodySmall,
                    color = palette.textTertiary,
                    modifier = Modifier.padding(16.dp),
                )
            }
        }
    }
}

@Composable
private fun SwitchRow(title: String, hint: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = 64.dp)
            .clickable(role = Role.Switch) { onChange(!checked) }
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, style = MaterialTheme.typography.bodyLarge)
            Text(hint, style = MaterialTheme.typography.bodySmall, color = LocalPalette.current.textSecondary)
        }
        Switch(checked = checked, onCheckedChange = null)
    }
}

// ------------------------------------------------------------------ privacy + about

@Composable
private fun PrivacyPage(onBack: () -> Unit) {
    val palette = LocalPalette.current
    PushedScreen(title = stringResource(R.string.privacy_title), onBack = onBack) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            Text(stringResource(R.string.privacy_lede), style = MaterialTheme.typography.bodyLarge)
            listOf(
                R.string.privacy_account_title to R.string.privacy_account_body,
                R.string.privacy_location_title to R.string.privacy_location_body,
                R.string.privacy_contributions_title to R.string.privacy_contributions_body,
                R.string.privacy_photos_title to R.string.privacy_photos_body,
                R.string.privacy_notifications_title to R.string.privacy_notifications_body,
                R.string.privacy_device_title to R.string.privacy_device_body,
            ).forEach { (title, body) ->
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(stringResource(title), style = MaterialTheme.typography.titleSmall, modifier = Modifier.semantics { heading() })
                    Text(stringResource(body), style = MaterialTheme.typography.bodyMedium, color = palette.textSecondary)
                }
            }
        }
    }
}

@Composable
private fun AboutPage(onBack: () -> Unit) {
    val palette = LocalPalette.current
    PushedScreen(title = stringResource(R.string.about_title), onBack = onBack) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            Column(Modifier.fillMaxWidth().padding(vertical = 12.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                BrandMark(64.dp)
                Text(stringResource(R.string.about_tagline), style = MaterialTheme.typography.bodyLarge, color = palette.textSecondary, textAlign = TextAlign.Center)
            }
            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(MaterialTheme.colorScheme.surfaceContainer)) {
                InfoRow(stringResource(R.string.about_title), stringResource(R.string.about_version, BuildConfig.VERSION_NAME, BuildConfig.VERSION_CODE.toString()))
                Hairline(Modifier.padding(start = 16.dp))
                InfoRow(stringResource(R.string.about_maps), stringResource(R.string.about_maps_credit))
            }
            Text(stringResource(R.string.about_contest), style = MaterialTheme.typography.bodySmall, color = palette.textTertiary, modifier = Modifier.padding(horizontal = 4.dp))
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth().defaultMinSize(minHeight = 52.dp).padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(label, style = MaterialTheme.typography.bodyLarge)
        Text(value, style = MaterialTheme.typography.bodyMedium, color = LocalPalette.current.textSecondary, textAlign = TextAlign.End, modifier = Modifier.weight(1f))
    }
}

// ------------------------------------------------------------------ deletion

@Composable
private fun DeletionPage(state: AccountUiState, vm: AccountViewModel, onBack: () -> Unit) {
    val palette = LocalPalette.current
    val word = stringResource(R.string.account_deletion_confirm_word)
    var typed by rememberSaveable { mutableStateOf("") }
    val working = state.deletion == AccountUiState.Deletion.Working
    val matches = typed.trim().uppercase() == word.uppercase()
    PushedScreen(title = stringResource(R.string.account_deletion_title), onBack = onBack) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            Text(stringResource(R.string.account_deletion_lede), style = MaterialTheme.typography.bodyLarge)
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(stringResource(R.string.account_deletion_deleted_title), style = MaterialTheme.typography.titleSmall, modifier = Modifier.semantics { heading() })
                IconLine(Icons.Filled.PersonOff, stringResource(R.string.account_deletion_deleted_account))
                IconLine(Icons.Filled.Delete, stringResource(R.string.account_deletion_deleted_contributions))
                IconLine(Icons.Filled.PhoneAndroid, stringResource(R.string.account_deletion_deleted_device))
            }
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(stringResource(R.string.account_deletion_kept_title), style = MaterialTheme.typography.titleSmall, modifier = Modifier.semantics { heading() })
                Text(stringResource(R.string.account_deletion_kept_responses), style = MaterialTheme.typography.bodyMedium, color = palette.textSecondary)
                Text(stringResource(R.string.account_deletion_kept_audit), style = MaterialTheme.typography.bodyMedium, color = palette.textSecondary)
            }
            OutlinedTextField(
                value = typed,
                onValueChange = { typed = it },
                label = { Text(stringResource(R.string.account_deletion_confirm_label, word)) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters, autoCorrectEnabled = false),
                modifier = Modifier.fillMaxWidth(),
            )
            Button(
                onClick = vm::requestDeletion,
                enabled = matches && !working,
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error, contentColor = MaterialTheme.colorScheme.onError),
                modifier = Modifier.fillMaxWidth().defaultMinSize(minHeight = 52.dp),
            ) {
                if (working) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onError)
                else Text(stringResource(R.string.account_deletion_submit_action), style = MaterialTheme.typography.titleSmall)
            }
            when (state.deletion) {
                AccountUiState.Deletion.NeedsRecentSignIn -> Text(stringResource(R.string.account_deletion_reauth_notice_body), style = MaterialTheme.typography.bodySmall, color = palette.dangerInk)
                AccountUiState.Deletion.Failed -> Text(stringResource(R.string.common_error_body), style = MaterialTheme.typography.bodySmall, color = palette.dangerInk)
                else -> Text(stringResource(R.string.account_deletion_confirm_helper), style = MaterialTheme.typography.bodySmall, color = palette.textTertiary)
            }
        }
    }
}

@Composable
private fun IconLine(icon: androidx.compose.ui.graphics.vector.ImageVector, text: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, Modifier.size(20.dp), tint = LocalPalette.current.textSecondary)
        Text(text, style = MaterialTheme.typography.bodyMedium)
    }
}
