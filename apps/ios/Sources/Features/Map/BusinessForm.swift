import Observation
import RutaKit
import SwiftUI

@Observable
final class BusinessFormModel {
    private(set) var state: BusinessFormUiState
    @ObservationIgnored private let scope: ScreenScope
    @ObservationIgnored let viewModel: BusinessFormViewModel

    init(graph: AppGraph, placeId: String, mode: BusinessFormMode, contact: Contact?) {
        scope = ScreenScope(graph: graph)
        viewModel = scope.businessForm()
        viewModel.start(placeId: placeId, mode: mode, contact: contact)
        state = viewModel.state.value
    }

    func observe() async { for await next in viewModel.state { state = next } }
    isolated deinit { scope.close() }
}

/// Claiming a business and the owner's later edits share one form.
struct BusinessFormScreen: View {
    let placeId: String
    let mode: BusinessFormMode
    let contact: Contact?
    /// Called once the server accepted the form, before the sheet closes.
    let done: () -> Void

    @Environment(\.graph) private var graph
    @Environment(\.dismiss) private var dismiss
    @Environment(\.palette) private var palette
    @State private var model: BusinessFormModel?
    @State private var phone: String
    @State private var whatsapp: String
    @State private var hours: String
    @State private var evidence = ""

    init(placeId: String, mode: BusinessFormMode, contact: Contact?, done: @escaping () -> Void) {
        self.placeId = placeId
        self.mode = mode
        self.contact = contact
        self.done = done
        _phone = State(initialValue: contact?.phone ?? "")
        _whatsapp = State(initialValue: contact?.whatsapp ?? "")
        _hours = State(initialValue: contact?.hours ?? "")
    }

    private var claiming: Bool { mode == .claim }

    var body: some View {
        NavigationStack {
            Group {
                if let model { form(model) } else { Color.clear }
            }
            .navigationTitle(claiming ? L10n.Place.claimAction : L10n.Place.editBusiness)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(L10n.Common.cancel) { dismiss() } }
            }
        }
        .task {
            guard let graph else { return }
            let model = self.model ?? BusinessFormModel(graph: graph, placeId: placeId, mode: mode, contact: contact)
            self.model = model
            await model.observe()
        }
    }

    @ViewBuilder private func form(_ model: BusinessFormModel) -> some View {
        let state = model.state
        let vm = model.viewModel
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                if claiming {
                    Field(text: $evidence, placeholder: L10n.Place.claimEvidence, font: PostMetrics.text, lines: 4...8)
                        .onChange(of: evidence) { _, v in vm.updateEvidence(value: v) }
                    problem(state.problems.contains(.evidence), L10n.Place.businessEvidenceShort)
                }
                Field(text: $phone, placeholder: L10n.Place.claimPhone, font: PostMetrics.text, keyboard: .phonePad)
                    .onChange(of: phone) { _, v in vm.updatePhone(value: v) }
                problem(state.problems.contains(.phone), L10n.Place.businessPhoneInvalid)
                Field(text: $whatsapp, placeholder: L10n.Place.whatsapp, font: PostMetrics.text, keyboard: .phonePad)
                    .onChange(of: whatsapp) { _, v in vm.updateWhatsapp(value: v) }
                problem(state.problems.contains(.whatsapp), L10n.Place.businessPhoneInvalid)
                Field(text: $hours, placeholder: L10n.Place.hours, font: PostMetrics.text)
                    .onChange(of: hours) { _, v in vm.updateHours(value: v) }

                if case .failed(let failed) = onEnum(of: state.submit) {
                    NoticeCard(
                        symbol: "exclamationmark.circle.fill",
                        title: failed.error == .offline ? L10n.Common.offline : L10n.Common.errorTitle,
                        body: nil,
                        ink: palette.dangerInk
                    )
                }
            }
            .padding(16)
        }
        .scrollDismissesKeyboard(.interactively)
        .safeAreaInset(edge: .bottom) {
            SubmitBar(
                title: claiming ? L10n.Place.claimSubmit : L10n.Place.businessSave,
                busy: state.submitting,
                enabled: !state.submitting
            ) { vm.submit() }
        }
        .onChange(of: state.submit is BusinessSubmitDone) { _, finished in
            if finished {
                done()
                dismiss()
            }
        }
    }

    @ViewBuilder private func problem(_ show: Bool, _ text: String) -> some View {
        if show {
            Label(text, systemImage: "exclamationmark.circle.fill")
                .font(.footnote.weight(.medium))
                .foregroundStyle(palette.dangerInk)
                .padding(.top, -10)
        }
    }
}
