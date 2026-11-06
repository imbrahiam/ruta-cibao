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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Spacer
import rutacibao.android.ui.RutaHighlight
import rutacibao.android.ui.raised
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.Book
import androidx.compose.material.icons.filled.Checklist
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.PanTool
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalConfiguration
import rutacibao.android.feature.comments.ThreadAvatar
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.serialization.Serializable
import rutacibao.android.R
import rutacibao.android.feature.auth.SignInDialog
import rutacibao.android.generated.RutaBrand
import rutacibao.android.ui.BrandMark
import rutacibao.android.ui.LocalAppGraph
import rutacibao.android.ui.LocalPalette
import rutacibao.android.ui.PrimaryButton
import rutacibao.android.ui.rootViewModel
import rutacibao.presentation.account.AccountViewModel

/** Sub-screens of the account tab; the root pushes them on the tab's own stack. */
@Serializable
enum class AccountPage { Profile, Saved, Passport, Notifications, Privacy, About, Deletion, Offline }

@Composable
fun AccountScreen(onOpen: (AccountPage) -> Unit, onOpenGestion: () -> Unit) {
    val graph = LocalAppGraph.current
    val vm: AccountViewModel = rootViewModel("account") { graph.viewModels.account() }
    val state by vm.state.collectAsStateWithLifecycle()
    var showSignIn by rememberSaveable { mutableStateOf(false) }
    var confirmSignOut by rememberSaveable { mutableStateOf(false) }
    val screenName = stringResource(R.string.tabs_account)

    if (!state.signedIn) {
        Column(
            Modifier.fillMaxSize().padding(24.dp).semantics { paneTitle = screenName },
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Column(
                Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(20.dp, Alignment.CenterVertically),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                BrandMark(80.dp)
                Text(
                    stringResource(R.string.account_signed_out_title),
                    style = MaterialTheme.typography.headlineMedium.copy(fontSize = 28.sp),
                    textAlign = TextAlign.Center,
                    modifier = Modifier.semantics { heading() },
                )
                Text(
                    stringResource(R.string.account_signed_out_body),
                    style = MaterialTheme.typography.bodyLarge,
                    color = LocalPalette.current.textSecondary,
                    textAlign = TextAlign.Center,
                )
            }
            TextButton(onClick = { onOpen(AccountPage.Offline) }) { Text(stringResource(R.string.offline_row_title)) }
            PrimaryButton(stringResource(R.string.account_sign_in), { showSignIn = true }, Modifier.fillMaxWidth())
        }
    } else {
        val palette = LocalPalette.current
        PullToRefreshBox(isRefreshing = false, onRefresh = vm::refresh, modifier = Modifier.semantics { paneTitle = screenName }) {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(bottom = 32.dp)) {
                Spacer(Modifier.height(12.dp))
                Header(state.me?.displayName, state.me?.image, state.me?.residencyVerified == true, state.municipalityName, state.me?.phoneNumber ?: state.me?.email) {
                    onOpen(AccountPage.Profile)
                }
                GroupGap()
                Group {
                    NavRow(stringResource(R.string.account_saved), Icons.Filled.Bookmark, Color(0xFFFF9500), trailing = state.saved.size.toString(), onClick = { onOpen(AccountPage.Saved) })
                    NavRow(stringResource(R.string.account_passport), Icons.Filled.Book, Color(0xFF30B0C7), trailing = (state.passport?.total ?: 0).toString(), onClick = { onOpen(AccountPage.Passport) })
                }
                state.staffPending?.let { pending ->
                    GroupGap()
                    Group {
                        NavRow(
                            stringResource(R.string.gestion_title),
                            Icons.Filled.Checklist,
                            Color(0xFF5856D6),
                            count = pending,
                            value = if (pending == 0) stringResource(R.string.gestion_pending_zero) else pluralStringResource(R.plurals.gestion_pending, pending, pending),
                            onClick = onOpenGestion,
                        )
                    }
                }
                GroupGap()
                Group {
                    NavRow(stringResource(R.string.notification_settings_title), Icons.Filled.Notifications, Color(0xFFFF3B30), onClick = { onOpen(AccountPage.Notifications) })
                    NavRow(stringResource(R.string.offline_row_title), Icons.Filled.Download, Color(0xFF30A45A), onClick = { onOpen(AccountPage.Offline) })
                    if (rutacibao.android.platform.PushNotifications.capability != rutacibao.android.platform.PushNotifications.Capability.Available) {
                        Text(stringResource(R.string.notifications_push_unavailable), style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(16.dp))
                    }
                }
                GroupGap()
                Group {
                    NavRow(stringResource(R.string.account_privacy), Icons.Filled.PanTool, Color(0xFF0A84FF), onClick = { onOpen(AccountPage.Privacy) })
                    NavRow(stringResource(R.string.account_about_app), Icons.Filled.Info, Color(0xFF8E8E93), onClick = { onOpen(AccountPage.About) })
                }
                GroupGap()
                Group {
                    PlainRow(stringResource(R.string.account_sign_out), palette.text, Icons.AutoMirrored.Filled.Logout, chevron = false) { confirmSignOut = true }
                    PlainRow(stringResource(R.string.account_deletion_row_title), palette.danger, Icons.Filled.Delete, chevron = true) { onOpen(AccountPage.Deletion) }
                }
            }
        }
    }

    if (showSignIn && !state.signedIn) SignInDialog(onDismiss = { showSignIn = false })
    if (confirmSignOut) {
        AlertDialog(
            onDismissRequest = { confirmSignOut = false },
            title = { Text(stringResource(R.string.account_sign_out)) },
            confirmButton = {
                TextButton(onClick = { confirmSignOut = false; vm.signOut() }, Modifier.defaultMinSize(minHeight = 48.dp)) {
                    Text(stringResource(R.string.account_sign_out), color = LocalPalette.current.dangerInk)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmSignOut = false }, Modifier.defaultMinSize(minHeight = 48.dp)) {
                    Text(stringResource(R.string.common_cancel))
                }
            },
        )
    }
}

