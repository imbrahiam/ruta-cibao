package rutacibao.presentation.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.zacsweers.metro.Inject
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.io.IOException
import rutacibao.core.Phone
import rutacibao.data.AccountRepository
import rutacibao.data.AuthError
import rutacibao.data.AuthRepository

public data class SignInUiState(
    val step: Step = Step.Enter,
    val method: Method = PRIMARY,
    /** As displayed: `(809) 555-1234`. */
    val phone: String = "",
    val email: String = "",
    val code: String = "",
    val name: String = "",
    val busy: Boolean = false,
    val error: SignInError? = null,
    /**
     * Seconds until another code can be requested; 0 = now. On the first step it is the wait the
     * server asked for after refusing a send, and "Enviar código" stays off until it ends.
     */
    val resendIn: Int = 0,
    /** On the first step: the typed address already has a usable code, so submitting goes back to it. */
    val hasSentCode: Boolean = false,
    /** Bumped on each failed code so the UI can play its (reduced-motion aware) feedback once. */
    val failures: Int = 0,
) {
    public enum class Step { Enter, Verify, ProfileLookup, Name, Done }
    public enum class Method { Phone, Email }

    val canSubmit: Boolean
        get() = !busy && resendIn == 0 && when (method) {
            Method.Phone -> Phone.isComplete(phone)
            Method.Email -> EMAIL.matches(email.trim())
        }

    /** Where the code went, as people write it. */
    val destination: String
        get() = if (method == Method.Phone) phone else email.trim().lowercase()

    /** Every method, the primary first: the order the picker shows them in. */
    val methods: List<Method>
        get() = listOf(PRIMARY) + Method.entries.filter { it != PRIMARY }

    /** Whether [method] can be picked; the others stay on screen, disabled. */
    public fun isAvailable(method: Method): Boolean = method in AVAILABLE

    internal companion object {
        val PRIMARY: Method = Method.Email
        val AVAILABLE: Set<Method> = setOf(Method.Email, Method.Phone)
        val EMAIL = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$")
    }
}

/** Every way sign-in can fail, each one a catalogue string (`signIn.*`). */
public enum class SignInError { PhoneInvalid, EmailInvalid, CodeInvalid, CodeExpired, TooManyAttempts, RateLimited, SendFailed, Offline }

/**
 * Passwordless sign-in: destination, then a 6-digit code that submits itself
 * when complete.
 */
@Inject
public class SignInViewModel(private val auth: AuthRepository, private val account: AccountRepository) : ViewModel() {
    private val _state = MutableStateFlow(SignInUiState())
    public val state: StateFlow<SignInUiState> = _state.asStateFlow()
    private var municipalityId: String? = null
    private var countdown: Job? = null
    /** The address the running wait belongs to, and the seconds it has left. */
    private var waitTarget: String? = null
    private var waitLeft = 0
    /** The address whose last code is still usable, so going back to it resumes the code. */
    private var liveTarget: String? = null
    private var liveCode: Job? = null

    public fun selectMethod(method: SignInUiState.Method) {
        val current = _state.value
        if (current.step != SignInUiState.Step.Enter || current.busy || current.method == method || !current.isAvailable(method)) return
        _state.update { it.copy(method = method, error = null).withWait() }
    }

    public fun updatePhone(input: String) {
        val phone = Phone.formatInput(input)
        _state.update { it.copy(phone = phone, error = null).withWait() }
    }

    public fun updateEmail(input: String) {
        val email = input.trim()
        _state.update { it.copy(email = email, error = null).withWait() }
    }

    /**
     * The wait belongs to the address it was asked for: a different one can try right away, and
     * typing the first one again brings its wait back.
     *
     * What the screen shows as `resendIn`: the running wait, but only for its own address, and not
     * on the first step for an address whose code still works (submitting goes back to it).
     */
    private fun SignInUiState.withWait(): SignInUiState {
        val target = target(this)
        val held = target != null && target == waitTarget &&
            !(step == SignInUiState.Step.Enter && target == liveTarget)
        return copy(
            resendIn = if (held) waitLeft else 0,
            hasSentCode = step == SignInUiState.Step.Enter && target != null && target == liveTarget,
        )
    }

    public fun submit() {
        val s = _state.value
        if (s.busy) return
        val target = target(s) ?: run {
            _state.update {
                it.copy(error = if (s.method == SignInUiState.Method.Phone) SignInError.PhoneInvalid else SignInError.EmailInvalid)
            }
            return
        }
        // The code sent a moment ago still works: go type it instead of asking for another one
        // the server would refuse.
        if (target == liveTarget) {
            _state.update { it.copy(step = SignInUiState.Step.Verify, code = "", error = null).withWait() }
            return
        }
        launchBusy(onError = { e -> waitIfLimited(target, e) }) {
            send(s.method, target)
            codeSent(target)
            _state.update { it.copy(step = SignInUiState.Step.Verify, code = "") }
            startCountdown(target)
        }
    }

    /** Digits only, six at most; the sixth one verifies. */
    public fun updateCode(input: String) {
        val code = input.filter(Char::isDigit).take(CODE_LENGTH)
        _state.update { it.copy(code = code, error = null) }
        if (code.length == CODE_LENGTH) verify()
    }

