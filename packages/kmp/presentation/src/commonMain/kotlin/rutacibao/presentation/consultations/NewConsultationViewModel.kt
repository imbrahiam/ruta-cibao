package rutacibao.presentation.consultations

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.zacsweers.metro.Inject
import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import rutacibao.api.generated.ConsultationsCategoriesItem
import rutacibao.api.generated.ConsultationsOpenInput
import rutacibao.api.generated.MunicipalitiesListItem
import rutacibao.data.ConsultationsRepository
import rutacibao.data.DraftPhoto
import rutacibao.data.Session
import rutacibao.presentation.UiError

public data class NewConsultationUiState(
    val categories: List<ConsultationsCategoriesItem> = emptyList(),
    val municipalities: List<MunicipalitiesListItem> = emptyList(),
    val categoryId: String? = null,
    val municipalityId: String? = null,
    val title: String = "",
    val body: String = "",
    val latitude: Double? = null,
    val longitude: Double? = null,
    val sending: Boolean = false,
    val submitted: Boolean = false,
    val queued: Boolean = false,
    val photoCount: Int = 0,
    val photos: List<DraftPhoto> = emptyList(),
    /** Field problems, shown only after a first submit attempt. */
    val problems: Set<Problem> = emptySet(),
    val error: UiError? = null,
    /** Set once the server accepted it; the UI closes and opens the case. */
    val openedSlug: String? = null,
    val signInRequested: Boolean = false,
) {
    public enum class Problem { Category, Municipality, Title, Body }

    val bodyLength: Int get() = body.trim().length
    val canSend: Boolean get() = !sending && problemsNow().isEmpty()

    internal fun problemsNow(): Set<Problem> = buildSet {
        if (categoryId == null) add(Problem.Category)
        if (municipalityId == null) add(Problem.Municipality)
        if (title.trim().length !in TITLE) add(Problem.Title)
        if (body.trim().length !in BODY) add(Problem.Body)
    }

    public companion object {
        /** Same bounds as the contract (`openConsultationInput`). */
        public val TITLE: IntRange = 8..120
        public val BODY: IntRange = 40..2_000
        public const val MAX_PHOTOS: Int = 4
    }
}

/** Composing a case for the ayuntamiento, Threads-composer style. */
@OptIn(ExperimentalUuidApi::class)
@Inject
public class NewConsultationViewModel(
    private val repository: ConsultationsRepository,
    private val session: Session,
) : ViewModel() {
    private val _state = MutableStateFlow(NewConsultationUiState())
    public val state: StateFlow<NewConsultationUiState> = _state.asStateFlow()

    /** One id per draft: a retried send can't open the case twice. */
    private val requestId = Uuid.random().toString()
    private val photos = mutableListOf<DraftPhoto>()

    init {
        viewModelScope.launch {
            runCatching { repository.categories() to repository.municipalities() }
                .onSuccess { (categories, municipalities) ->
                    _state.update {
                        it.copy(
                            categories = categories,
                            municipalities = municipalities,
                            municipalityId = it.municipalityId ?: municipalities.singleOrNull()?.id,
                        )
                    }
                }
                .onFailure { e -> _state.update { it.copy(error = UiError.from(e)) } }
        }
    }

    public fun selectCategory(id: String) { edit { copy(categoryId = id) } }
    public fun selectMunicipality(id: String) { edit { copy(municipalityId = id) } }
    public fun updateTitle(value: String) { edit { copy(title = value.take(NewConsultationUiState.TITLE.last)) } }
    public fun updateBody(value: String) { edit { copy(body = value.take(NewConsultationUiState.BODY.last)) } }
    public fun setLocation(latitude: Double, longitude: Double) { edit { copy(latitude = latitude, longitude = longitude) } }
    public fun clearLocation() { edit { copy(latitude = null, longitude = null) } }
    public fun addPhoto(jpeg: ByteArray) {
        if (_state.value.submitted || photos.size >= NewConsultationUiState.MAX_PHOTOS) return
        photos += DraftPhoto(Uuid.random().toString(), jpeg)
        _state.update { it.copy(photoCount = photos.size, photos = photos.toList()) }
    }

    public fun removePhoto(index: Int) {
        if (_state.value.submitted || index !in photos.indices) return
        photos.removeAt(index)
        _state.update { it.copy(photoCount = photos.size, photos = photos.toList()) }
    }


    public fun send() {
        val s = _state.value
        if (s.sending || s.queued || s.openedSlug != null) return
        val problems = s.problemsNow()
        if (problems.isNotEmpty()) {
            _state.update { it.copy(problems = problems) }
            return
        }
        if (!session.isSignedIn.value) {
            _state.update { it.copy(signInRequested = true) }
            return
        }
        _state.update { it.copy(sending = true, submitted = true, error = null) }
        viewModelScope.launch {
            val input = ConsultationsOpenInput(
                requestId = requestId,
                categoryId = s.categoryId!!,
                title = s.title.trim(),
                body = s.body.trim(),
                municipalityId = s.municipalityId!!,
                location = if (s.latitude != null && s.longitude != null) ConsultationsOpenInput.Location(lng = s.longitude, lat = s.latitude) else null,
            )
            runCatching { repository.openWithPhotos(input, photos.toList()) }
                .onSuccess { delivery -> _state.update { it.copy(sending = false, queued = delivery.queued, openedSlug = delivery.slug) } }
                .onFailure { e ->
                    val kind = UiError.from(e)
                    _state.update { it.copy(sending = false, error = kind, signInRequested = kind == UiError.SignedOut) }
                }
        }
    }

    public fun signInHandled() { _state.update { it.copy(signInRequested = false) } }

    /** Editing clears the problems it fixes, never adds new ones mid-typing. */
    private fun edit(change: NewConsultationUiState.() -> NewConsultationUiState) {
        _state.update { old ->
            if (old.submitted) return@update old
            val next = old.change()
            next.copy(problems = old.problems intersect next.problemsNow(), error = null)
        }
    }
}
