package rutacibao.presentation.map

import kotlin.time.Instant
import rutacibao.api.generated.TrafficActiveItem
import rutacibao.api.generated.TrafficConfirmInput

public enum class TrafficVerdict { Still, Cleared }

/** How much a report costs a driver. Shown as text as well as styled, never colour alone. */
public enum class TrafficSeverity { Blocking, Partial, Minor }

public data class TrafficPoint(val latitude: Double, val longitude: Double)

/** One live road report, as the map draws it and its sheet reads it. */
public data class TrafficNotice(
    val id: String,
    val latitude: Double,
    val longitude: Double,
    /** The stretch of road, empty for a point report. */
    val path: List<TrafficPoint>,
    val icon: String,
    val color: String,
    val categoryName: String,
    val severity: TrafficSeverity?,
    val municipality: String,
    val createdAt: Instant,
    val stillCount: Int,
    val clearedCount: Int,
    val myVerdict: TrafficVerdict?,
    val isMine: Boolean,
    /** Only free text that passed review. */
    val details: String?,
) {
    /** The answer applied locally before the server confirms it. */
    internal fun voting(verdict: TrafficVerdict): TrafficNotice {
        if (myVerdict == verdict) return this
        val still = stillCount + (if (verdict == TrafficVerdict.Still) 1 else 0) - (if (myVerdict == TrafficVerdict.Still) 1 else 0)
        val cleared = clearedCount + (if (verdict == TrafficVerdict.Cleared) 1 else 0) - (if (myVerdict == TrafficVerdict.Cleared) 1 else 0)
        return copy(stillCount = still, clearedCount = cleared, myVerdict = verdict)
    }

    /** A person cannot vouch for their own report. */
    val canConfirm: Boolean get() = !isMine

    internal companion object {
        fun from(item: TrafficActiveItem): TrafficNotice = TrafficNotice(
            id = item.id,
            latitude = item.lat,
            longitude = item.lng,
            path = item.path.orEmpty().map { TrafficPoint(it.lat, it.lng) },
            icon = item.categoryIcon,
            color = item.categoryColor,
            categoryName = item.categoryName,
            severity = when (item.severity) {
                TrafficActiveItem.Severity.Blocking -> TrafficSeverity.Blocking
                TrafficActiveItem.Severity.Partial -> TrafficSeverity.Partial
                TrafficActiveItem.Severity.Minor -> TrafficSeverity.Minor
                null -> null
            },
            municipality = item.municipalityName,
            createdAt = item.createdAt,
            stillCount = item.stillCount.toInt(),
            clearedCount = item.clearedCount.toInt(),
            myVerdict = when (item.myVerdict) {
                TrafficActiveItem.MyVerdict.Still -> TrafficVerdict.Still
                TrafficActiveItem.MyVerdict.Cleared -> TrafficVerdict.Cleared
                null -> null
            },
            isMine = item.isMine,
            details = item.description?.takeIf {
                item.descriptionModerationStatus == TrafficActiveItem.DescriptionModerationStatus.Published && it.isNotBlank()
            },
        )

        fun from(item: rutacibao.api.generated.TrafficDetailOutput): TrafficNotice = TrafficNotice(
            id = item.id, latitude = item.lat, longitude = item.lng,
            path = item.path.orEmpty().map { TrafficPoint(it.lat, it.lng) },
            icon = item.categoryIcon, color = item.categoryColor, categoryName = item.categoryName,
            severity = item.severity?.let { TrafficSeverity.valueOf(it.name) },
            municipality = item.municipalityName, createdAt = item.createdAt,
            stillCount = item.stillCount.toInt(), clearedCount = item.clearedCount.toInt(),
            myVerdict = item.myVerdict?.let { TrafficVerdict.valueOf(it.name) }, isMine = item.isMine,
            details = item.description?.takeIf {
                item.descriptionModerationStatus == rutacibao.api.generated.TrafficDetailOutput.DescriptionModerationStatus.Published && it.isNotBlank()
            },
        )

        fun api(verdict: TrafficVerdict): TrafficConfirmInput.Verdict = when (verdict) {
            TrafficVerdict.Still -> TrafficConfirmInput.Verdict.Still
            TrafficVerdict.Cleared -> TrafficConfirmInput.Verdict.Cleared
        }
    }
}
