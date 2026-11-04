package rutacibao.presentation.gestion

import rutacibao.api.generated.ModerationCountsOutput
import rutacibao.api.generated.ModerationDecidePublicationInput
import rutacibao.api.generated.ModerationQueueInput
import rutacibao.data.StaffSource

public enum class Verdict { Approve, Reject }

/** A button on a review card: the verdict it sends and the catalogue key of its label. */
public data class VerdictSpec(val verdict: Verdict, val labelKey: String)

/** Shortest note the server accepts where one is required. */
public const val MIN_NOTE_LENGTH: Int = 10

/**
 * Every kind of thing a moderator reviews, in one table. The UI reads labels,
 * icons and which verdicts need a written reason from here, and
 * [decide] is the only place that knows which endpoint a verdict goes to.
 *
 * [noteOn] lists the verdicts the contract refuses without a reason; the
 * content-report queue asks for one on both.
 */
public enum class ReviewKind(
    public val queue: ModerationQueueInput.Queue,
    private val counted: (ModerationCountsOutput) -> Double,
    public val labelKey: String,
    public val icon: String,
    public val approve: VerdictSpec,
    public val reject: VerdictSpec,
    public val noteOn: Set<Verdict>,
    private val send: suspend StaffSource.(id: String, verdict: Verdict, note: String?) -> Unit,
) {
    Place(
        ModerationQueueInput.Queue.Places, { it.places }, "gestion.kind.place", "map-pin",
        VerdictSpec(Verdict.Approve, "gestion.action.publish"), VerdictSpec(Verdict.Reject, "gestion.action.reject"),
        setOf(Verdict.Reject),
        { id, v, note -> decidePlace(id, v == Verdict.Approve, note) },
    ),
    PlaceReport(
        ModerationQueueInput.Queue.Reports, { it.reports }, "gestion.kind.placeReport", "flag",
        VerdictSpec(Verdict.Approve, "gestion.action.resolve"), VerdictSpec(Verdict.Reject, "gestion.action.dismiss"),
        emptySet(),
        { id, v, note -> decideReport(id, v == Verdict.Approve, note) },
    ),
    Photo(
        ModerationQueueInput.Queue.Photos, { it.photos }, "gestion.kind.photo", "image",
        VerdictSpec(Verdict.Approve, "gestion.action.publish"), VerdictSpec(Verdict.Reject, "gestion.action.reject"),
        emptySet(),
        { id, v, _ -> decidePhoto(id, v == Verdict.Approve) },
    ),
    Claim(
        ModerationQueueInput.Queue.Claims, { it.claims }, "gestion.kind.claim", "store",
        VerdictSpec(Verdict.Approve, "gestion.action.approve"), VerdictSpec(Verdict.Reject, "gestion.action.reject"),
        setOf(Verdict.Reject),
        { id, v, note -> decideClaim(id, v == Verdict.Approve, note) },
    ),
    Traffic(
        ModerationQueueInput.Queue.Traffic, { it.traffic }, "gestion.kind.traffic", "triangle-alert",
        VerdictSpec(Verdict.Approve, "gestion.action.publish"), VerdictSpec(Verdict.Reject, "gestion.action.hide"),
        setOf(Verdict.Reject),
        { id, v, note -> decidePublication(ModerationDecidePublicationInput.Target.Kind.Traffic, id, v == Verdict.Approve, note) },
    ),
    ContentReport(
        ModerationQueueInput.Queue.ContentReports, { it.contentReports }, "gestion.kind.contentReport", "shield-alert",
        VerdictSpec(Verdict.Approve, "gestion.action.remove"), VerdictSpec(Verdict.Reject, "gestion.action.dismiss"),
        setOf(Verdict.Approve, Verdict.Reject),
        { id, v, note -> decideContentReport(id, v == Verdict.Approve, note) },
    ),
    Consultation(
        ModerationQueueInput.Queue.Consultations, { it.consultations }, "gestion.kind.consultation", "messages-square",
        VerdictSpec(Verdict.Approve, "gestion.action.publish"), VerdictSpec(Verdict.Reject, "gestion.action.hide"),
        setOf(Verdict.Reject),
        { id, v, note -> decidePublication(ModerationDecidePublicationInput.Target.Kind.Consultation, id, v == Verdict.Approve, note) },
    );

    public fun count(counts: ModerationCountsOutput): Int = counted(counts).toInt()

    public fun spec(verdict: Verdict): VerdictSpec = if (verdict == Verdict.Approve) approve else reject

    public fun needsNote(verdict: Verdict): Boolean = verdict in noteOn

    /** Sends the verdict to the endpoint this kind belongs to. */
    public suspend fun decide(source: StaffSource, id: String, verdict: Verdict, note: String?) {
        source.send(id, verdict, note?.trim()?.ifEmpty { null })
    }

    public companion object {
        public fun forQueue(queue: ModerationQueueInput.Queue): ReviewKind = entries.first { it.queue == queue }
    }
}
