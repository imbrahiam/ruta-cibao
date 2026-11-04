package rutacibao.data

import dev.zacsweers.metro.Inject
import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid
import rutacibao.api.generated.MeGetOutput
import rutacibao.api.generated.MeRequestDeletionInput
import rutacibao.api.generated.MeUpdateProfileInput
import rutacibao.api.generated.MunicipalitiesListItem
import rutacibao.api.generated.NotificationsGetPreferencesOutput
import rutacibao.api.generated.NotificationsSetPreferencesInput
import rutacibao.api.generated.PassportListOutput
import rutacibao.api.generated.PlacesSavedItem
import rutacibao.api.generated.RutaApi

/** The signed-in person's own data. Every write sends a fresh idempotency id. */
@OptIn(ExperimentalUuidApi::class)
@Inject
public class AccountRepository(private val api: RutaApi, private val session: Session) {
    public suspend fun me(): MeGetOutput {
        val token = session.identityToken()
        return api.me.get().also { me -> me.userId?.let { session.bindAccount(it, token) } }
    }
    public suspend fun saved(): List<PlacesSavedItem> = api.places.saved()
    public suspend fun passport(): PassportListOutput = api.passport.list()
    public suspend fun municipalities(): List<MunicipalitiesListItem> = api.municipalities.list()
    public suspend fun preferences(): NotificationsGetPreferencesOutput = api.notifications.getPreferences()

    public suspend fun updateProfile(displayName: String, municipalityId: String?) {
        api.me.updateProfile(MeUpdateProfileInput(requestId = id(), displayName = displayName, municipalityId = municipalityId))
    }

    public suspend fun setPreferences(p: NotificationsGetPreferencesOutput) {
        api.notifications.setPreferences(
            NotificationsSetPreferencesInput(
                municipalityIds = p.municipalityIds,
                categoryIds = p.categoryIds,
                trafficEnabled = p.trafficEnabled,
                caseUpdatesEnabled = p.caseUpdatesEnabled,
                emailEnabled = p.emailEnabled,
                requestId = id(),
            ),
        )
    }

    public suspend fun requestDeletion() {
        api.me.requestDeletion(MeRequestDeletionInput(requestId = id()))
    }

    private fun id() = Uuid.random().toString()
}
