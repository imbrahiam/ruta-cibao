package rutacibao.presentation.business

import rutacibao.api.generated.BusinessesClaimStateOutput
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class BusinessStateTest {
    private fun output(
        claimable: Boolean = true,
        claimed: Boolean = false,
        mine: Boolean = false,
        pending: Boolean = false,
        phone: String? = null,
        whatsapp: String? = null,
        hours: String? = null,
    ) = BusinessesClaimStateOutput(claimable, claimed, mine, pending, phone, whatsapp, hours)

    @Test fun notClaimableIsNotABusiness() {
        assertEquals(BusinessState.NotABusiness, BusinessState.from(output(claimable = false, mine = true), signedIn = true))
    }

    @Test fun unclaimedIsClaimableWithNoContact() {
        assertEquals(BusinessState.Listed(null, canClaim = true), BusinessState.from(output(), signedIn = true))
    }

    @Test fun blankContactFieldsCountAsNone() {
        assertEquals(BusinessState.Listed(null, true), BusinessState.from(output(phone = " ", hours = ""), signedIn = true))
    }

    @Test fun claimedByAnotherShowsContactButNoClaim() {
        val state = BusinessState.from(output(claimed = true, phone = "809-555-0100", hours = "8 a 6"), signedIn = true)
        assertEquals(BusinessState.Listed(Contact("809-555-0100", null, "8 a 6"), canClaim = false), state)
    }

    @Test fun pendingClaim() {
        assertEquals(BusinessState.ClaimPending, BusinessState.from(output(pending = true), signedIn = true))
    }

    @Test fun mineIsOwnedAndWinsOverPending() {
        val state = BusinessState.from(output(claimed = true, mine = true, pending = true, whatsapp = "829-555-0100"), signedIn = true)
        assertEquals(BusinessState.Owned(Contact(null, "829-555-0100", null)), state)
    }

    @Test fun signedOutIgnoresPerPersonFlagsAndKeepsTheClaimRow() {
        assertEquals(BusinessState.Listed(null, true), BusinessState.from(output(mine = true, pending = true), signedIn = false))
    }

    @Test fun linksUseDigitsAndDominicanCountryCode() {
        val c = Contact("(809) 555-0100", "829-555-0100", null)
        assertEquals("tel:+18095550100", c.phoneLink)
        assertEquals("https://wa.me/18295550100", c.whatsappLink)
        assertNull(Contact(null, "abc", null).whatsappLink)
    }

    @Test fun formValidation() {
        val ok = BusinessFormUiState(phone = "809-555-0100", evidence = "x".repeat(20))
        assertTrue(BusinessFormViewModel.problemsOf(ok).isEmpty())
        val bad = BusinessFormUiState(phone = "555", whatsapp = "700-555-0100", evidence = "corto")
        assertEquals(
            setOf(BusinessFormProblem.Phone, BusinessFormProblem.Whatsapp, BusinessFormProblem.Evidence),
            BusinessFormViewModel.problemsOf(bad),
        )
        assertTrue(BusinessFormViewModel.problemsOf(BusinessFormUiState(mode = BusinessFormMode.Edit, phone = "")).isEmpty())
    }
}
