package rutacibao.data

import dev.zacsweers.metro.Inject
import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid
import rutacibao.api.generated.RutaApi
import rutacibao.api.generated.SafetyBlockAuthorInput
import rutacibao.api.generated.SafetyHiddenTargetsInput
import rutacibao.api.generated.SafetyReportInput

/** Reporting content and hiding an author's contributions. */
@OptIn(ExperimentalUuidApi::class)
@Inject
public class SafetyRepository(private val api: RutaApi) {
    public suspend fun reportConsultation(id: String, reason: SafetyReportInput.Reason, details: String?) {
        api.safety.report(
            SafetyReportInput(
                requestId = Uuid.random().toString(),
                target = SafetyReportInput.Target(SafetyReportInput.Target.Kind.Consultation, id),
                reason = reason,
                details = details?.trim()?.ifEmpty { null },
            ),
        )
    }

    public suspend fun hideAuthorOfConsultation(id: String) {
        api.safety.blockAuthor(
            SafetyBlockAuthorInput(
                requestId = Uuid.random().toString(),
                target = SafetyBlockAuthorInput.Target(SafetyBlockAuthorInput.Target.Kind.Consultation, id),
            ),
        )
    }

    /** Consultation ids the signed-in person no longer wants to see. */
    public suspend fun hiddenConsultations(): Set<String> =
        api.safety.hiddenTargets(SafetyHiddenTargetsInput()).items
            .filter { it.kind.name == "Consultation" }
            .map { it.ref }
            .toSet()
}
