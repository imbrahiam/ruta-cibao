package rutacibao.core

/**
 * Dominican phone numbers, ported from `packages/shared/src/phone.ts` so the
 * native field formats exactly like the web and the server normalises.
 *
 * Storage is E.164 (`+18095551234`); display is `809-555-1234`.
 */
public object Phone {
    private val AREA_CODES = setOf("809", "829", "849")
    private const val NATIONAL_DIGITS = 10

    private fun nationalDigits(input: String): String {
        val digits = input.filter(Char::isDigit)
        val withoutCountry =
            if (digits.length > NATIONAL_DIGITS && digits.startsWith("1")) digits.drop(1) else digits
        return withoutCountry.take(NATIONAL_DIGITS)
    }

    /** What the field shows while someone types: 3-3-4 groups, digits only. */
    public fun formatInput(input: String): String {
        val digits = nationalDigits(input)
        return listOf(digits.take(3), digits.drop(3).take(3), digits.drop(6))
            .filter(String::isNotEmpty)
            .joinToString("-")
    }

    public fun isComplete(input: String): Boolean {
        val digits = nationalDigits(input)
        return digits.length == NATIONAL_DIGITS && digits.take(3) in AREA_CODES
    }

    /** The storage form, or null if this is not a Dominican number. */
    public fun normalize(input: String): String? =
        if (isComplete(input)) "+1${nationalDigits(input)}" else null

    public fun format(e164: String): String = formatInput(e164)
}
