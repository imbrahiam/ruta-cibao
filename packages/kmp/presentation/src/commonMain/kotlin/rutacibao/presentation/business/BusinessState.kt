package rutacibao.presentation.business

import rutacibao.api.generated.BusinessesClaimStateOutput

/** What a business publishes about itself. Each field is null when blank. */
public data class Contact(
    val phone: String?,
    val whatsapp: String?,
    val hours: String?,
) {
    /** `https://wa.me/<digits>` with the Dominican country code (1) when missing. */
    val whatsappLink: String?
        get() = whatsapp?.let { raw ->
            val digits = raw.filter(Char::isDigit)
            if (digits.isEmpty()) null else "https://wa.me/" + (if (digits.length == 10) "1$digits" else digits)
        }

    /** `tel:` target, digits only. */
    val phoneLink: String?
        get() = phone?.filter(Char::isDigit)?.takeIf { it.isNotEmpty() }?.let { "tel:+" + (if (it.length == 10) "1$it" else it) }
}

/** The business side of a place sheet, derived once from `businesses.claimState`. */
public sealed interface BusinessState {
    public data object NotABusiness : BusinessState

    /** Someone else's (or nobody's) business, with the contact it publishes. */
    public data class Listed(val contact: Contact?, val canClaim: Boolean) : BusinessState

    public data object ClaimPending : BusinessState

    public data class Owned(val contact: Contact) : BusinessState

    public companion object {
        /**
         * Signed out, `mine` and `pending` can't hold, so they're ignored. A
         * signed-out person can still see "¿Es tu negocio?": tapping it asks
         * them to sign in.
         */
        public fun from(output: BusinessesClaimStateOutput, signedIn: Boolean): BusinessState {
            val contact = Contact(
                phone = output.contactPhone.blankToNull(),
                whatsapp = output.whatsapp.blankToNull(),
                hours = output.openingHours.blankToNull(),
            )
            return when {
                !output.claimable -> NotABusiness
                signedIn && output.mine -> Owned(contact)
                signedIn && output.pending -> ClaimPending
                else -> Listed(
                    contact = contact.takeIf { it.phone != null || it.whatsapp != null || it.hours != null },
                    canClaim = !output.claimed,
                )
            }
        }
    }
}

private fun String?.blankToNull(): String? = this?.trim()?.takeIf { it.isNotEmpty() }
