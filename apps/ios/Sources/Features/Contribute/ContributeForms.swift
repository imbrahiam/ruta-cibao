import MapKit
import Observation
import RutaKit
import SwiftUI

// MARK: - Models

@Observable
final class TrafficReportModel {
    private(set) var state: TrafficReportUiState
    @ObservationIgnored private let scope: ScreenScope
    @ObservationIgnored let viewModel: TrafficReportViewModel

    init(graph: AppGraph) {
        scope = ScreenScope(graph: graph)
        viewModel = scope.trafficReport()
        state = viewModel.state.value
    }

    func observe() async { for await next in viewModel.state { state = next } }
    isolated deinit { scope.close() }
}

@Observable
final class SuggestPlaceModel {
    private(set) var state: SuggestPlaceUiState
    @ObservationIgnored private let scope: ScreenScope
    @ObservationIgnored let viewModel: SuggestPlaceViewModel

    init(graph: AppGraph) {
        scope = ScreenScope(graph: graph)
        viewModel = scope.suggestPlace()
        state = viewModel.state.value
    }

    func observe() async { for await next in viewModel.state { state = next } }
    isolated deinit { scope.close() }
}

// MARK: - Road report

/// "Reportar la vía": pick what it is (big tappable tiles), where, send.
struct TrafficReportScreen: View {
    var sent: () -> Void = {}
    @Environment(\.graph) private var graph
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var scheme
    @Environment(\.palette) private var palette
    @State private var model: TrafficReportModel?
    @State private var picking = false
    @State private var detail = ""

    /// Reopen the picker on the point already marked.
    static func point(_ state: TrafficReportUiState) -> CLLocationCoordinate2D? {
        guard let lat = state.latitude?.doubleValue, let lng = state.longitude?.doubleValue else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }

    var body: some View {
        NavigationStack {
            Group {
                if let model {
                    form(model)
                } else {
                    Color.clear
                }
            }
            .navigationTitle(L10n.Contribute.Traffic.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { SheetClose { dismiss() } }
            }
        }
        .task {
            guard let graph else { return }
            let model = self.model ?? TrafficReportModel(graph: graph)
            self.model = model
            #if DEBUG
            // `SIMCTL_CHILD_RUTA_DEBUG_FORM=send`: first kind, a point in Sabaneta, submit (offline-queue runs).
            if ProcessInfo.processInfo.environment["RUTA_DEBUG_FORM"] == "send" {
                Task { @MainActor in
                    while model.state.categories.isEmpty { try? await Task.sleep(for: .milliseconds(200)) }
                    model.viewModel.selectCategory(id: model.state.categories[0].id)
                    model.viewModel.setLocation(latitude: 19.4626, longitude: -71.3592)
                    try? await Task.sleep(for: .milliseconds(500))
                    model.viewModel.send()
                }
            }
            #endif
            await model.observe()
        }
    }

    @ViewBuilder private func form(_ model: TrafficReportModel) -> some View {
        let state = model.state
        let vm = model.viewModel
        if state.sent {
            Done(title: state.queued ? L10n.Offline.queuedToast : L10n.Contribute.Traffic.sent, body: state.queued ? L10n.Offline.queuedToastBody : L10n.Contribute.Traffic.sentBody) {
                sent()
                dismiss()
            }
        } else {
            FillingScroll {
                VStack(alignment: .leading, spacing: 16) {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 104), spacing: 10)], spacing: 10) {
                        ForEach(state.categories, id: \.id) { c in
                            let selected = c.id == state.categoryId
                            let style = CategoryGlyph.style(c.icon, hex: c.color)
                            Button { vm.selectCategory(id: c.id) } label: {
                                VStack(spacing: 10) {
                                    PinBadge(symbol: style.symbol, color: style.color, size: 48)
                                    Text(c.name)
                                        .font(.footnote.weight(selected ? .bold : .medium))
                                        .multilineTextAlignment(.center)
                                        .lineLimit(2)
                                        .foregroundStyle(palette.text)
                                }
                                .padding(.horizontal, 8)
                                .frame(maxWidth: .infinity, minHeight: 112)
                                .background(palette.raised(scheme), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                                .overlay {
                                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                                        .strokeBorder(selected ? palette.text : .clear, lineWidth: 2)
                                }
                                .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                            }
                            .buttonStyle(.plain)
                            .accessibilityAddTraits(selected ? .isSelected : [])
                            .sensoryFeedback(.selection, trigger: selected)
                        }
                    }

                    LocationRow(
                        latitude: state.latitude?.doubleValue,
                        longitude: state.longitude?.doubleValue,
                        required: false,
                        grows: true
                    ) { picking = true }

                    GrowField(text: $detail, placeholder: L10n.Contribute.Traffic.description, font: PostMetrics.text, grows: false)
                        .onChange(of: detail) { _, v in vm.updateDescription(value: v) }

                    if state.duplicate {
                        NoticeCard(symbol: "person.2.fill", title: L10n.Contribute.Traffic.duplicate, body: L10n.Contribute.Traffic.duplicateBody, ink: palette.warningInk)
                    } else if let error = state.error {
                        NoticeCard(symbol: "exclamationmark.circle.fill", title: error == .offline ? L10n.Common.offline : L10n.Common.errorTitle, body: nil, ink: palette.dangerInk)
                    }
                }
                .padding(16)
            }
            .safeAreaInset(edge: .bottom) {
                SubmitBar(title: L10n.Contribute.Traffic.submit, busy: state.sending, enabled: state.canSend) { vm.send() }
            }
            .sheet(isPresented: $picking) {
                LocationPicker(start: Self.point(model.state)) { vm.setLocation(latitude: $0.latitude, longitude: $0.longitude) }
            }
        }
    }
}