    public fun verify() {
        val s = _state.value
        if (s.step != SignInUiState.Step.Verify || s.busy || s.code.length != CODE_LENGTH) return
        val target = target(s) ?: return
        launchBusy(onError = { e ->
            // Spent or expired: this code is done, so the first step sends a new one.
            if (_state.value.step != SignInUiState.Step.Verify) return@launchBusy
            if (classify(e) == SignInError.TooManyAttempts || classify(e) == SignInError.CodeExpired) codeSpent()
            _state.update { it.copy(code = "", failures = it.failures + 1) }
        }) {
            if (s.method == SignInUiState.Method.Phone) auth.verifyPhone(target, s.code) else auth.verifyEmail(target, s.code)
            countdown?.cancel()
            codeSpent()
            _state.update { it.copy(step = SignInUiState.Step.ProfileLookup, code = "") }
            checkProfile()
        }
    }

    public fun reset() {
        countdown?.cancel()
        codeSpent()
        waitTarget = null
        waitLeft = 0
        _state.value = SignInUiState()
    }

    public fun resumeProfile() {
        if (_state.value.busy) return
        _state.update { it.copy(step = SignInUiState.Step.ProfileLookup) }
        launchBusy { checkProfile() }
    }

    private suspend fun checkProfile() {
        val profile = account.me()
        check(profile.userId != null)
        municipalityId = profile.municipalityId
        val next = if (profile.displayName.isNullOrBlank()) SignInUiState.Step.Name else SignInUiState.Step.Done
        _state.update { it.copy(step = next) }
    }

    public fun updateName(input: String) {
        _state.update { it.copy(name = input.take(80), error = null) }
    }

    public fun saveName() {
        val s = _state.value
        val name = s.name.trim()
        if (s.step != SignInUiState.Step.Name || s.busy || name.length < 2) return
        launchBusy {
            account.updateProfile(name, municipalityId)
            _state.update { it.copy(step = SignInUiState.Step.Done) }
        }
    }

    public fun resend() {
        val s = _state.value
        if (s.busy || s.resendIn > 0) return
        val target = target(s) ?: return
        launchBusy(onError = { e -> waitIfLimited(target, e) }) {
            send(s.method, target)
            codeSent(target)
            startCountdown(target)
        }
    }

    /** Back to the destination step ("Cambiar"). The wait keeps running for its address. */
    public fun editDestination() {
        _state.update { it.copy(step = SignInUiState.Step.Enter, code = "", error = null).withWait() }
    }

    private fun codeSent(target: String) {
        liveTarget = target
        liveCode?.cancel()
        liveCode = viewModelScope.launch {
            delay(CODE_VALID_MS)
            codeSpent()
        }
    }

    private fun codeSpent() {
        liveCode?.cancel()
        liveTarget = null
        _state.update { it.withWait() }
    }

    private fun target(s: SignInUiState): String? = when (s.method) {
        SignInUiState.Method.Phone -> Phone.normalize(s.phone)
        SignInUiState.Method.Email -> s.email.trim().lowercase().takeIf { SignInUiState.EMAIL.matches(it) }
    }

    private suspend fun send(method: SignInUiState.Method, target: String) {
        if (method == SignInUiState.Method.Phone) auth.sendPhoneCode(target) else auth.sendEmailCode(target)
    }

    /** A refused send waits as long as the server asked (a minute if it did not say). */
    private fun waitIfLimited(target: String, error: Throwable) {
        if (classify(error) != SignInError.RateLimited) return
        startCountdown(target, (error as? AuthError)?.retryAfterSeconds?.takeIf { it > 0 } ?: RESEND_SECONDS)
    }

    private fun startCountdown(target: String, seconds: Int = RESEND_SECONDS) {
        countdown?.cancel()
        waitTarget = target
        countdown = viewModelScope.launch {
            for (left in seconds downTo 0) {
                waitLeft = left
                _state.update { it.withWait() }
                if (left > 0) delay(1_000)
            }
            waitTarget = null
            // The wait is over, so its message goes with it.
            _state.update { if (it.error == SignInError.RateLimited) it.copy(error = null) else it }
        }
    }

    private fun launchBusy(onError: (Throwable) -> Unit = {}, block: suspend () -> Unit) {
        _state.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            try {
                block()
                _state.update { it.copy(busy = false) }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Throwable) {
                _state.update { it.copy(busy = false, error = classify(e)) }
                onError(e)
            }
        }
    }

    private fun classify(error: Throwable): SignInError = when {
        error is IOException -> SignInError.Offline
        error is AuthError && (error.status == 429 || error.code == "TOO_MANY_REQUESTS") -> SignInError.RateLimited
        error is AuthError && "EXPIRED" in error.code -> SignInError.CodeExpired
        error is AuthError && "TOO_MANY_ATTEMPTS" in error.code -> SignInError.TooManyAttempts
        error is AuthError && ("INVALID" in error.code || "OTP" in error.code) -> SignInError.CodeInvalid
        else -> SignInError.SendFailed
    }

    private companion object {
        const val CODE_LENGTH = 6
        const val RESEND_SECONDS = 60
        /** A code stays usable this long after it is sent (the server's `expiresIn`). */
        const val CODE_VALID_MS = 600_000L
    }
}
