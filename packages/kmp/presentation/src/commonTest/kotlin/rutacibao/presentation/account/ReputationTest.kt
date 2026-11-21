@file:OptIn(ExperimentalTime::class)

package rutacibao.presentation.account

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.time.ExperimentalTime
import kotlin.time.Instant

class ReputationTest {
    private val ranks = listOf(
        RankStep(RankId.Vecino, 0, 25),
        RankStep(RankId.Explorador, 25, 75),
        RankStep(RankId.Guia, 75, 150),
        RankStep(RankId.Leyenda, 150, null),
    )

    private fun at(points: Int, rank: RankId) = Reputation(
        points = points, joinedAt = Instant.fromEpochSeconds(0), rank = rank, ranks = ranks,
        next = null, pointsToGo = 0, breakdown = emptyList(), badges = emptyList(),
        inviteCode = "A1B2C3D4", inviteUrl = "https://example.test/i/A1B2C3D4", joined = 0, redeemed = false,
        invitedBy = null, joinedPeople = emptyList(),
    )

    @Test
    fun progressIsMeasuredInsideTheCurrentRank() {
        assertEquals(0f, at(0, RankId.Vecino).rankProgress)
        assertEquals(0.5f, at(50, RankId.Explorador).rankProgress)
        assertEquals(1, at(50, RankId.Explorador).rankIndex)
    }

    @Test
    fun theTopRankIsAlwaysFull() {
        assertEquals(1f, at(400, RankId.Leyenda).rankProgress)
    }

    @Test
    fun badgeFractionIsCapped() {
        assertEquals(0.6f, BadgeProgress(BadgeId.Traveller, false, 3, 5).fraction)
        assertEquals(1f, BadgeProgress(BadgeId.Host, true, 1, 1).fraction)
    }
}