// MARK: - Place suggestion

struct SuggestPlaceScreen: View {
    var sent: () -> Void = {}
    @Environment(\.graph) private var graph
    @Environment(\.dismiss) private var dismiss
    @Environment(\.palette) private var palette
    @State private var model: SuggestPlaceModel?
    @State private var picking = false
    @State private var name = ""
    @State private var about = ""
    @State private var address = ""

    /// Reopen the picker on the point already marked.
    static func point(_ state: SuggestPlaceUiState) -> CLLocationCoordinate2D? {
        guard let lat = state.latitude?.doubleValue, let lng = state.longitude?.doubleValue else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }

    var body: some View {
        NavigationStack {
            Group {
                if let model {
                    form(model)
                } else {
                    Color.clear
                }
            }
            .navigationTitle(L10n.Contribute.Place.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { SheetClose { dismiss() } }
            }
        }
        .task {
            guard let graph else { return }
            let model = self.model ?? SuggestPlaceModel(graph: graph)
            self.model = model
            await model.observe()
        }
    }

    @ViewBuilder private func form(_ model: SuggestPlaceModel) -> some View {
        let state = model.state
        let vm = model.viewModel
        if state.sent {
            Done(title: state.queued ? L10n.Offline.queuedToast : L10n.Contribute.Place.sent, body: state.queued ? L10n.Offline.queuedToastBody : L10n.Contribute.Place.sentBody, art: .colmado) {
                sent()
                dismiss()
            }
        } else if state.pendingLimit {
            // One suggestion in review at a time (the server enforces it too).
            VStack {
                Spacer()
                EmptyState(art: .colmado, title: L10n.Contribute.Place.pendingTitle, message: L10n.Contribute.Place.pendingBody, size: 210)
                Spacer()
            }
        } else {
            FillingScroll {
                VStack(alignment: .leading, spacing: 14) {
                    Field(text: $name, placeholder: L10n.Contribute.Place.name, font: PostMetrics.name)
                        .onChange(of: name) { _, v in vm.updateName(value: v) }
                    problem(state, .name, L10n.Contribute.Place.Errors.name)

                    GrowField(text: $about, placeholder: L10n.Contribute.Place.description, font: PostMetrics.text, counter: (Int(state.descriptionLength), 20))
                        .onChange(of: about) { _, v in vm.updateDescription(value: v) }
                    problem(state, .theDescription, L10n.Contribute.Place.Errors.description)

                    Menu {
                        Picker(L10n.Contribute.Place.category, selection: Binding(
                            get: { state.categoryId ?? "" }, set: { vm.selectCategory(id: $0) }
                        )) {
                            ForEach(state.categories, id: \.id) { c in
                                Label(c.name, systemImage: CategoryGlyph.symbol(c.icon)).tag(c.id)
                            }
                        }
                    } label: {
                        let chosen = state.categories.first { $0.id == state.categoryId }
                        HStack(spacing: 12) {
                            if let chosen {
                                CategoryPinBadge(icon: chosen.icon, hex: chosen.color, size: 32)
                            } else {
                                Image(systemName: "tag").font(.system(size: 16)).frame(width: 32, height: 32).foregroundStyle(palette.textSecondary)
                            }
                            Text(chosen?.name ?? L10n.Contribute.Place.category)
                                .font(PostMetrics.text)
                                .foregroundStyle(chosen == nil ? palette.textTertiary : palette.text)
                            Spacer()
                            Image(systemName: "chevron.up.chevron.down").font(.footnote).foregroundStyle(palette.textTertiary)
                        }
                        .padding(12)
                        .background(palette.inset, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    problem(state, .category, L10n.Contribute.Place.Errors.category)

                    LocationRow(latitude: state.latitude?.doubleValue, longitude: state.longitude?.doubleValue, required: true) { picking = true }
                    problem(state, .location, L10n.Contribute.Place.Errors.location)

                    Field(text: $address, placeholder: L10n.Contribute.Place.address, font: PostMetrics.text)
                        .onChange(of: address) { _, v in vm.updateAddress(value: v) }

                    PhotoAttach(
                        max: Int(SuggestPlaceUiState.companion.MAX_PHOTOS),
                        images: state.photos.map { BytesKt.dataOf(bytes: $0.jpeg) as Data },
                        add: { vm.addPhoto(jpeg: BytesKt.byteArrayOf(data: $0)) },
                        remove: { vm.removePhoto(index: Int32($0)) }
                    )
                    .disabled(state.sending)

                    if let error = state.error {
                        NoticeCard(symbol: "exclamationmark.circle.fill", title: error == .offline ? L10n.Common.offline : L10n.Common.errorTitle, body: nil, ink: palette.dangerInk)
                    }
                }
                .padding(16)
            }
            .safeAreaInset(edge: .bottom) {
                SubmitBar(title: L10n.Contribute.Place.submit, busy: state.sending, enabled: !state.sending) { vm.send() }
            }
            .sheet(isPresented: $picking) {
                LocationPicker(start: Self.point(model.state)) { vm.setLocation(latitude: $0.latitude, longitude: $0.longitude) }
            }
        }
    }

    @ViewBuilder private func problem(_ state: SuggestPlaceUiState, _ p: SuggestPlaceUiState.Problem, _ text: String) -> some View {
        if state.problems.contains(p) {
            Label(text, systemImage: "exclamationmark.circle.fill")
                .font(.footnote.weight(.medium))
                .foregroundStyle(palette.dangerInk)
                .padding(.top, -10)
        }
    }
}

// MARK: - Shared pieces

struct Field: View {
    @Binding var text: String
    let placeholder: String
    let font: Font
    var lines: ClosedRange<Int> = 1...3
    var keyboard: UIKeyboardType = .default
    @Environment(\.palette) private var palette

    var body: some View {
        TextField(text: $text, prompt: Text(placeholder).foregroundStyle(palette.textTertiary), axis: .vertical) { Text(placeholder) }
            .font(font)
            .lineLimit(lines)
            .keyboardType(keyboard)
            .padding(14)
            .background(palette.inset, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

/// Where it is, always as a mini-map: around you until you mark a point,
/// then on the point with its pin. Tapping opens the full picker.
struct LocationRow: View {
    let latitude: Double?
    let longitude: Double?
    let required: Bool
    /// Takes the free height (never under `height`) instead of staying fixed.
    var grows = false
    let pick: () -> Void
    @Environment(\.palette) private var palette

    private static let fallback = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 19.4757, longitude: -71.3418),
        latitudinalMeters: 3000, longitudinalMeters: 3000
    )

    var body: some View {
        Button(action: pick) {
            Group {
                if let latitude, let longitude {
                    let c = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
                    Map(position: .constant(.region(MKCoordinateRegion(center: c, latitudinalMeters: 500, longitudinalMeters: 500))), interactionModes: []) {
                        Marker("", coordinate: c).tint(.red)
                    }
                } else {
                    Map(initialPosition: .userLocation(fallback: .region(Self.fallback)), interactionModes: []) {
                        UserAnnotation()
                    }
                }
            }
            .mapStyle(.standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll))
            .tint(palette.locate)
            .frame(minHeight: 180, maxHeight: grows ? .infinity : 180)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Color.primary.opacity(0.08), lineWidth: 0.5)
            }
            // Top corner: the bottom one belongs to the Maps logo.
            .overlay(alignment: .topLeading) {
                let marked = latitude != nil
                Label(marked ? L10n.Contribute.change : L10n.Contribute.Place.location, systemImage: marked ? "mappin" : "mappin.and.ellipse")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                    .padding(.horizontal, 14)
                    .frame(height: 36)
                    .glassEffect(.regular, in: Capsule())
                    .padding(10)
            }
            .allowsHitTesting(false)
            .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(L10n.Contribute.Place.location)
    }
}

/// Scrolls, but at least as tall as the viewport, so a flexible field inside
/// takes the leftover height instead of leaving a gap above the button.
struct FillingScroll<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        GeometryReader { proxy in
            ScrollView {
                content.frame(minHeight: proxy.size.height, alignment: .top)
            }
            .scrollBounceBehavior(.basedOnSize)
            .scrollDismissesKeyboard(.interactively)
        }
    }
}

