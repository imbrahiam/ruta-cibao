package rutacibao.shared

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import rutacibao.presentation.account.AccountViewModel
import rutacibao.presentation.auth.SignInViewModel
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
 * Owns the shared ViewModels of one SwiftUI screen. Swift creates one per
 * screen model and calls [close] when the screen goes away, which cancels the
 * ViewModels' coroutines exactly like Android's ViewModelStore does.
 */
public class ScreenScope(private val graph: AppGraph) {
    private val store = ViewModelStore()

    private inline fun <reified VM : ViewModel> get(noinline create: () -> VM): VM =
        ViewModelProvider.create(store, viewModelFactory { initializer { create() } })[VM::class]

    public fun consultations(): ConsultationsViewModel = get { graph.viewModels.consultations() }
    public fun signIn(): SignInViewModel = get { graph.viewModels.signIn() }
    public fun account(): AccountViewModel = get { graph.viewModels.account() }
    public fun consultationDetail(): ConsultationDetailViewModel = get { graph.viewModels.consultationDetail() }
    public fun map(): MapViewModel = get { graph.viewModels.map() }
    public fun discover(): rutacibao.presentation.discover.DiscoverViewModel = get { graph.viewModels.discover() }
    // Not `newConsultation`: ObjC reserves the `new` prefix (it would export as `doNewConsultation`).
    public fun consultationComposer(): NewConsultationViewModel = get { graph.viewModels.consultationComposer() }

    public fun contributions(): ContributionsViewModel = get { graph.viewModels.contributions() }

    public fun trafficReport(): TrafficReportViewModel = get { graph.viewModels.trafficReport() }
    public fun suggestPlace(): SuggestPlaceViewModel = get { graph.viewModels.suggestPlace() }

    public fun inbox(): InboxViewModel = get { graph.viewModels.inbox() }

    public fun safety(): SafetyViewModel = get { graph.viewModels.safety() }
    public fun comments(): rutacibao.presentation.comments.CommentsViewModel = get { graph.viewModels.comments() }
    public fun businessForm(): rutacibao.presentation.business.BusinessFormViewModel = get { graph.viewModels.businessForm() }

    public fun gestion(): rutacibao.presentation.gestion.GestionViewModel = get { graph.viewModels.gestion() }

    public fun close(): Unit = store.clear()
}
