package rutacibao.android.screens

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.text.format.DateUtils
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.text.DateFormat
import java.util.Date
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import rutacibao.android.BuildConfig
import rutacibao.android.R
import rutacibao.android.app.LocalBarClearance
import rutacibao.android.design.*
import rutacibao.android.platform.relativeTimeText
import rutacibao.api.generated.ReportsListItem
import rutacibao.data.PendingContribution
import rutacibao.presentation.UiError
import rutacibao.presentation.account.AccountUiState
import rutacibao.presentation.account.AccountViewModel
import rutacibao.presentation.gestion.Emphasis
import rutacibao.presentation.gestion.GestionUiState
import rutacibao.presentation.gestion.GestionViewModel
import rutacibao.presentation.gestion.ReviewAction
import rutacibao.presentation.gestion.ReviewItem
import rutacibao.presentation.gestion.ReviewKind

@Serializable enum class AccountPage { Profile, Saved, Passport, Notifications, Privacy, About, Deletion, Offline }

@Composable
private fun accountViewModel(): AccountViewModel {
    val graph = LocalAppGraph.current
    return rootViewModel("account") { graph.viewModels.account() }
}

/** Who you are here, what you keep, and how the app behaves for you. */
@Composable
fun AccountScreen(onBack: () -> Unit, onOpen: (AccountPage) -> Unit, onOpenGestion: () -> Unit, onOpenPlace: (String) -> Unit) {
    val vm = accountViewModel()
    val state by vm.state.collectAsStateWithLifecycle()
    var signingIn by remember { mutableStateOf(false) }
    var sheet by remember { mutableStateOf<ReputationSheet?>(null) }
    var badge by remember { mutableStateOf<rutacibao.presentation.account.BadgeProgress?>(null) }
    val p = Ink.colors
    LaunchedEffect(Unit) { vm.refresh() }
    Column(Modifier.fillMaxSize().background(p.paper)) {
      // Opened from the face in every header, so it is a pushed page with its own way back.
      TopRow(stringResource(R.string.account_title), onBack)
      Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(top = 6.dp, bottom = LocalBarClearance.current + 24.dp)) {
        Column(Modifier.padding(horizontal = Metrics.gutter), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            if (state.signedIn) {
                ProfileHero(
                    name = state.me?.displayName,
                    place = state.municipalityName,
                    residencyVerified = state.me?.residencyVerified == true,
                    reputation = state.reputation,
                    onEditProfile = { onOpen(AccountPage.Profile) },
                    onExplainResident = { sheet = ReputationSheet.Resident },
                    modifier = Modifier.rise(0),
                )
                state.reputation?.let { rep ->
                    RankCard(rep, { sheet = ReputationSheet.Ranks }, Modifier.rise(1))
                    BadgesCard(rep, { badge = it; sheet = ReputationSheet.Badge }, Modifier.rise(1))
                    RewardsSection(rep, { sheet = ReputationSheet.Invite }, { sheet = ReputationSheet.Redeem }, Modifier.rise(2))
                }
                RowGroup(Modifier.rise(1)) {
                    RowLabel(stringResource(R.string.account_saved), icon = Icons.Outlined.BookmarkBorder, value = state.saved.size.takeIf { it > 0 }?.toString(), onClick = { onOpen(AccountPage.Saved) })
                    RowLabel(stringResource(R.string.account_passport), icon = Icons.Outlined.MenuBook, value = (state.passport?.total ?: 0).takeIf { it > 0 }?.toString(), divider = false, onClick = { onOpen(AccountPage.Passport) })
                }
                state.staffPending?.let { pending ->
                    RowGroup(Modifier.rise(2)) { RowLabel(stringResource(R.string.gestion_title), icon = Icons.Outlined.Checklist, badge = pending, divider = false, onClick = onOpenGestion) }
                }
            } else {
                Column(Modifier.padding(vertical = 8.dp).rise(0), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Mark(44.dp)
                    Text(stringResource(R.string.account_signed_out_title), style = Type.title, color = p.ink)
                    Text(stringResource(R.string.account_signed_out_body), style = Type.body, color = p.ink2)
                    Pill(stringResource(R.string.account_sign_in), { signingIn = true }, Modifier.fillMaxWidth())
                }
            }
            RowGroup(Modifier.rise(3)) {
                if (state.signedIn) RowLabel(stringResource(R.string.notification_settings_title), icon = Icons.Outlined.Notifications, onClick = { onOpen(AccountPage.Notifications) })
                RowLabel(stringResource(R.string.offline_row_title), icon = Icons.Outlined.DownloadForOffline, divider = false, onClick = { onOpen(AccountPage.Offline) })
            }
            RowGroup(Modifier.rise(4)) {
                RowLabel(stringResource(R.string.account_privacy), icon = Icons.Outlined.BackHand, onClick = { onOpen(AccountPage.Privacy) })
                RowLabel(stringResource(R.string.account_about_app), icon = Icons.Outlined.Info, divider = false, onClick = { onOpen(AccountPage.About) })
            }
            if (state.signedIn) {
                Pill(stringResource(R.string.account_sign_out), vm::signOut, Modifier.fillMaxWidth().padding(top = 8.dp), kind = PillKind.Quiet)
                Text(stringResource(R.string.account_deletion_row_title), style = Type.callout, color = p.danger, textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().clip(CircleShape).clickable { onOpen(AccountPage.Deletion) }.padding(vertical = 12.dp))
            }
        }
      }
    }
    if (signingIn && !state.signedIn) SignInDialog(onDismiss = { signingIn = false; vm.refresh() })
    val rep = state.reputation
    val close = { sheet = null; vm.redeemReset(); vm.refresh() }
    if (rep != null) when (sheet) {
        ReputationSheet.Ranks -> RankSheet(rep, close)
        ReputationSheet.Badge -> badge?.let { BadgeSheet(it, close) }
        ReputationSheet.Invite -> InviteFlow(rep, close)
        ReputationSheet.Resident -> ResidentSheet(state.municipalityName, close)
        ReputationSheet.Redeem -> RedeemSheet(state.redeem, vm::redeemInvite, vm::redeemReset, close)
        null -> Unit
    }
}

