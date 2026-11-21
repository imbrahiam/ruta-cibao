@file:OptIn(ExperimentalTime::class)

package rutacibao.presentation.account

import rutacibao.api.generated.ReputationGetOutput
import kotlin.time.ExperimentalTime
import kotlin.time.Instant

/** The four ranks, lowest first. Names come from the catalogue (`reputation.rank.*`). */
public enum class RankId { Vecino, Explorador, Guia, Leyenda }

public enum class BadgeId { FirstContribution, Traveller, ThreeTowns, Watchful, CivicVoice, RoadWatch, Host }

public enum class ContributionKind { Place, Route, Consultation, Traffic, Confirmation, Stamp, Support, Invite }

public data class RankStep(val id: RankId, val min: Int, val max: Int?)

public data class BadgeProgress(val id: BadgeId, val earned: Boolean, val current: Int, val target: Int) {
    /** 0…1, for a ring or bar. */
    val fraction: Float get() = if (target == 0) 1f else (current.toFloat() / target).coerceIn(0f, 1f)
}

/** Someone shown beside what they did: their name and, when they have one, their photo. */
public data class Person(val name: String, val image: String?)

public data class PointsLine(val kind: ContributionKind, val count: Int, val each: Int, val points: Int)

/**
 * Someone's standing, shaped for the screens: one rank type throughout, plain
 * ints, and the progress inside the current rank already worked out.
 */
public data class Reputation(
    val points: Int,
    val joinedAt: Instant,
    val rank: RankId,
    val ranks: List<RankStep>,
    /** Null at the top rank. */
    val next: RankId?,
    val pointsToGo: Int,
    val breakdown: List<PointsLine>,
    val badges: List<BadgeProgress>,
    val inviteCode: String,
    val inviteUrl: String,
    val joined: Int,
    val redeemed: Boolean,
    /** Who invited this account, if anyone. */
    val invitedBy: Person?,
    /** The latest few who joined with this code, newest first. */
    val joinedPeople: List<Person>,
) {
    /** The host badge is earned: an invite was answered. */
    val hostEarned: Boolean get() = badges.any { it.id == BadgeId.Host && it.earned }

    val earnedBadges: Int get() = badges.count { it.earned }

    /** Index of the current rank on the track. */
    val rankIndex: Int get() = ranks.indexOfFirst { it.id == rank }.coerceAtLeast(0)

    /** 0…1 through the current rank; 1 at the top. */
    val rankProgress: Float
        get() {
            val step = ranks.getOrNull(rankIndex) ?: return 0f
            val max = step.max ?: return 1f
            return ((points - step.min).toFloat() / (max - step.min)).coerceIn(0f, 1f)
        }

    internal companion object {
        fun from(o: ReputationGetOutput): Reputation = Reputation(
            points = o.points.toInt(),
            joinedAt = o.joinedAt,
            rank = RankId.valueOf(o.rank.name),
            ranks = o.ranks.map { RankStep(RankId.valueOf(it.id.name), it.min.toInt(), it.max?.toInt()) },
            next = o.next?.let { RankId.valueOf(it.id.name) },
            pointsToGo = o.next?.pointsToGo?.toInt() ?: 0,
            breakdown = o.breakdown.map { PointsLine(ContributionKind.valueOf(it.kind.name), it.count.toInt(), it.each.toInt(), it.points.toInt()) },
            badges = o.badges.map { BadgeProgress(BadgeId.valueOf(it.id.name), it.earned, it.current.toInt(), it.target.toInt()) },
            inviteCode = o.invite.code,
            inviteUrl = o.invite.url,
            joined = o.invite.joined.toInt(),
            redeemed = o.invite.redeemed,
            invitedBy = o.invite.invitedBy?.let { Person(it.name, it.image) },
            joinedPeople = o.invite.joinedPeople.map { Person(it.name, it.image) },
        )
    }
}

/** Why a code was not accepted, each one a catalogue string (`reputation.error*`). */
public enum class RedeemError { InvalidCode, UnknownCode, OwnCode, AlreadyRedeemed, RateLimited, Failed }

public sealed interface Redeem {
    public data object Idle : Redeem
    public data object Working : Redeem
    public data class Done(val inviterName: String) : Redeem
    public data class Failed(val error: RedeemError) : Redeem
}
