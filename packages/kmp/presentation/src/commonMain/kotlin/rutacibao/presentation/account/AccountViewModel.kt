package rutacibao.presentation.account

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.zacsweers.metro.Inject
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import rutacibao.api.ApiError
import rutacibao.api.generated.MeGetOutput
import rutacibao.api.generated.MunicipalitiesListItem
import rutacibao.api.generated.NotificationsGetPreferencesOutput
import rutacibao.api.generated.PassportListOutput
import rutacibao.api.generated.PlacesSavedItem
import rutacibao.data.AccountRepository
import rutacibao.data.AuthRepository
import rutacibao.data.Session
import rutacibao.data.StaffSource
import rutacibao.presentation.UiError
import rutacibao.presentation.gestion.toKindCounts

public data class AccountUiState(
    val signedIn: Boolean = false,
    val loading: Boolean = false,
    val me: MeGetOutput? = null,
    val municipalities: List<MunicipalitiesListItem> = emptyList(),
    val saved: List<PlacesSavedItem> = emptyList(),
    val passport: PassportListOutput? = null,
    val preferences: NotificationsGetPreferencesOutput? = null,
    /** Points, rank, badges and invite link; null until loaded or if it failed. */
    val reputation: Reputation? = null,
    val redeem: Redeem = Redeem.Idle,
    val savingProfile: Boolean = false,
    val profileSaved: Boolean = false,
    val deletion: Deletion = Deletion.Idle,
    /** Waiting reviews for staff; null for everyone else. */
    val staffPending: Int? = null,
    val error: UiError? = null,
) {
    public enum class Deletion { Idle, Working, Requested, NeedsRecentSignIn, Failed }

    val municipalityName: String?
        get() = municipalities.firstOrNull { it.id == me?.municipalityId }?.name
}