/** The reputation sheets, one at a time; contacts is a step inside the invite flow, not a sheet of its own. */
private enum class ReputationSheet { Ranks, Badge, Invite, Resident, Redeem }

@Composable
fun AccountPageScreen(page: AccountPage, onBack: () -> Unit, onOpenPlace: (String) -> Unit) {
    val vm = accountViewModel()
    val state by vm.state.collectAsStateWithLifecycle()
    LaunchedEffect(state.signedIn) { if (!state.signedIn && page != AccountPage.Offline && page != AccountPage.Privacy && page != AccountPage.About) onBack() }
    when (page) {
        AccountPage.Profile -> ProfilePage(state, vm, onBack)
        AccountPage.Saved -> SavedPage(state, onBack, onOpenPlace)
        AccountPage.Passport -> PassportPage(state, onBack)
        AccountPage.Notifications -> NotificationsPage(state, vm, onBack)
        AccountPage.Privacy -> PrivacyPage(onBack)
        AccountPage.About -> AboutPage(onBack)
        AccountPage.Deletion -> DeletionPage(state, vm, onBack)
        AccountPage.Offline -> OfflinePage(onBack)
    }
}

@Composable
private fun ProfilePage(state: AccountUiState, vm: AccountViewModel, onBack: () -> Unit) {
    var name by rememberSaveable { mutableStateOf(state.me?.displayName.orEmpty()) }
    var municipality by rememberSaveable { mutableStateOf(state.me?.municipalityId) }
    val tooShort = name.trim().length < 2
    val changed = name != state.me?.displayName.orEmpty() || municipality != state.me?.municipalityId
    LaunchedEffect(state.profileSaved) { if (state.profileSaved) { vm.profileSavedHandled(); onBack() } }
    Page(stringResource(R.string.profile_title), onBack) {
        Field(name, { name = it }, stringResource(R.string.profile_name))
        Text(stringResource(if (tooShort && name.isNotEmpty()) R.string.profile_name_error else R.string.profile_name_helper), style = Type.caption, color = if (tooShort && name.isNotEmpty()) Ink.colors.danger else Ink.colors.ink3)
        FormLabel(stringResource(R.string.profile_municipality))
        ChoiceFlow(state.municipalities, state.municipalities.firstOrNull { it.id == municipality }, { it.name }) { municipality = if (municipality == it.id) null else it.id }
        Text(stringResource(R.string.profile_municipality_helper), style = Type.caption, color = Ink.colors.ink3)
        if (state.error != null) Text(stringResource(R.string.common_error_title), style = Type.callout, color = Ink.colors.danger)
        Pill(stringResource(R.string.common_save), { vm.saveProfile(name, municipality) }, Modifier.fillMaxWidth().padding(top = 10.dp), enabled = !tooShort && changed, busy = state.savingProfile)
    }
}

