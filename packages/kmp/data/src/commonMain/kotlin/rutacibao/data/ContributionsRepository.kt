package rutacibao.data

import dev.zacsweers.metro.Inject
import rutacibao.api.generated.PlacesContributionsItem
import rutacibao.api.generated.RutaApi

@Inject
public class ContributionsRepository(private val api: RutaApi) {
    public suspend fun mine(): List<PlacesContributionsItem> = api.places.contributions()
}
