package rutacibao.presentation.gestion

import kotlinx.coroutines.CancellationException
import kotlinx.io.IOException
import rutacibao.api.ApiError
import rutacibao.data.EnrollmentRequired
import rutacibao.data.StaffSource
import rutacibao.data.StepUpRequired

public enum class StepUpError { Invalid, RateLimited, Offline }

/** Where the second-factor prompt stands. [recovery] is whether a recovery code is being asked for. */
public sealed interface StepUpState {
    public data object None : StepUpState

    public data class Asking(val recovery: Boolean = false, val error: StepUpError? = null) : StepUpState

    public data class Verifying(val recovery: Boolean) : StepUpState

    public data object EnrollOnWeb : StepUpState
}

/** What came of running a staff action through the gate. */
internal sealed interface GateOutcome {
    data object Done : GateOutcome

    /** Held back by the second factor; it runs again after a successful verification. */
    data object Blocked : GateOutcome

    data class Failed(val error: Throwable) : GateOutcome
}

/**
 * Handles the staff second factor once for a screen. An action the server
 * refuses with a step-up is parked here, the prompt opens, and after a good
 * code the action runs again exactly once.
 */
public class StepUpGate(
    private val staff: StaffSource,
    private val publish: (StepUpState) -> Unit,
) {
    private var state: StepUpState = StepUpState.None
    private var pending: (suspend () -> Unit)? = null

    internal suspend fun run(replay: suspend () -> Unit, block: suspend () -> Unit): GateOutcome =
        try {
            block()
            GateOutcome.Done
        } catch (e: CancellationException) {
            throw e
        } catch (e: StepUpRequired) {
            pending = replay
            set(StepUpState.Asking())
            GateOutcome.Blocked
        } catch (e: EnrollmentRequired) {
            pending = null
            set(StepUpState.EnrollOnWeb)
            GateOutcome.Blocked
        } catch (e: Throwable) {
            GateOutcome.Failed(e)
        }

    public fun useRecovery(recovery: Boolean) {
        if (state is StepUpState.Asking) set(StepUpState.Asking(recovery = recovery))
    }

    public fun dismiss() {
        pending = null
        set(StepUpState.None)
    }

    public suspend fun verify(code: String) {
        val recovery = (state as? StepUpState.Asking)?.recovery ?: return
        val clean = code.trim()
        val valid = if (recovery) clean.length in 6..32 else clean.length == 6 && clean.all { it in '0'..'9' }
        if (!valid) {
            set(StepUpState.Asking(recovery, StepUpError.Invalid))
            return
        }
        set(StepUpState.Verifying(recovery))
        try {
            if (recovery) staff.verifyRecoveryCode(clean) else staff.verifyTotp(clean)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Throwable) {
            val error = when {
                e is IOException -> StepUpError.Offline
                e is ApiError && e.isRateLimited -> StepUpError.RateLimited
                else -> StepUpError.Invalid
            }
            set(StepUpState.Asking(recovery, error))
            return
        }
        val replay = pending
        pending = null
        set(StepUpState.None)
        replay?.invoke()
    }

    private fun set(next: StepUpState) {
        state = next
        publish(next)
    }
}