@Composable
private fun SavedPage(state: AccountUiState, onBack: () -> Unit, onOpenPlace: (String) -> Unit) {
    val p = Ink.colors
    Page(stringResource(R.string.account_saved), onBack) {
        if (state.saved.isEmpty()) StateView(stringResource(R.string.explore_saved_empty), Modifier.height(360.dp), icon = Icons.Outlined.BookmarkBorder, message = stringResource(R.string.explore_saved_empty_body),
            action = stringResource(R.string.explore_saved_explore), onAction = onBack)
        else RowGroup {
            state.saved.forEachIndexed { index, place ->
                Row(Modifier.clickable { onOpenPlace(place.slug) }.padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    GlyphDisc(categoryIcon(place.icon), tint = Tint.of(place.color))
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(place.name, style = Type.bodyStrong, color = p.ink)
                        Text("${place.categoryName} · ${place.municipalityName}", style = Type.callout, color = p.ink3)
                    }
                    Icon(Icons.Outlined.ArrowOutward, null, Modifier.size(16.dp), tint = p.ink3)
                }
                if (index < state.saved.lastIndex) Hairline(inset = 70.dp)
            }
        }
    }
}

@Composable
private fun PassportPage(state: AccountUiState, onBack: () -> Unit) {
    val items = state.passport?.items.orEmpty()
    val p = Ink.colors
    Page(stringResource(R.string.account_passport), onBack) {
        if (items.isEmpty()) StateView(stringResource(R.string.account_passport_empty), Modifier.height(360.dp), icon = Icons.Outlined.MenuBook, message = stringResource(R.string.account_passport_empty_body))
        else {
            Text(pluralStringResource(R.plurals.account_passport_lede, items.size, items.size), style = Type.body, color = p.ink2)
            RowGroup {
                items.forEachIndexed { index, stamp ->
                    Row(Modifier.padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        GlyphDisc(Icons.Filled.Place, tint = stamp.place?.let { Tint.of(it.categoryColor) } ?: Tint.Neutral)
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(stamp.place?.name ?: stringResource(R.string.account_passport_removed), style = Type.bodyStrong, color = p.ink)
                            // Dominican order ("14 oct 2026"), with the town the stamp is from.
                            val date = java.text.SimpleDateFormat("d MMM yyyy", java.util.Locale.forLanguageTag("es-DO")).format(Date(stamp.stampedAt.toEpochMilliseconds())).replace(".", "")
                            Text(listOfNotNull(stamp.place?.municipalityName, date).joinToString(" · "), style = Type.callout, color = p.ink3)
                        }
                        Icon(Icons.Outlined.Verified, null, Modifier.size(20.dp), tint = p.brand)
                    }
                    if (index < items.lastIndex) Hairline(inset = 70.dp)
                }
            }
        }
    }
}

