package rutacibao.data

import dev.zacsweers.metro.Inject
import rutacibao.api.generated.ConsultationsBrowseInput
import rutacibao.api.generated.ConsultationsBrowseOutput
import rutacibao.api.generated.ConsultationsCategoriesItem
import rutacibao.api.generated.ConsultationsOpenInput
import rutacibao.api.generated.ConsultationsOpenOutput
import rutacibao.api.generated.MunicipalitiesListItem
import rutacibao.api.generated.ConsultationsDetailInput
import rutacibao.api.generated.ConsultationsDetailOutput
import rutacibao.api.generated.ConsultationsSupportInput
import rutacibao.api.generated.ConsultationsSupportOutput
import rutacibao.api.generated.RutaApi

@Inject
public class ConsultationsRepository(private val api: RutaApi) {
    public suspend fun browse(
        status: ConsultationsBrowseInput.Status?,
        offset: Int,
        limit: Int,
    ): ConsultationsBrowseOutput =
        api.consultations.browse(ConsultationsBrowseInput(status = status, offset = offset, limit = limit))

    public suspend fun detail(slug: String): ConsultationsDetailOutput =
        api.consultations.detail(ConsultationsDetailInput(slug = slug))

    /** The caller's own cases, any publication state (for id → slug). */
    public suspend fun mine(): ConsultationsBrowseOutput =
        api.consultations.browse(ConsultationsBrowseInput(mine = true, limit = 48))

    public suspend fun categories(): List<ConsultationsCategoriesItem> = api.consultations.categories()

    public suspend fun municipalities(): List<MunicipalitiesListItem> = api.municipalities.list()

    public suspend fun open(input: ConsultationsOpenInput): ConsultationsOpenOutput = api.consultations.open(input)

    /** Sets the end state (not a toggle), so a retried tap is harmless. */
    public suspend fun support(id: String, supported: Boolean): ConsultationsSupportOutput =
        api.consultations.support(ConsultationsSupportInput(consultationId = id, supported = supported))
}
