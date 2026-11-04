package rutacibao.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class PhoneTest {
    @Test
    fun everyCommonSpellingLandsOnTheSameNumber() {
        for (input in listOf("809-555-1234", "(809) 555 1234", "18095551234", "+1 809 555 1234")) {
            assertEquals("+18095551234", Phone.normalize(input), input)
        }
    }

    @Test
    fun formatsAsYouType() {
        assertEquals("809", Phone.formatInput("809"))
        assertEquals("809-55", Phone.formatInput("80955"))
        assertEquals("809-555-1234", Phone.formatInput("8095551234999"))
    }

    @Test
    fun rejectsForeignAreaCodes() {
        assertNull(Phone.normalize("305-555-1234"))
    }
}