@Composable
private fun NotificationsPage(state: AccountUiState, vm: AccountViewModel, onBack: () -> Unit) {
    val context = LocalContext.current
    val p = Ink.colors
    @Composable fun toggle(title: Int, hint: Int, on: Boolean, set: (Boolean) -> Unit) {
        Row(Modifier.padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(stringResource(title), style = Type.body, color = p.ink)
                Text(stringResource(hint), style = Type.caption, color = p.ink3)
            }
            Switch(on, set, colors = SwitchDefaults.colors(checkedTrackColor = p.ink, checkedThumbColor = p.onInk, uncheckedTrackColor = p.paper3, uncheckedThumbColor = p.card, uncheckedBorderColor = p.line))
        }
    }
    Page(stringResource(R.string.notification_settings_title), onBack) {
        val prefs = state.preferences
        if (prefs == null) Skeleton {
            RowGroup {
                repeat(3) { index ->
                    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            BoneLine(133.dp)
                            BoneLine(205.dp, lineHeight = 16.dp, barHeight = 10.dp)
                        }
                        Spacer(Modifier.width(12.dp))
                        Bone(Modifier.size(52.dp, 32.dp))
                    }
                    if (index < 2) Hairline(inset = 16.dp)
                }
            }
        } else {
            RowGroup {
                toggle(R.string.notification_settings_case_updates, R.string.notification_settings_case_hint, prefs.caseUpdatesEnabled) { vm.setPreferences(it, prefs.trafficEnabled, prefs.emailEnabled) }
                Hairline(inset = 16.dp)
                toggle(R.string.notification_settings_traffic, R.string.notification_settings_traffic_hint, prefs.trafficEnabled) { vm.setPreferences(prefs.caseUpdatesEnabled, it, prefs.emailEnabled) }
                Hairline(inset = 16.dp)
                toggle(R.string.notification_settings_email, R.string.notification_settings_email_hint, prefs.emailEnabled) { vm.setPreferences(prefs.caseUpdatesEnabled, prefs.trafficEnabled, it) }
            }
            Pill(stringResource(R.string.notification_settings_open_settings), {
                context.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName))
            }, kind = PillKind.Outline, compact = true)
        }
    }
}

@Composable
private fun PrivacyPage(onBack: () -> Unit) {
    val sections = listOf(
        Triple(Icons.Outlined.PersonOutline, R.string.privacy_account_title, R.string.privacy_account_summary),
        Triple(Icons.Outlined.NearMe, R.string.privacy_location_title, R.string.privacy_location_summary),
        Triple(Icons.Outlined.AddCircleOutline, R.string.privacy_contributions_title, R.string.privacy_contributions_summary),
        Triple(Icons.Outlined.CameraAlt, R.string.privacy_photos_title, R.string.privacy_photos_summary),
        Triple(Icons.Outlined.Notifications, R.string.privacy_notifications_title, R.string.privacy_notifications_summary),
        Triple(Icons.Outlined.Storage, R.string.privacy_backups_title, R.string.privacy_backups_summary),
    )
    val p = Ink.colors
    Page(stringResource(R.string.privacy_title), onBack) {
        Text(stringResource(R.string.privacy_lede), style = Type.title, color = p.ink, modifier = Modifier.padding(bottom = 6.dp))
        sections.forEachIndexed { index, (icon, title, summary) ->
            Row(Modifier.padding(vertical = 6.dp).rise(index), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                Icon(icon, null, Modifier.size(22.dp), tint = p.ink)
                Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(stringResource(title), style = Type.bodyStrong, color = p.ink)
                    Text(stringResource(summary), style = Type.callout, color = p.ink2)
                }
            }
            if (index < sections.lastIndex) Hairline(inset = 36.dp)
        }
    }
}

@Composable
private fun AboutPage(onBack: () -> Unit) {
    val p = Ink.colors
    Page(stringResource(R.string.about_title), onBack) {
        Mark(56.dp, Modifier.padding(top = 12.dp))
        Text(stringResource(R.string.about_tagline), style = Type.title, color = p.ink)
        Text(stringResource(R.string.about_version, BuildConfig.VERSION_NAME, BuildConfig.VERSION_CODE.toString()), style = Type.callout, color = p.ink3)
        RowGroup(Modifier.padding(top = 12.dp)) {
            RowLabel(stringResource(R.string.about_maps), icon = Icons.Outlined.Map, value = "Google", chevron = false)
            RowLabel(stringResource(R.string.about_contest), icon = Icons.Outlined.EmojiEvents, chevron = false, divider = false)
        }
        Text(stringResource(R.string.about_maps_credit), style = Type.caption, color = p.ink3)
    }
}

