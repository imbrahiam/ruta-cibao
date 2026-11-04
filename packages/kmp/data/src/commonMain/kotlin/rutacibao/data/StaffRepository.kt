package rutacibao.data

import dev.zacsweers.metro.Inject
import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import rutacibao.api.ApiError
import rutacibao.api.generated.ConsultationsRespondInput
import rutacibao.api.generated.MeGetOutput
import rutacibao.api.generated.ModerationCountsOutput
import rutacibao.api.generated.ModerationDecideClaimInput
import rutacibao.api.generated.ModerationDecideContentReportInput
import rutacibao.api.generated.ModerationDecidePhotoInput
import rutacibao.api.generated.ModerationDecidePlaceInput
import rutacibao.api.generated.ModerationDecidePublicationInput
import rutacibao.api.generated.ModerationDecideReportInput
import rutacibao.api.generated.ModerationQueueInput
import rutacibao.api.generated.ModerationQueueOutput
import rutacibao.api.generated.ModerationRemoveTrafficInput
import rutacibao.api.generated.ReportsDetailInput
import rutacibao.api.generated.ReportsListInput
import rutacibao.api.generated.ReportsListItem
import rutacibao.api.generated.RutaApi
import rutacibao.api.generated.StaffVerifyRecoveryCodeInput
import rutacibao.api.generated.StaffVerifyTotpInput
import rutacibao.core.AppConfig

/** The staff session needs its second factor before this call can go through. */
public class StepUpRequired : Exception("staff step-up required")

/** The staff member has no second factor yet; it can only be set up on the web. */
public class EnrollmentRequired : Exception("two-factor enrollment required")

/**
 * Runs a staff call and turns the server's two step-up refusals into typed
 * exceptions, so every caller handles them in one place.
 */
public suspend fun <T> staffCall(block: suspend () -> T): T =
    try {
        block()
    } catch (e: ApiError) {
        val reason = ((e.data as? JsonObject)?.get("reason") as? JsonPrimitive)?.content
        if (e.status == 403 || e.code == "FORBIDDEN") {
            when (reason) {
                "staff_step_up_required" -> throw StepUpRequired()
                "totp_enrollment_required" -> throw EnrollmentRequired()
            }
        }
        throw e
    }

/** What the staff desk needs from the network; a seam so it can be tested without one. */
public interface StaffSource {
    public suspend fun staffRole(): MeGetOutput.StaffRole

    public suspend fun counts(): ModerationCountsOutput

    public suspend fun queue(queue: ModerationQueueInput.Queue, limit: Int): ModerationQueueOutput

    /** Each `approve` flag is the queue's positive verdict (publish, resolve, approve, action). */
    public suspend fun decidePlace(id: String, approve: Boolean, note: String?)

    public suspend fun decideReport(id: String, approve: Boolean, note: String?)

    public suspend fun decidePhoto(id: String, approve: Boolean)

    public suspend fun decideClaim(id: String, approve: Boolean, note: String?)

    public suspend fun decideContentReport(id: String, approve: Boolean, reason: String?)

    public suspend fun decidePublication(
        kind: ModerationDecidePublicationInput.Target.Kind,
        id: String,
        approve: Boolean,
        reason: String?,
    )

    /** Takes a live road report off the map. The note is required (10 characters or more). */
    public suspend fun removeTraffic(id: String, note: String)

    public suspend fun respond(consultationId: String, body: String, statusAfter: ConsultationsRespondInput.StatusAfter)

    public suspend fun reports(): List<ReportsListItem>

    /** The signed, expiring PDF link of a report, absolute; null while it is not rendered. */
    public suspend fun reportPdfUrl(reportId: String): String?

    public suspend fun verifyTotp(code: String)

    public suspend fun verifyRecoveryCode(code: String)
}