/** Name big, verified place, initials in iris (no title above it). */
@Composable
private fun Header(name: String?, image: String?, verified: Boolean, municipality: String?, contact: String?, onClick: () -> Unit) {
    val palette = LocalPalette.current
    Row(
        Modifier.padding(horizontal = 16.dp).fillMaxWidth().clip(RoundedCornerShape(20.dp))
            .background(cardFill()).clickable(role = Role.Button, onClick = onClick).padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        ThreadAvatar(name, image, size = 64.dp)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    name ?: " ",
                    style = MaterialTheme.typography.headlineMedium.copy(fontSize = 26.sp, lineHeight = 32.sp, fontWeight = FontWeight.Bold),
                    maxLines = 2,
                    modifier = Modifier.weight(1f, fill = false).semantics { heading() },
                )
                if (verified) Icon(Icons.Filled.Verified, contentDescription = stringResource(R.string.account_resident_verified), Modifier.size(18.dp), tint = RutaBrand.iris)
            }
            if (verified && municipality != null) {
                Text(stringResource(R.string.account_resident, municipality), style = MaterialTheme.typography.bodyMedium, color = palette.textSecondary, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
            } else if (contact != null) {
                Text(contact, style = MaterialTheme.typography.bodyMedium, color = palette.textSecondary)
            }
        }
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = palette.textTertiary)
    }
}


/** Rows of one section, edge to edge: icons share the profile card's 16 dp gutter. */
@Composable
private fun Group(content: @Composable () -> Unit) {
    Column(Modifier.fillMaxWidth()) { content() }
}

/** The hairline between sections, as on iOS. */
@Composable
private fun GroupGap() {
    HorizontalDivider(Modifier.padding(horizontal = 16.dp, vertical = 8.dp), thickness = 0.5.dp, color = MaterialTheme.colorScheme.outlineVariant)
}

/** A card on the page: the surface step in dark (as on iOS), so avatars and chips sit one step above it. */
@Composable
private fun cardFill(): Color = if (isSystemInDarkTheme()) LocalPalette.current.surface else LocalPalette.current.inset

/** A row with a coloured rounded-square icon, its label always visible, and a chevron. */
@Composable
private fun NavRow(
    title: String,
    icon: ImageVector,
    color: Color?,
    count: Int? = null,
    value: String? = null,
    trailing: String? = null,
    onClick: () -> Unit,
) {
    val palette = LocalPalette.current
    Column {
        Row(
            Modifier.fillMaxWidth().defaultMinSize(minHeight = 56.dp).clickable(role = Role.Button, onClick = onClick)
                .then(if (value != null) Modifier.semantics { stateDescription = value } else Modifier)
                .padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (color != null) {
                Box(Modifier.size(30.dp).background(color, RoundedCornerShape(8.dp)), Alignment.Center) {
                    Icon(icon, contentDescription = null, Modifier.size(17.dp), tint = Color.White)
                }
            } else {
                Icon(icon, contentDescription = null, Modifier.size(30.dp).padding(3.dp), tint = MaterialTheme.colorScheme.onSurface)
            }
            Text(title, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
            if (count != null && count > 0) {
                Text(
                    count.toString(),
                    style = MaterialTheme.typography.labelLarge,
                    color = palette.text,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.defaultMinSize(minWidth = 28.dp, minHeight = 28.dp).background(palette.fill, CircleShape).padding(horizontal = 8.dp, vertical = 4.dp),
                )
            }
            if (trailing != null) Text(trailing, style = MaterialTheme.typography.bodyLarge, color = palette.textSecondary)
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = palette.textTertiary)
        }
    }
}

@Composable
private fun PlainRow(title: String, ink: Color, icon: ImageVector, chevron: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().defaultMinSize(minHeight = 56.dp).clickable(role = Role.Button, onClick = onClick).padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(icon, contentDescription = null, Modifier.size(30.dp).padding(3.dp), tint = ink)
        Text(title, style = MaterialTheme.typography.bodyLarge, color = ink, modifier = Modifier.weight(1f))
        if (chevron) Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = LocalPalette.current.textTertiary)
    }
}