@Composable
private fun DeletionPage(state: AccountUiState, vm: AccountViewModel, onBack: () -> Unit) {
    var typed by remember { mutableStateOf("") }
    val word = stringResource(R.string.account_deletion_confirm_word)
    val p = Ink.colors
    val needsSignIn = state.deletion == AccountUiState.Deletion.NeedsRecentSignIn
    @Composable fun line(icon: ImageVector, text: Int) {
        Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Icon(icon, null, Modifier.size(22.dp), tint = p.ink)
            Text(stringResource(text), style = Type.callout, color = p.ink2)
        }
    }
    Page(stringResource(R.string.account_deletion_title), onBack) {
        Text(stringResource(R.string.account_deletion_lede), style = Type.body, color = p.ink2)
        FormLabel(stringResource(R.string.account_deletion_deleted_title))
        RowGroup {
            line(Icons.Outlined.PersonOff, R.string.account_deletion_deleted_account); Hairline(inset = 54.dp)
            line(Icons.Outlined.DeleteOutline, R.string.account_deletion_deleted_contributions); Hairline(inset = 54.dp)
            line(Icons.Outlined.PhoneAndroid, R.string.account_deletion_deleted_device)
        }
        FormLabel(stringResource(R.string.account_deletion_kept_title))
        Text(stringResource(R.string.account_deletion_kept_responses), style = Type.callout, color = p.ink3)
        Text(stringResource(R.string.account_deletion_kept_audit), style = Type.callout, color = p.ink3)
        Field(typed, { typed = it }, stringResource(R.string.account_deletion_confirm_label, word), Modifier.padding(top = 10.dp))
        Text(stringResource(if (needsSignIn) R.string.account_deletion_reauth_notice_body else R.string.account_deletion_confirm_helper), style = Type.caption, color = if (needsSignIn || state.deletion == AccountUiState.Deletion.Failed) p.danger else p.ink3)
        Pill(stringResource(R.string.account_deletion_submit_action), vm::requestDeletion, Modifier.fillMaxWidth(), kind = PillKind.Danger, enabled = typed.trim().equals(word, ignoreCase = true), busy = state.deletion == AccountUiState.Deletion.Working)
    }
}

