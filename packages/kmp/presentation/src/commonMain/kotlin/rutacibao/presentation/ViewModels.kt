package rutacibao.presentation

import dev.zacsweers.metro.Inject
import dev.zacsweers.metro.Provider
import rutacibao.presentation.account.AccountViewModel
import rutacibao.presentation.auth.SignInViewModel
import rutacibao.presentation.comments.CommentsViewModel
import rutacibao.presentation.consultations.ConsultationDetailViewModel
import rutacibao.presentation.consultations.ConsultationsViewModel
import rutacibao.presentation.safety.SafetyViewModel
import rutacibao.presentation.contribute.SuggestPlaceViewModel
import rutacibao.presentation.contribute.TrafficReportViewModel
import rutacibao.presentation.contributions.ContributionsViewModel
import rutacibao.presentation.contributions.InboxViewModel
import rutacibao.presentation.consultations.NewConsultationViewModel
import rutacibao.presentation.map.MapViewModel

/**
 * Factories for every shared ViewModel, one function per screen. Each call
 * returns a new instance; the platform owns its lifetime (Android's
 * ViewModelStore, or [rutacibao.shared.ScreenScope] on iOS).
 */
@Inject
public class ViewModels(
    private val consultationsProvider: Provider<ConsultationsViewModel>,
    private val signInProvider: Provider<SignInViewModel>,
    private val accountProvider: Provider<AccountViewModel>,
    private val consultationDetailProvider: Provider<ConsultationDetailViewModel>,
    private val mapProvider: Provider<MapViewModel>,
    private val newConsultationProvider: Provider<NewConsultationViewModel>,
    private val contributionsProvider: Provider<ContributionsViewModel>,
    private val trafficReportProvider: Provider<TrafficReportViewModel>,
    private val suggestPlaceProvider: Provider<SuggestPlaceViewModel>,
    private val inboxProvider: Provider<InboxViewModel>,
    private val safetyProvider: Provider<SafetyViewModel>,
    private val commentsProvider: Provider<CommentsViewModel>,
) {
    public fun comments(): CommentsViewModel = commentsProvider()
    public fun safety(): SafetyViewModel = safetyProvider()
    public fun inbox(): InboxViewModel = inboxProvider()
    public fun trafficReport(): TrafficReportViewModel = trafficReportProvider()
    public fun suggestPlace(): SuggestPlaceViewModel = suggestPlaceProvider()
    public fun contributions(): ContributionsViewModel = contributionsProvider()
    public fun consultationComposer(): NewConsultationViewModel = newConsultationProvider()
    public fun map(): MapViewModel = mapProvider()
    public fun consultationDetail(): ConsultationDetailViewModel = consultationDetailProvider()
    public fun consultations(): ConsultationsViewModel = consultationsProvider()
    public fun signIn(): SignInViewModel = signInProvider()
    public fun account(): AccountViewModel = accountProvider()
}
