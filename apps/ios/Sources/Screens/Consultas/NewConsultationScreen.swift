import RutaKit
import SwiftUI

/// Opening a consultation: what happens, where, and a photo if it helps.
struct NewConsultationScreen: View {
    let opened: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Host(make: { $0.consultationComposer() }, flow: { $0.state }) { model in
            Form(model: model, close: { dismiss() }, opened: opened)
        }
        .paperBackground()
        .presentationCornerRadius(Metrics.radiusPanel)
        .interactiveDismissDisabled()
    }
}

private struct Form: View {
    let model: Screen<NewConsultationViewModel, NewConsultationUiState>
    let close: () -> Void
    let opened: (String) -> Void
    @State private var title = ""
    @State private var text = ""

    private var state: NewConsultationUiState { model.state }
    private var vm: NewConsultationViewModel { model.vm }

    var body: some View {
        if state.submitted, state.openedSlug == nil {
            // Queued without signal: it goes out by itself later.
            SentView(title: L10n.Offline.queuedToast, message: L10n.Offline.queuedToastBody, done: close)
        } else {
            FormScreen(title: L10n.Consultations.newTitle, submit: state.error != nil ? L10n.Common.retry : L10n.Consultations.submit, sending: state.sending, enabled: state.canSend, close: close, send: { vm.send() }) {
                Field(placeholder: L10n.Consultations.titleLabel, text: $title)
                    .onChange(of: title) { _, value in vm.updateTitle(value: value) }
                Field(placeholder: L10n.Consultations.bodyLabel, text: $text, lines: 5...12)
                    .onChange(of: text) { _, value in vm.updateBody(value: value) }

                FormLabel(text: L10n.Consultations.category, problem: state.problems.contains(.category))
                ChoiceFlow(items: state.categories.map(\.id), selected: state.categoryId, title: { id in state.categories.first { $0.id == id }?.name ?? "" }, symbol: { id in state.categories.first { $0.id == id }.map { Glyph.symbol($0.icon) } }, model: { id in state.categories.first { $0.id == id }.flatMap { PlaceModel(icon: $0.icon) } }) { vm.selectCategory(id: $0) }

                FormLabel(text: L10n.Consultations.municipality, problem: state.problems.contains(.municipality))
                ChoiceFlow(items: state.municipalities.map(\.id), selected: state.municipalityId, title: { id in state.municipalities.first { $0.id == id }?.name ?? "" }) { vm.selectMunicipality(id: $0) }

                FormLabel(text: L10n.Consultations.location)
                LocationField(latitude: state.latitude?.doubleValue, longitude: state.longitude?.doubleValue) { vm.setLocation(latitude: $0.latitude, longitude: $0.longitude) }

                PhotoTray(images: state.photos.map { BytesKt.dataOf(bytes: $0.jpeg) as Data }, max: Int(NewConsultationUiState.companion.MAX_PHOTOS), add: { vm.addPhoto(jpeg: BytesKt.byteArrayOf(data: $0)) }, remove: { vm.removePhoto(index: Int32($0)) })
                    .padding(.top, 6)

                if let error = state.error {
                    Label(error == .offline ? L10n.Common.offline : L10n.Common.errorTitle, systemImage: "exclamationmark.circle").type(.callout, .danger)
                }
                Label(L10n.Consultations.publicNote, systemImage: "eye").type(.caption, .ink3)
            }
            .onChange(of: state.openedSlug) { _, slug in
                guard let slug else { return }
                close()
                opened(slug)
            }
            .fullScreenCover(isPresented: Binding(get: { state.signInRequested }, set: { if !$0 { vm.signInHandled() } })) { SignInScreen() }
        }
    }
}