/** The province in your pocket: whether a copy is saved, how fresh it is, and what waits to be sent. */
@Composable
private fun OfflinePage(onBack: () -> Unit) {
    val offline = LocalAppGraph.current.offline
    val state by offline.state.collectAsStateWithLifecycle()
    val ready = state.version != null
    val p = Ink.colors
    val updated = remember(state.generatedAt) {
        state.generatedAt?.let { raw -> runCatching { java.time.Instant.parse(raw).toEpochMilli() }.getOrNull()?.let { DateUtils.getRelativeTimeSpanString(it, System.currentTimeMillis(), DateUtils.DAY_IN_MILLIS).toString() } }
    }
    var justUpdated by remember { mutableStateOf(false) }
    var wasDownloading by remember { mutableStateOf(false) }
    LaunchedEffect(state.downloading) {
        if (wasDownloading && !state.downloading && state.error == null) { justUpdated = true; kotlinx.coroutines.delay(2500); justUpdated = false }
        wasDownloading = state.downloading
    }
    Page(stringResource(R.string.offline_title), onBack) {
        Column(Modifier.fillMaxWidth().background(p.paper2, RoundedCornerShape(Metrics.radiusPanel)).padding(vertical = 26.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(Modifier.size(64.dp).background(if (ready) p.action else p.paper3, CircleShape), Alignment.Center) {
                Icon(if (ready) Icons.Outlined.Check else Icons.Outlined.ArrowDownward, null, Modifier.size(28.dp), tint = if (ready) p.onInk else p.ink)
            }
            Text(stringResource(if (ready) R.string.offline_ready_badge else R.string.offline_not_downloaded_badge), style = Type.title, color = p.ink)
            if (ready && updated != null) Text("${stringResource(R.string.offline_version_date)} $updated", style = Type.callout, color = p.ink3)
        }
        Text(stringResource(R.string.offline_lede), style = Type.callout, color = p.ink3)
        Pill(stringResource(if (state.downloading) R.string.offline_downloading_action else if (ready) R.string.offline_update_action else R.string.offline_download_action), offline::download, Modifier.fillMaxWidth(), busy = state.downloading, icon = if (justUpdated) Icons.Outlined.Check else null)
        state.error?.let { Text(stringResource(offlineError(it)), style = Type.callout, color = p.danger) }
        if (ready) {
            val number = java.text.NumberFormat.getIntegerInstance(java.util.Locale.forLanguageTag("es-DO"))
            RowGroup(Modifier.padding(top = 6.dp)) {
                RowLabel(stringResource(R.string.offline_places_row_title), icon = Icons.Outlined.Place, value = number.format(state.places), chevron = false)
                RowLabel(stringResource(R.string.offline_routes_row_title), icon = Icons.Outlined.Hiking, value = number.format(state.routes), chevron = false)
                RowLabel(stringResource(R.string.offline_roads_row_title), icon = Icons.Outlined.Route, value = number.format(state.roads), chevron = false, divider = false)
            }
            // Removing the copy is the rare, destructive way out: quiet red text under what it holds.
            Text(stringResource(R.string.offline_remove_action), style = Type.body, color = p.danger, textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                modifier = Modifier.fillMaxWidth().clip(CircleShape).clickable(onClick = offline::removeSnapshot).padding(vertical = 12.dp))
        }
        if (state.pending.isNotEmpty()) {
            FormLabel(stringResource(R.string.offline_outbox_section))
            RowGroup {
                state.pending.forEachIndexed { index, entry ->
                    Row(Modifier.padding(horizontal = 16.dp, vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(stringResource(procedureLabel(entry)), style = Type.bodyStrong, color = p.ink)
                            Text(stringResource(if (entry.blocked) R.string.offline_outbox_status_blocked else R.string.offline_outbox_status_waiting), style = Type.callout, color = if (entry.blocked) p.danger else p.ink3)
                        }
                        IconDisc(Icons.Outlined.Refresh, stringResource(R.string.offline_outbox_retry_action), { offline.retry(entry.id) })
                        IconDisc(Icons.Outlined.DeleteOutline, stringResource(R.string.offline_outbox_remove_action), { offline.discard(entry.id) })
                    }
                    if (index < state.pending.lastIndex) Hairline(inset = 16.dp)
                }
            }
            Pill(stringResource(if (state.syncing) R.string.offline_outbox_flushing else R.string.offline_outbox_flush_action), offline::flush, Modifier.fillMaxWidth(), kind = PillKind.Quiet, enabled = !state.syncing)
        }
    }
}

private fun procedureLabel(entry: PendingContribution): Int = when (entry.procedure) {
    "traffic_report" -> R.string.offline_outbox_procedure_traffic_report
    "consultations_open" -> R.string.offline_outbox_procedure_consultations_open
    "places_report" -> R.string.offline_outbox_procedure_places_report
    else -> R.string.offline_outbox_procedure_places_submit
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

// ------------------------------------------------------------------ gestión

/** The staff desk in a pocket: this week's report, then everything waiting for a decision. */
@Composable
fun GestionScreen(onBack: () -> Unit, onOpenConsultation: (String) -> Unit) {
    val graph = LocalAppGraph.current
    val vm: GestionViewModel = viewModel { graph.viewModels.gestion() }
    val state by vm.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var downloadFailed by remember { mutableStateOf(false) }
    var note by remember { mutableStateOf("") }
    val p = Ink.colors
    LaunchedEffect(state.pdfUrl) {
        val url = state.pdfUrl ?: return@LaunchedEffect
        try { openReport(context, downloadReport(context, url, state.latestReport)) } catch (_: Exception) { downloadFailed = true }
        vm.pdfHandled()
    }
    Page(stringResource(R.string.gestion_title), onBack) {
        state.latestReport?.let { report ->
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(Metrics.radiusCard)).background(p.paper2).pressable(scale = 0.99f, enabled = state.pdf != rutacibao.presentation.gestion.PdfState.Loading) { downloadFailed = false; vm.openReport() }.padding(14.dp),
                horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(44.dp).background(p.action, CircleShape), Alignment.Center) { Icon(Icons.Outlined.Description, null, Modifier.size(20.dp), tint = p.onInk) }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(stringResource(R.string.gestion_weekly), style = Type.bodyStrong, color = p.ink)
                    Text("${report.municipalityName} · ${DateUtils.formatDateRange(context, report.periodStart.toEpochMilliseconds(), report.periodEnd.toEpochMilliseconds(), DateUtils.FORMAT_ABBREV_MONTH or DateUtils.FORMAT_NO_YEAR)}", style = Type.callout, color = p.ink3)
                    if (state.pdf == rutacibao.presentation.gestion.PdfState.Unavailable || downloadFailed) Text(stringResource(R.string.gestion_weekly_unavailable), style = Type.caption, color = p.danger)
                }
                if (state.pdf == rutacibao.presentation.gestion.PdfState.Loading) LoadingDots(Modifier.width(40.dp)) else Icon(Icons.Outlined.ArrowOutward, null, Modifier.size(16.dp), tint = p.ink3)
            }
        }
        LazyRow(Modifier.layoutBleed(), contentPadding = PaddingValues(horizontal = Metrics.gutter), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            item { Chip("${stringResource(R.string.gestion_all)} · ${state.total}", state.filter == null, { vm.select(null) }) }
            items(state.filters) { entry -> Chip("${stringResource(entry.kind.title)} · ${entry.count}", state.filter == entry.kind, { vm.select(entry.kind) }) }
        }
        when (state.phase) {
            GestionUiState.Phase.Loading -> GestionSkeleton()
            GestionUiState.Phase.Failed -> ErrorView(state.error ?: UiError.Unknown, Modifier.height(320.dp), vm::retry)
            GestionUiState.Phase.Empty -> StateView(stringResource(R.string.gestion_empty), Modifier.height(320.dp), icon = Icons.Outlined.CheckCircle)
            GestionUiState.Phase.Ready -> state.visibleItems.forEach { item ->
                key(item.id) {
                    ReviewCard(item, item.id in state.inFlight) { action ->
                        when (action) {
                            is ReviewAction.Decide -> vm.decide(item, action)
                            is ReviewAction.OpenThread -> onOpenConsultation(action.slug)
                        }
                    }
                }
            }
        }
    }
    state.noteFor?.let { request ->
        @OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
        androidx.compose.material3.ModalBottomSheet({ note = ""; vm.dismissNote() }, containerColor = p.paper, shape = RoundedCornerShape(topStart = Metrics.radiusPanel, topEnd = Metrics.radiusPanel)) {
            Column(Modifier.imePadding().navigationBarsPadding().padding(horizontal = 24.dp).padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Text(stringResource(R.string.gestion_note_title), style = Type.title, color = p.ink)
                Text(request.item.title, style = Type.callout, color = p.ink3)
                Field(note, { note = it }, stringResource(R.string.gestion_note_hint), minLines = 3, maxLines = 6)
                if (request.tooShort) Text(stringResource(R.string.gestion_note_too_short), style = Type.caption, color = p.danger)
                Pill(stringResource(actionLabel(request.action.labelKey)), { vm.submitNote(note) }, Modifier.fillMaxWidth())
            }
        }
    }
    StepUpSheet(state.stepUp, vm::verifyStepUp, vm::useRecoveryCode, vm::dismissStepUp)
}