/** Account and its sub-screens (profile, saved, passport, notifications, deletion). */
@Inject
public class AccountViewModel(
    private val session: Session,
    private val auth: AuthRepository,
    private val account: AccountRepository,
    private val staff: StaffSource,
) : ViewModel() {
    private val _state = MutableStateFlow(AccountUiState(signedIn = session.isSignedIn.value))
    public val state: StateFlow<AccountUiState> = _state.asStateFlow()

    /** Kept for screens that only need to know whether someone is signed in. */
    public val isSignedIn: StateFlow<Boolean> = session.isSignedIn

    init {
        viewModelScope.launch {
            session.isSignedIn.collect { signedIn ->
                _state.update { AccountUiState(signedIn = signedIn, loading = signedIn) }
                if (signedIn) load()
            }
        }
    }

    public fun refresh() {
        if (!session.isSignedIn.value || _state.value.loading) return
        _state.update { it.copy(loading = true) }
        viewModelScope.launch { load() }
    }

    public fun saveProfile(displayName: String, municipalityId: String?) {
        val name = displayName.trim()
        if (name.length < 2 || _state.value.savingProfile) return
        _state.update { it.copy(savingProfile = true, profileSaved = false, error = null) }
        viewModelScope.launch {
            runCatching { account.updateProfile(name, municipalityId) }
                .onSuccess {
                    _state.update {
                        it.copy(savingProfile = false, profileSaved = true, me = it.me?.copy(displayName = name, municipalityId = municipalityId))
                    }
                }
                .onFailure { e -> _state.update { it.copy(savingProfile = false, error = UiError.from(e)) } }
        }
    }

    public fun profileSavedHandled() { _state.update { it.copy(profileSaved = false) } }

    /** Names who invited this account. The code is checked here first, so a typo never leaves the phone. */
    public fun redeemInvite(raw: String) {
        if (_state.value.redeem == Redeem.Working) return
        val code = raw.trim().uppercase()
        if (!INVITE_CODE.matches(code)) {
            _state.update { it.copy(redeem = Redeem.Failed(RedeemError.InvalidCode)) }
            return
        }
        _state.update { it.copy(redeem = Redeem.Working) }
        viewModelScope.launch {
            runCatching { account.redeemInvite(code) }
                .onSuccess { name ->
                    _state.update { it.copy(redeem = Redeem.Done(name), reputation = it.reputation?.copy(redeemed = true, invitedBy = Person(name, null))) }
                }
                .onFailure { e -> _state.update { it.copy(redeem = Redeem.Failed(redeemError(e))) } }
        }
    }

    /** Back to idle once the sheet closes or the person edits the code. */
    public fun redeemReset() { _state.update { it.copy(redeem = Redeem.Idle) } }

    /** Optimistic toggle of the three switches the app exposes. */
    public fun setPreferences(caseUpdates: Boolean, traffic: Boolean, email: Boolean) {
        val current = _state.value.preferences ?: return
        val next = current.copy(caseUpdatesEnabled = caseUpdates, trafficEnabled = traffic, emailEnabled = email)
        _state.update { it.copy(preferences = next) }
        viewModelScope.launch {
            runCatching { account.setPreferences(next) }
                .onFailure { e -> _state.update { it.copy(preferences = current, error = UiError.from(e)) } }
        }
    }

    public fun requestDeletion() {
        if (_state.value.deletion == AccountUiState.Deletion.Working) return
        _state.update { it.copy(deletion = AccountUiState.Deletion.Working) }
        viewModelScope.launch {
            runCatching { account.requestDeletion() }
                .onSuccess {
                    _state.update { it.copy(deletion = AccountUiState.Deletion.Requested) }
                    auth.signOut()
                }
                .onFailure { e ->
                    val recent = e is ApiError && "RECENT" in e.code.uppercase()
                    _state.update {
                        it.copy(deletion = if (recent) AccountUiState.Deletion.NeedsRecentSignIn else AccountUiState.Deletion.Failed)
                    }
                }
        }
    }

    public fun signOut() {
        viewModelScope.launch { auth.signOut() }
    }

    private suspend fun load() {
        runCatching {
            coroutineScope {
                val me = async { account.me() }
                val municipalities = async { runCatching { account.municipalities() }.getOrDefault(emptyList()) }
                val saved = async { runCatching { account.saved() }.getOrDefault(emptyList()) }
                val passport = async { runCatching { account.passport() }.getOrNull() }
                val preferences = async { runCatching { account.preferences() }.getOrNull() }
                val reputation = async { runCatching { Reputation.from(account.reputation()) }.getOrNull() }
                val signedMe = me.await()
                val pending = if (signedMe.staffRole == MeGetOutput.StaffRole.None) {
                    null
                } else {
                    runCatching { staff.counts().toKindCounts().sumOf { it.count } }.getOrDefault(0)
                }
                _state.update {
                    it.copy(
                        loading = false,
                        me = signedMe,
                        staffPending = pending,
                        municipalities = municipalities.await(),
                        saved = saved.await(),
                        passport = passport.await(),
                        preferences = preferences.await(),
                        reputation = reputation.await(),
                        error = null,
                    )
                }
            }
        }.onFailure { e -> _state.update { it.copy(loading = false, error = UiError.from(e)) } }
    }
}

private val INVITE_CODE = Regex("^[0-9A-F]{8}$")

/** The server's `data.reason` decides; the status is the fallback. */
private fun redeemError(e: Throwable): RedeemError {
    if (e !is ApiError) return RedeemError.Failed
    val reason = (e.data as? kotlinx.serialization.json.JsonObject)?.get("reason")
        ?.let { (it as? kotlinx.serialization.json.JsonPrimitive)?.content }
    return when {
        reason == "own_code" -> RedeemError.OwnCode
        reason == "unknown_code" || e.status == 404 -> RedeemError.UnknownCode
        reason == "already_redeemed" || e.status == 409 -> RedeemError.AlreadyRedeemed
        e.isRateLimited -> RedeemError.RateLimited
        e.status == 400 -> RedeemError.InvalidCode
        else -> RedeemError.Failed
    }
}
