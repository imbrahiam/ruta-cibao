package rutacibao.presentation.gestion

import kotlin.time.Instant
import rutacibao.api.generated.ModerationQueueOutput
import rutacibao.core.AppConfig

/**
 * One card on the review desk. Every subtype carries exactly what its card
 * shows; the platform renders [municipality] and [createdAt] together.
 */
public sealed interface ReviewItem {
    public val kind: ReviewKind
    public val id: String
    public val title: String
    public val municipality: String
    public val createdAt: Instant
    public val snippet: String?
    public val imageUrl: String?

    /** The buttons this card offers right now. */
    public val actions: List<ReviewAction> get() = kind.pair()

    /** Catalogue key of a status line shown on the card, for states that change what the buttons do. */
    public val stateKey: String? get() = null

    /**
     * The card after [verdict] succeeds, or null when it leaves the desk. The server keeps live traffic
     * and published-but-unanswered cases in its queue, so deciding on them changes the card instead.
     */
    public fun after(verdict: Verdict): ReviewItem? = null

    public data class Place(
        override val id: String,
        override val title: String,
        override val municipality: String,
        override val createdAt: Instant,
        override val snippet: String?,
        override val imageUrl: String? = null,
    ) : ReviewItem { override val kind: ReviewKind get() = ReviewKind.Place }

    public data class PlaceReport(
        override val id: String,
        override val title: String,
        override val municipality: String,
        override val createdAt: Instant,
        override val snippet: String?,
        override val imageUrl: String? = null,
    ) : ReviewItem { override val kind: ReviewKind get() = ReviewKind.PlaceReport }

    public data class Photo(
        override val id: String,
        override val title: String,
        override val municipality: String,
        override val createdAt: Instant,
        override val snippet: String?,
        override val imageUrl: String?,
    ) : ReviewItem { override val kind: ReviewKind get() = ReviewKind.Photo }

    public data class Claim(
        override val id: String,
        override val title: String,
        override val municipality: String,
        override val createdAt: Instant,
        override val snippet: String?,
        override val imageUrl: String?,
    ) : ReviewItem { override val kind: ReviewKind get() = ReviewKind.Claim }

    /** A live road report. [snippet] is its free text, held for review while [text] is pending. */
    public data class Traffic(
        override val id: String,
        override val title: String,
        override val municipality: String,
        override val createdAt: Instant,
        override val snippet: String?,
        override val imageUrl: String? = null,
        val text: Publication = Publication.Published,
    ) : ReviewItem {
        override val kind: ReviewKind get() = ReviewKind.Traffic

        private val reviewingText: Boolean get() = snippet != null && text == Publication.Pending

        override val actions: List<ReviewAction>
            get() = buildList {
                if (reviewingText) {
                    add(kind.decide(Verdict.Reject, "gestion.action.hideText", Emphasis.Secondary))
                    add(kind.decide(Verdict.Approve, "gestion.action.publishText", Emphasis.Secondary))
                }
                add(kind.decide(Verdict.Remove, "gestion.action.removeTraffic", Emphasis.Primary))
            }

        override val stateKey: String?
            get() = when {
                snippet == null -> null
                text == Publication.Pending -> "gestion.state.textPending"
                text == Publication.Published -> "gestion.state.textPublished"
                else -> "gestion.state.textHidden"
            }

        override fun after(verdict: Verdict): ReviewItem? = when (verdict) {
            Verdict.Remove -> null
            Verdict.Approve -> copy(text = Publication.Published)
            Verdict.Reject -> copy(text = Publication.Hidden)
        }
    }

    public data class ContentReport(
        override val id: String,
        override val title: String,
        override val municipality: String,
        override val createdAt: Instant,
        override val snippet: String?,
        override val imageUrl: String? = null,
    ) : ReviewItem { override val kind: ReviewKind get() = ReviewKind.ContentReport }

    public data class Consultation(
        override val id: String,
        override val title: String,
        override val municipality: String,
        override val createdAt: Instant,
        override val snippet: String?,
        override val imageUrl: String? = null,
        val photoUrls: List<String> = emptyList(),
        val slug: String = id,
        val publication: Publication = Publication.Pending,
        /** Still open or in review: publishing it keeps it on the desk until the ayuntamiento answers. */
        val awaitingAnswer: Boolean = true,
    ) : ReviewItem {
        override val kind: ReviewKind get() = ReviewKind.Consultation

        override val actions: List<ReviewAction>
            get() = when (publication) {
                Publication.Pending -> kind.pair()
                else -> listOf(
                    kind.decide(Verdict.Reject, "gestion.action.hideCase", Emphasis.Secondary),
                    ReviewAction.OpenThread(slug),
                )
            }

        override val stateKey: String?
            get() = when (publication) {
                Publication.Pending -> "gestion.state.casePending"
                Publication.Published -> "gestion.state.casePublished"
                Publication.Hidden -> null
            }

        override fun after(verdict: Verdict): ReviewItem? =
            if (verdict == Verdict.Approve && awaitingAnswer) copy(publication = Publication.Published) else null
    }
}

/** The cards of one queue response, newest first. Only the requested queue is filled by the server. */
internal fun ModerationQueueOutput.toItems(config: AppConfig): List<ReviewItem> =
    buildList {
        places.forEach { add(ReviewItem.Place(it.id, it.name, it.municipalityName, it.createdAt, it.description ?: it.address)) }
        reports.forEach { add(ReviewItem.PlaceReport(it.id, it.placeName, it.municipalityName, it.createdAt, it.details)) }
        photos.forEach {
            add(ReviewItem.Photo(it.id, it.placeName, it.municipalityName, it.createdAt, null, config.absolute(it.url)))
        }
        claims.forEach {
            add(
                ReviewItem.Claim(
                    it.id, it.placeName, it.municipalityName, it.createdAt, it.evidence, it.placeImage?.let(config::absolute),
                ),
            )
        }
        traffic.forEach {
            add(ReviewItem.Traffic(it.id, it.categoryName, it.municipalityName, it.createdAt, it.description, text = it.descriptionModerationStatus.toPublication()))
        }
        contentReports.forEach {
            add(
                ReviewItem.ContentReport(
                    it.id, it.subjectTitle ?: it.subject.ref, it.municipalityName, it.createdAt, it.details,
                ),
            )
        }
        consultations.forEach {
            add(
                ReviewItem.Consultation(
                    it.id, it.title, it.municipalityName, it.createdAt, it.body,
                    photoUrls = it.photos.map { photo -> config.absolute(photo.url) },
                    slug = it.slug,
                    publication = it.publicationStatus.toPublication(),
                    awaitingAnswer = it.status == ModerationQueueOutput.Consultation.Status.Open ||
                        it.status == ModerationQueueOutput.Consultation.Status.InReview,
                ),
            )
        }
    }.sortedByDescending { it.createdAt }

private fun ModerationQueueOutput.TrafficItem.DescriptionModerationStatus.toPublication() = when (this) {
    ModerationQueueOutput.TrafficItem.DescriptionModerationStatus.Pending -> Publication.Pending
    ModerationQueueOutput.TrafficItem.DescriptionModerationStatus.Published -> Publication.Published
    ModerationQueueOutput.TrafficItem.DescriptionModerationStatus.Hidden -> Publication.Hidden
}

private fun ModerationQueueOutput.Consultation.PublicationStatus.toPublication() = when (this) {
    ModerationQueueOutput.Consultation.PublicationStatus.Pending -> Publication.Pending
    ModerationQueueOutput.Consultation.PublicationStatus.Published -> Publication.Published
    ModerationQueueOutput.Consultation.PublicationStatus.Hidden -> Publication.Hidden
}