/** Lets a row run edge to edge inside the page's gutter. */
private fun Modifier.layoutBleed(): Modifier = layout { measurable, constraints ->
    val extra = (Metrics.gutter * 2).roundToPx()
    val wide = constraints.maxWidth + extra
    val placeable = measurable.measure(constraints.copy(minWidth = wide, maxWidth = wide))
    layout(constraints.maxWidth, placeable.height) { placeable.place(-extra / 2, 0) }
}

/** One thing to decide: what it is, what it says, and the buttons its state allows. */
@Composable
private fun ReviewCard(item: ReviewItem, busy: Boolean, act: (ReviewAction) -> Unit) {
    val p = Ink.colors
    val primary = item.actions.firstOrNull { it.emphasis == Emphasis.Primary }
    val secondary = item.actions.filter { it.emphasis == Emphasis.Secondary }
    val photos = (item as? ReviewItem.Consultation)?.photoUrls?.takeIf { it.isNotEmpty() } ?: listOfNotNull(item.imageUrl)
    val shape = RoundedCornerShape(Metrics.radiusCard)
    Column(Modifier.fillMaxWidth().clip(shape).background(p.card).border(1.dp, p.line, shape).padding(vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(Modifier.padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(item.kind.glyph, null, Modifier.size(14.dp), tint = p.ink3)
            Text("${stringResource(item.kind.title)} · ${item.municipality} · ${relativeTimeText(item.createdAt)}", style = Type.caption, color = p.ink3, modifier = Modifier.weight(1f))
            item.stateKey?.let { StatusTag(stringResource(stateLabel(it)), p.warning) }
        }
        Text(item.title, style = Type.heading, color = p.ink, modifier = Modifier.padding(horizontal = 16.dp))
        item.snippet?.takeIf { it.isNotBlank() }?.let { Text(it, style = Type.body, color = p.ink2, modifier = Modifier.padding(horizontal = 16.dp)) }
        if (photos.isNotEmpty()) PhotoStrip(photos, height = 150.dp)
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End), verticalAlignment = Alignment.CenterVertically) {
            secondary.forEach { action -> Pill(stringResource(actionLabel(action.labelKey)), { act(action) }, kind = PillKind.Outline, compact = true, enabled = !busy) }
            primary?.let { Pill(stringResource(actionLabel(it.labelKey)), { act(it) }, compact = true, busy = busy) }
        }
    }
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
    } finally { connection.disconnect() }
    target
}

