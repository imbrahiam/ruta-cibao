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
        val digits = input.filter { it in '0'..'9' }
        val withoutCountry =
            if (digits.length > NATIONAL_DIGITS && digits.startsWith("1")) digits.drop(1) else digits
        return withoutCountry.take(NATIONAL_DIGITS)
    }

    private fun inputDigits(digits: String): String = digits.removePrefix("1").take(NATIONAL_DIGITS)

    public fun formatInput(input: String): String {
        val digits = inputDigits(input.filter { it in '0'..'9' })
        if (digits.isEmpty()) return ""
        if (digits.length < 3) return "($digits"
        val area = "(${digits.take(3)})"
        if (digits.length == 3) return area
        val prefix = "$area ${digits.drop(3).take(3)}"
        return if (digits.length <= 6) prefix else "$prefix-${digits.drop(6)}"
    }

    public enum class Deletion { Backward, Forward }
    public data class Edit(val value: String, val caret: Int)

    public fun editInput(previous: String, input: String, caret: Int, deletion: Deletion?): Edit {
        val rawDigits = input.filter { it in '0'..'9' }
        var digits = inputDigits(rawDigits)
        var position = input.take(caret).count { it in '0'..'9' }
        if (rawDigits.startsWith("1")) {
            position = (position - 1).coerceAtLeast(0)
        }
        if (deletion != null && input != previous && digits == inputDigits(previous.filter { it in '0'..'9' })) {
            val index = if (deletion == Deletion.Backward) position - 1 else position
            if (index in digits.indices) {
                digits = digits.removeRange(index, index + 1)
                position = index
            }
        }
        val value = formatInput(digits)
        if (position >= digits.length) return Edit(value, value.length)
        var remaining = position
        for ((index, char) in value.withIndex()) {
            if (char in '0'..'9' && remaining-- == 0) return Edit(value, index)
        }
        return Edit(value, value.length)
    }

    public fun isComplete(input: String): Boolean {
        val digits = nationalDigits(input)
        return digits.length == NATIONAL_DIGITS && digits.take(3) in AREA_CODES
    }

    /** The storage form, or null if this is not a Dominican number. */
    public fun normalize(input: String): String? =
        if (isComplete(input)) "+1${nationalDigits(input)}" else null

    public fun format(e164: String): String {
        val digits = nationalDigits(e164)
        return listOf(digits.take(3), digits.drop(3).take(3), digits.drop(6))
            .filter(String::isNotEmpty)
            .joinToString("-")
    }
}
