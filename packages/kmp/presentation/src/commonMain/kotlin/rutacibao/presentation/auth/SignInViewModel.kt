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
import rutacibao.data.AuthError
import rutacibao.data.AuthRepository

public data class SignInUiState(
    val step: Step = Step.Enter,
    val method: Method = Method.Phone,
    /** As displayed: `809-555-1234`. */
    val phone: String = "",
    val email: String = "",
    val code: String = "",
    val busy: Boolean = false,
    val error: SignInError? = null,
    /** Seconds until another code can be requested; 0 = now. */
    val resendIn: Int = 0,
    /** Bumped on each failed code so the UI can play its (reduced-motion aware) feedback once. */
    val failures: Int = 0,
) {
    public enum class Step { Enter, Verify, Done }
    public enum class Method { Phone, Email }

    val canSubmit: Boolean
        get() = !busy && when (method) {
            Method.Phone -> Phone.isComplete(phone)
            Method.Email -> EMAIL.matches(email.trim())
        }

    /** Where the code went, as people write it. */
    val destination: String
        get() = if (method == Method.Phone) phone else email.trim().lowercase()

    internal companion object {
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
public class SignInViewModel(private val auth: AuthRepository) : ViewModel() {
    private val _state = MutableStateFlow(SignInUiState())
    public val state: StateFlow<SignInUiState> = _state.asStateFlow()
    private var countdown: Job? = null

    public fun selectMethod(method: SignInUiState.Method) {
        _state.update { it.copy(method = method, error = null) }
    }

    public fun updatePhone(input: String) {
        _state.update { it.copy(phone = Phone.formatInput(input), error = null) }
    }

    public fun updateEmail(input: String) {
        _state.update { it.copy(email = input.trim(), error = null) }
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
        launchBusy {
            send(s.method, target)
            _state.update { it.copy(step = SignInUiState.Step.Verify, code = "") }
            startCountdown()
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
        if (s.busy || s.code.length != CODE_LENGTH) return
        val target = target(s) ?: return
        launchBusy(onError = { _state.update { it.copy(code = "", failures = it.failures + 1) } }) {
            if (s.method == SignInUiState.Method.Phone) auth.verifyPhone(target, s.code) else auth.verifyEmail(target, s.code)
            countdown?.cancel()
            _state.update { it.copy(step = SignInUiState.Step.Done) }
        }
    }

    public fun resend() {
        val s = _state.value
        if (s.busy || s.resendIn > 0) return
        val target = target(s) ?: return
        launchBusy {
            send(s.method, target)
            startCountdown()
        }
    }

    /** Back to the destination step ("Cambiar"). */
    public fun editDestination() {
        countdown?.cancel()
        _state.update { it.copy(step = SignInUiState.Step.Enter, code = "", error = null, resendIn = 0) }
    }

    private fun target(s: SignInUiState): String? = when (s.method) {
        SignInUiState.Method.Phone -> Phone.normalize(s.phone)
        SignInUiState.Method.Email -> s.email.trim().lowercase().takeIf { SignInUiState.EMAIL.matches(it) }
    }

    private suspend fun send(method: SignInUiState.Method, target: String) {
        if (method == SignInUiState.Method.Phone) auth.sendPhoneCode(target) else auth.sendEmailCode(target)
    }

    private fun startCountdown() {
        countdown?.cancel()
        countdown = viewModelScope.launch {
            for (left in RESEND_SECONDS downTo 0) {
                _state.update { it.copy(resendIn = left) }
                if (left > 0) delay(1_000)
            }
        }
    }

    private fun launchBusy(onError: () -> Unit = {}, block: suspend () -> Unit) {
        _state.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            try {
                block()
                _state.update { it.copy(busy = false) }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Throwable) {
                onError()
                _state.update { it.copy(busy = false, error = classify(e)) }
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
    }
}