/** Opens the PDF in whatever viewer is installed, and falls back to the share sheet. */
private fun openReport(context: Context, file: File) {
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
    val view = Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/pdf").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    try { context.startActivity(view.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } catch (_: ActivityNotFoundException) {
        val send = Intent(Intent.ACTION_SEND).setType("application/pdf").putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        context.startActivity(Intent.createChooser(send, context.getString(R.string.common_share)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}

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
        ReviewKind.Place -> Icons.Outlined.Place
        ReviewKind.PlaceReport -> Icons.Outlined.Flag
        ReviewKind.Photo -> Icons.Outlined.Image
        ReviewKind.Claim -> Icons.Outlined.Storefront
        ReviewKind.Traffic -> Icons.Outlined.WarningAmber
        ReviewKind.ContentReport -> Icons.Outlined.Report
        ReviewKind.Consultation -> Icons.Outlined.Forum
    }

private fun stateLabel(key: String): Int = when (key) {
    "gestion.state.textPending" -> R.string.gestion_state_text_pending
    "gestion.state.textPublished" -> R.string.gestion_state_text_published
    "gestion.state.textHidden" -> R.string.gestion_state_text_hidden
    "gestion.state.casePending" -> R.string.gestion_state_case_pending
    else -> R.string.gestion_state_case_published
}

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

/** The desk's cases on their way: three cards with where and when, title, line and the action. */
@Composable
private fun GestionSkeleton() {
    Skeleton {
        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            repeat(3) {
                Column(Modifier.fillMaxWidth().background(Ink.colors.paper2, RoundedCornerShape(Metrics.radiusCard)).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row { BoneLine(97.dp, lineHeight = 16.dp, barHeight = 10.dp); Spacer(Modifier.weight(1f)); Box(Modifier.width(34.dp)) { BoneLine(34.dp, lineHeight = 16.dp, barHeight = 10.dp) } }
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        BoneLine(216.dp, lineHeight = 25.dp, barHeight = 15.dp)
                        BoneLine(174.dp, lineHeight = 18.dp, barHeight = 11.dp)
                    }
                    Row(Modifier.heightIn(min = 44.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.width(86.dp)) { BoneLine(86.dp, lineHeight = 16.dp, barHeight = 10.dp) }
                        Spacer(Modifier.weight(1f))
                        Bone(Modifier.size(82.dp, 34.dp))
                    }
                }
            }
        }
    }
}
