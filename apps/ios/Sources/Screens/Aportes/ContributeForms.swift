import RutaKit
import SwiftUI

/// Something on the road right now: what it is and where, in two taps.
struct TrafficReportScreen: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Host(make: { $0.trafficReport() }, flow: { $0.state }) { model in
            TrafficForm(model: model, close: { dismiss() })
        }
        .paperBackground()
    }
}

private struct TrafficForm: View {
    let model: Screen<TrafficReportViewModel, TrafficReportUiState>
    let close: () -> Void
    @State private var detail = ""

    private var state: TrafficReportUiState { model.state }
    private var vm: TrafficReportViewModel { model.vm }

    var body: some View {
        if state.sent {
            SentView(title: state.queued ? L10n.Offline.queuedToast : L10n.Contribute.Traffic.sent, message: state.queued ? L10n.Offline.queuedToastBody : L10n.Contribute.Traffic.sentBody, done: close)
        } else {
            FormScreen(title: L10n.Contribute.Traffic.title, submit: L10n.Contribute.Traffic.submit, sending: state.sending, enabled: state.canSend, close: close, send: { vm.send() }) {
                // What is on the road, as a grid of the same icons the map draws.
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8, alignment: .top), count: 3), spacing: 14) {
                    ForEach(state.categories, id: \.id) { category in
                        let selected = category.id == state.categoryId
                        let kind = TrafficSignKind.of(category: category.name, icon: category.icon)
                        Button { vm.selectCategory(id: category.id) } label: {
                            VStack(spacing: 8) {
                                TrafficSign(kind: kind, size: 42)
                                    .frame(width: 76, height: 76)
                                    .background(Color.paper2, in: Circle())
                                    .overlay(Circle().strokeBorder(Color.action, lineWidth: selected ? 3 : 0))
                                    .overlay(alignment: .topTrailing) {
                                        if selected {
                                            Image(systemName: "checkmark.circle.fill")
                                                .font(.system(size: 20))
                                                .symbolRenderingMode(.palette)
                                                .foregroundStyle(Color.onInk, Color.action)
                                                .background(Circle().fill(Color.paper).padding(-2))
                                                .transition(.scale.combined(with: .opacity))
                                        }
                                    }
                                Text(category.name)
                                    .font(.system(size: 14, weight: selected ? .semibold : .regular))
                                    .foregroundStyle(Color.ink)
                                    .multilineTextAlignment(.center).lineLimit(2)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            .frame(maxWidth: .infinity)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(Pressable())
                        .accessibilityAddTraits(selected ? .isSelected : [])
                    }
                }
                .animation(Motion.quick, value: state.categoryId)
                .sensoryFeedback(.selection, trigger: state.categoryId)

                LocationField(latitude: state.latitude?.doubleValue, longitude: state.longitude?.doubleValue, required: true, title: L10n.Contribute.Place.location) { vm.setLocation(latitude: $0.latitude, longitude: $0.longitude) }

                Field(placeholder: L10n.Contribute.Traffic.description, text: $detail, lines: 1...4)
                    .onChange(of: detail) { _, value in vm.updateDescription(value: value) }

                if state.duplicate {
                    Notice(symbol: "person.2", title: L10n.Contribute.Traffic.duplicate, message: L10n.Contribute.Traffic.duplicateBody)
                } else if let error = state.error {
                    Label(error == .offline ? L10n.Common.offline : L10n.Common.errorTitle, systemImage: "exclamationmark.circle").type(.callout, .danger)
                }
            }
            .task {
                // A road report is almost always about where you are standing.
                guard state.latitude == nil, let here = await CurrentLocation.once() else { return }
                if model.state.latitude == nil { vm.setLocation(latitude: here.latitude, longitude: here.longitude) }
            }
        }
    }
}

/// A place the map is missing: its name, what it is, where, and a photo.
struct SuggestPlaceScreen: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Host(make: { $0.suggestPlace() }, flow: { $0.state }) { model in
            PlaceForm(model: model, close: { dismiss() })
        }
        .paperBackground()
    }
}