/// A filled multi-line field that grows into the free height, with the
/// minimum-length counter once typing has started.
struct GrowField: View {
    @Binding var text: String
    let placeholder: String
    let font: Font
    var minHeight: CGFloat = 120
    var grows = true
    var counter: (count: Int, min: Int)?
    @Environment(\.palette) private var palette
    @FocusState private var focused: Bool

    var body: some View {
        TextField(text: $text, prompt: Text(placeholder).foregroundStyle(palette.textTertiary), axis: .vertical) { Text(placeholder) }
            .font(font)
            .focused($focused)
            .padding(14)
            .frame(maxWidth: .infinity, minHeight: minHeight, maxHeight: grows ? .infinity : minHeight, alignment: .topLeading)
            .background(palette.inset, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .onTapGesture { focused = true }
            .overlay(alignment: .bottomTrailing) {
                if let counter, counter.count > 0, counter.count < counter.min {
                    Text(L10n.Contribute.counter(count: String(counter.count), min: String(counter.min)))
                        .font(.footnote)
                        .foregroundStyle(palette.textSecondary)
                        .padding(12)
                        .allowsHitTesting(false)
                }
            }
    }
}

/// The sheet's dismiss control: the system's close button, so the title
/// stays centred between two quiet ends.
struct SheetClose: View {
    let action: () -> Void
    var body: some View {
        Button(role: .close, action: action)
            .accessibilityLabel(L10n.Common.close)
    }
}

struct SubmitBar: View {
    let title: String
    let busy: Bool
    let enabled: Bool
    let action: () -> Void
    @Environment(\.palette) private var palette

