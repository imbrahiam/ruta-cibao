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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.Checklist
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
enum class AccountPage { Profile, Saved, Passport, Notifications, Privacy, About, Deletion }

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
            PrimaryButton(stringResource(R.string.account_sign_in), { showSignIn = true }, Modifier.fillMaxWidth())
        }
    } else {
        val palette = LocalPalette.current
        PullToRefreshBox(isRefreshing = false, onRefresh = vm::refresh, modifier = Modifier.semantics { paneTitle = screenName }) {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(bottom = 32.dp)) {
                Header(state.me?.displayName, state.me?.residencyVerified == true, state.municipalityName, state.me?.phoneNumber ?: state.me?.email)

                SectionTitle(stringResource(R.string.account_yours))
                Group {
                    NavRow(stringResource(R.string.account_profile), Icons.Filled.Person, Color(0xFF0A84FF), onClick = { onOpen(AccountPage.Profile) })
                    NavRow(stringResource(R.string.account_saved), Icons.Filled.Bookmark, Color(0xFFFF9500), count = state.saved.size, onClick = { onOpen(AccountPage.Saved) })
                    NavRow(stringResource(R.string.account_passport), Icons.Filled.Verified, Color(0xFFAF52DE), count = (state.passport?.total ?: 0).toInt(), onClick = { onOpen(AccountPage.Passport) })
                    state.staffPending?.let { pending ->
                        NavRow(
                            stringResource(R.string.gestion_title),
                            Icons.Filled.Checklist,
                            Color(0xFF30A45A),
                            count = pending,
                            value = if (pending == 0) stringResource(R.string.gestion_pending_zero) else pluralStringResource(R.plurals.gestion_pending, pending, pending),
                            onClick = onOpenGestion,
                        )
                    }
                    NavRow(stringResource(R.string.notification_settings_title), Icons.Filled.Notifications, Color(0xFFFF3B30), onClick = { onOpen(AccountPage.Notifications) }, last = true)
                }
                SectionTitle(stringResource(R.string.account_about))
                Group {
                    NavRow(stringResource(R.string.account_privacy), Icons.Filled.PanTool, Color(0xFF5E5CE6), onClick = { onOpen(AccountPage.Privacy) })
                    NavRow(stringResource(R.string.account_about_app), Icons.Filled.Info, Color(0xFF8E8E93), onClick = { onOpen(AccountPage.About) }, last = true)
                }
                Box(Modifier.height(24.dp))
                Group {
                    PlainRow(stringResource(R.string.account_sign_out), palette.text) { confirmSignOut = true }
                    HorizontalDivider(Modifier.padding(start = 16.dp), thickness = 0.5.dp, color = MaterialTheme.colorScheme.outlineVariant)
                    PlainRow(stringResource(R.string.account_deletion_row_title), palette.dangerInk) { onOpen(AccountPage.Deletion) }
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
private fun Header(name: String?, verified: Boolean, municipality: String?, contact: String?) {
    val palette = LocalPalette.current
    val initials = (name ?: "").split(" ").filter { it.isNotBlank() }.take(2).joinToString("") { it.first().uppercase() }
    Row(
        Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 20.dp, bottom = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                name ?: " ",
                style = MaterialTheme.typography.headlineMedium.copy(fontSize = 26.sp, lineHeight = 32.sp, fontWeight = FontWeight.Bold),
                maxLines = 2,
                modifier = Modifier.semantics { heading() },
            )
            if (verified && municipality != null) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(stringResource(R.string.account_resident, municipality), style = MaterialTheme.typography.bodyMedium, color = palette.textSecondary, modifier = Modifier.weight(1f, fill = false))
                    Icon(Icons.Filled.Verified, contentDescription = null, Modifier.size(15.dp), tint = RutaBrand.iris)
                }
            } else if (contact != null) {
                Text(contact, style = MaterialTheme.typography.bodyMedium, color = palette.textSecondary)
            }
        }
        Box(Modifier.size(64.dp).background(RutaBrand.iris.copy(alpha = 0.16f), CircleShape), Alignment.Center) {
            Text(initials, style = TextStyleBold24, color = RutaBrand.iris)
        }
    }
}

private val TextStyleBold24 = androidx.compose.ui.text.TextStyle(fontSize = 24.sp, fontWeight = FontWeight.Bold)

@Composable
private fun SectionTitle(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.labelLarge,
        color = LocalPalette.current.textSecondary,
        modifier = Modifier.padding(start = 32.dp, end = 16.dp, top = 16.dp, bottom = 8.dp).semantics { heading() },
    )
}

@Composable
private fun Group(content: @Composable () -> Unit) {
    Column(
        Modifier
            .padding(horizontal = 16.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surfaceContainer),
    ) { content() }
}

/** A row with a coloured rounded-square icon, its label always visible, and a chevron. */
@Composable
private fun NavRow(
    title: String,
    icon: ImageVector,
    color: Color,
    count: Int? = null,
    last: Boolean = false,
    value: String? = null,
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
            Box(Modifier.size(30.dp).background(color, RoundedCornerShape(8.dp)), Alignment.Center) {
                Icon(icon, contentDescription = null, Modifier.size(17.dp), tint = Color.White)
            }
            Text(title, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
            if (count != null && count > 0) Text(count.toString(), style = MaterialTheme.typography.bodyLarge, color = palette.textTertiary)
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = palette.textTertiary)
        }
        if (!last) HorizontalDivider(Modifier.padding(start = 58.dp), thickness = 0.5.dp, color = MaterialTheme.colorScheme.outlineVariant)
    }
}

@Composable
private fun PlainRow(title: String, ink: Color, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().defaultMinSize(minHeight = 56.dp).clickable(role = Role.Button, onClick = onClick).padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(title, style = MaterialTheme.typography.bodyLarge, color = ink)
    }
}