private struct PlaceForm: View {
    let model: Screen<SuggestPlaceViewModel, SuggestPlaceUiState>
    let close: () -> Void
    @State private var name = ""
    @State private var detail = ""
    @State private var address = ""

    private var state: SuggestPlaceUiState { model.state }
    private var vm: SuggestPlaceViewModel { model.vm }

    var body: some View {
        if state.sent {
            SentView(title: state.queued ? L10n.Offline.queuedToast : L10n.Contribute.Place.sent, message: state.queued ? L10n.Offline.queuedToastBody : L10n.Contribute.Place.sentBody, done: close)
        } else if state.pendingLimit {
            VStack(spacing: 0) {
                SheetBar(title: L10n.Contribute.Place.title, close: close)
                StateView(symbol: "clock", title: L10n.Contribute.Place.pendingTitle, message: L10n.Contribute.Place.pendingBody)
            }
        } else {
            // Like the other forms, Send waits until what is required is there.
            let ready = !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && state.categoryId != nil && state.latitude != nil
            FormScreen(title: L10n.Contribute.Place.title, submit: L10n.Contribute.Place.submit, sending: state.sending, enabled: ready, close: close, send: { vm.send() }) {
                Field(placeholder: L10n.Contribute.Place.name, text: $name).onChange(of: name) { _, v in vm.updateName(value: v) }
                problem(.name, L10n.Contribute.Place.Errors.name)
                Field(placeholder: L10n.Contribute.Place.description, text: $detail, lines: 3...8).onChange(of: detail) { _, v in vm.updateDescription(value: v) }
                problem(.theDescription, L10n.Contribute.Place.Errors.description)

                MenuField(placeholder: L10n.Contribute.Place.category, items: state.categories.map(\.id), selected: state.categoryId, title: { id in state.categories.first { $0.id == id }?.name ?? "" }, symbol: { id in state.categories.first { $0.id == id }.map { Glyph.symbol($0.icon) } }, model: { id in state.categories.first { $0.id == id }.flatMap { PlaceModel(icon: $0.icon) } }, problem: state.problems.contains(.category)) { vm.selectCategory(id: $0) }

                LocationField(latitude: state.latitude?.doubleValue, longitude: state.longitude?.doubleValue, required: true, title: L10n.Contribute.Place.location) { vm.setLocation(latitude: $0.latitude, longitude: $0.longitude) }
                Field(placeholder: L10n.Contribute.Place.address, text: $address).onChange(of: address) { _, v in vm.updateAddress(value: v) }

                PhotoTray(images: state.photos.map { BytesKt.dataOf(bytes: $0.jpeg) as Data }, max: Int(SuggestPlaceUiState.companion.MAX_PHOTOS), add: { vm.addPhoto(jpeg: BytesKt.byteArrayOf(data: $0)) }, remove: { vm.removePhoto(index: Int32($0)) })
                    .padding(.top, 6)

                if let error = state.error {
                    Label(error == .offline ? L10n.Common.offline : L10n.Common.errorTitle, systemImage: "exclamationmark.circle").type(.callout, .danger)
                }
                Label(L10n.Contribute.reviewNote, systemImage: "clock").type(.caption, .ink3)
            }
        }
    }

    @ViewBuilder private func problem(_ kind: SuggestPlaceUiState.Problem, _ text: String) -> some View {
        if state.problems.contains(kind) { Text(text).type(.caption, .danger).padding(.top, -6) }
    }
}

/// A quiet in-form notice: one glyph, a line, and its explanation.
struct Notice: View {
    let symbol: String
    let title: String
    var message: String?

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: symbol).font(.system(size: 16, weight: .light)).foregroundStyle(Color.ink2)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).type(.label)
                if let message { Text(message).type(.callout, .ink3) }
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .background(Color.paper2, in: RoundedRectangle(cornerRadius: Metrics.radiusField, style: .continuous))
    }
}