/** Moderation, the weekly report and the second-factor step-up. Every write sends a fresh idempotency id. */
@OptIn(ExperimentalUuidApi::class)
@Inject
public class StaffRepository(private val api: RutaApi, private val config: AppConfig) : StaffSource {
    override suspend fun staffRole(): MeGetOutput.StaffRole = api.me.get().staffRole

    override suspend fun counts(): ModerationCountsOutput = staffCall { api.moderation.counts() }

    override suspend fun queue(queue: ModerationQueueInput.Queue, limit: Int): ModerationQueueOutput =
        staffCall { api.moderation.queue(ModerationQueueInput(queue = queue, limit = limit)) }

    override suspend fun decidePlace(id: String, approve: Boolean, note: String?) {
        val decision = if (approve) ModerationDecidePlaceInput.Decision.Publish else ModerationDecidePlaceInput.Decision.Reject
        staffCall { api.moderation.decidePlace(ModerationDecidePlaceInput(id, requestId(), decision, note)) }
    }

    override suspend fun decideReport(id: String, approve: Boolean, note: String?) {
        val decision = if (approve) ModerationDecideReportInput.Decision.Resolved else ModerationDecideReportInput.Decision.Dismissed
        staffCall { api.moderation.decideReport(ModerationDecideReportInput(id, requestId(), decision, note)) }
    }

    override suspend fun decidePhoto(id: String, approve: Boolean) {
        val decision = if (approve) ModerationDecidePhotoInput.Decision.Publish else ModerationDecidePhotoInput.Decision.Reject
        staffCall { api.moderation.decidePhoto(ModerationDecidePhotoInput(id, requestId(), decision)) }
    }

    override suspend fun decideClaim(id: String, approve: Boolean, note: String?) {
        val decision = if (approve) ModerationDecideClaimInput.Decision.Approve else ModerationDecideClaimInput.Decision.Reject
        staffCall { api.moderation.decideClaim(ModerationDecideClaimInput(id, requestId(), decision, note)) }
    }

    override suspend fun decideContentReport(id: String, approve: Boolean, reason: String?) {
        val decision =
            if (approve) ModerationDecideContentReportInput.Decision.Actioned else ModerationDecideContentReportInput.Decision.Dismissed
        staffCall { api.moderation.decideContentReport(ModerationDecideContentReportInput(id, requestId(), decision, reason.orEmpty())) }
    }

    override suspend fun decidePublication(
        kind: ModerationDecidePublicationInput.Target.Kind,
        id: String,
        approve: Boolean,
        reason: String?,
    ) {
        val status =
            if (approve) ModerationDecidePublicationInput.Status.Published else ModerationDecidePublicationInput.Status.Hidden
        staffCall {
            api.moderation.decidePublication(
                ModerationDecidePublicationInput(requestId(), ModerationDecidePublicationInput.Target(kind, id), status, reason),
            )
        }
    }

    override suspend fun removeTraffic(id: String, note: String) {
        staffCall { api.moderation.removeTraffic(ModerationRemoveTrafficInput(id, requestId(), note)) }
    }

    override suspend fun respond(consultationId: String, body: String, statusAfter: ConsultationsRespondInput.StatusAfter) {
        staffCall { api.consultations.respond(ConsultationsRespondInput(consultationId, requestId(), body, statusAfter)) }
    }

    override suspend fun reports(): List<ReportsListItem> = staffCall { api.reports.list(ReportsListInput(limit = 8)) }

    override suspend fun reportPdfUrl(reportId: String): String? =
        staffCall { api.reports.detail(ReportsDetailInput(reportId)) }.pdfUrl?.let(config::absolute)

    override suspend fun verifyTotp(code: String) {
        api.staff.verifyTotp(StaffVerifyTotpInput(code))
    }

    override suspend fun verifyRecoveryCode(code: String) {
        api.staff.verifyRecoveryCode(StaffVerifyRecoveryCodeInput(code))
    }

    private fun requestId() = Uuid.random().toString()
}
