package rutacibao.data

import dev.zacsweers.metro.Inject
import rutacibao.api.generated.BusinessesClaimInput
import rutacibao.api.generated.BusinessesClaimStateInput
import rutacibao.api.generated.BusinessesClaimStateOutput
import rutacibao.api.generated.BusinessesUpdateInput
import rutacibao.api.generated.RutaApi

/** Who owns a local business, and its public contact details. */
@Inject
public class BusinessRepository(private val api: RutaApi) {
    public suspend fun claimState(placeId: String): BusinessesClaimStateOutput =
        api.businesses.claimState(BusinessesClaimStateInput(placeId = placeId))

    public suspend fun claim(
        requestId: String,
        placeId: String,
        evidence: String,
        phone: String,
        whatsapp: String,
        hours: String,
    ) {
        api.businesses.claim(
            BusinessesClaimInput(
                placeId = placeId,
                requestId = requestId,
                evidence = evidence.trim(),
                contactPhone = phone.trim(),
                whatsapp = whatsapp.trim(),
                openingHours = hours.trim(),
            ),
        )
    }

    public suspend fun update(requestId: String, placeId: String, phone: String, whatsapp: String, hours: String) {
        api.businesses.update(
            BusinessesUpdateInput(
                placeId = placeId,
                requestId = requestId,
                contactPhone = phone.trim(),
                whatsapp = whatsapp.trim(),
                openingHours = hours.trim(),
            ),
        )
    }
}