    var body: some View {
        Button(action: action) {
            ZStack {
                Text(title).opacity(busy ? 0 : 1)
                if busy { ProgressView().tint(RutaHighlight.onPrimary(palette)) }
            }
            .font(.headline)
            .frame(maxWidth: .infinity, minHeight: 52)
        }
        .buttonStyle(RutaProminentStyle())
        .disabled(!enabled)
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        // No bar behind it: the page runs to the bottom, as in the system's
        // own sheets; the scroll edge effect keeps the button legible.
    }
}

struct NoticeCard: View {
    let symbol: String
    let title: String
    let detail: String?
    let ink: Color
    @Environment(\.palette) private var palette

    init(symbol: String, title: String, body: String?, ink: Color) {
        self.symbol = symbol
        self.title = title
        self.detail = body
        self.ink = ink
    }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: symbol).foregroundStyle(ink)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(ink)
                if let detail { Text(detail).font(.subheadline).foregroundStyle(palette.textSecondary) }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(ink.opacity(0.08), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

/// Sent: a big check, two short lines, then back.
struct Done: View {
    let title: String
    let detail: String
    let art: Art?
    let finish: () -> Void

    init(title: String, body: String, art: Art? = nil, finish: @escaping () -> Void) {
        self.title = title
        self.detail = body
        self.art = art
        self.finish = finish
    }
    @Environment(\.palette) private var palette
    @State private var shown = false

    var body: some View {
        VStack(spacing: 14) {
            if let art {
                Illustration(art: art, size: 220)
            } else {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 64, weight: .semibold))
                    .foregroundStyle(palette.success)
                    .symbolEffect(.bounce, value: shown)
            }
            Label(title, systemImage: "checkmark.circle.fill")
                .font(.title3.weight(.bold))
                .labelStyle(DoneTitleStyle(tint: palette.success, showsIcon: art != nil))
            Text(detail).font(.subheadline).foregroundStyle(palette.textSecondary).multilineTextAlignment(.center)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .sensoryFeedback(.success, trigger: shown)
        .task {
            shown = true
            try? await Task.sleep(for: .seconds(art == nil ? 1.6 : 2.2))
            finish()
        }
    }
}

/// The confirmation's title, with the check beside it when an illustration
/// took the check's place above.
private struct DoneTitleStyle: LabelStyle {
    let tint: Color
    let showsIcon: Bool
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 6) {
            if showsIcon { configuration.icon.foregroundStyle(tint) }
            configuration.title
        }
    }
}
