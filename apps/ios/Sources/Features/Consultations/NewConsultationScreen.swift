import MapKit
import Observation
import RutaKit
import SwiftUI

@Observable
final class NewConsultationModel {
    private(set) var state: NewConsultationUiState
    @ObservationIgnored private let scope: ScreenScope
    @ObservationIgnored let viewModel: NewConsultationViewModel

    init(graph: AppGraph) {
        scope = ScreenScope(graph: graph)
        viewModel = scope.consultationComposer()
        state = viewModel.state.value
    }

    func observe() async {
        for await next in viewModel.state { state = next }
    }

    isolated deinit { scope.close() }
}

/// Composing a case, Threads-composer style: write first, then attach the
/// topic, the municipality and (optionally) a point on the map.
struct NewConsultationScreen: View {
    /// Called with the new case's slug once the server accepted it.
    var opened: (String) -> Void = { _ in }
    @Environment(\.graph) private var graph
    @Environment(\.dismiss) private var dismiss
    @State private var model: NewConsultationModel?

    var body: some View {
        NavigationStack {
            Group {
                if let model {
                    if model.state.queued {
                        VStack(spacing: 16) {
                            Image(systemName: "clock.arrow.circlepath").font(.largeTitle)
                            Text(L10n.Offline.queuedToast).font(.title2.bold())
                            Text(L10n.Offline.queuedToastBody).foregroundStyle(.secondary).multilineTextAlignment(.center)
                            Button(L10n.Common.close) { dismiss() }.frame(minHeight: 44)
                        }.padding(24)
                    } else {
                        Composer(model: model)
                    }
                } else {
                    Color.clear
                }
            }
            .navigationTitle(L10n.Consultations.newTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { SheetClose { dismiss() } }
            }
        }
        .task {
            guard let graph else { return }
            let model = self.model ?? NewConsultationModel(graph: graph)
            self.model = model
            await model.observe()
        }
        .onChange(of: model?.state.openedSlug) { _, slug in
            guard let slug else { return }
            dismiss()
            opened(slug)
        }
    }
}

private struct Composer: View {
    let model: NewConsultationModel
    @Environment(\.palette) private var palette
    @FocusState private var focus: Field?
    @State private var picking = false
    @State private var title = ""
    @State private var text = ""

    private static let minimumBody = 40
    private enum Field { case title, body }
    private var state: NewConsultationUiState { model.state }
    private var vm: NewConsultationViewModel { model.viewModel }

    private var category: ConsultationsCategoriesItem? { state.categories.first { $0.id == state.categoryId } }
    private var municipality: MunicipalitiesListItem? { state.municipalities.first { $0.id == state.municipalityId } }

    var body: some View {
        FillingScroll {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .top, spacing: PostMetrics.gap) {
                    avatar
                    VStack(alignment: .leading, spacing: 6) {
                        TextField(text: $title, prompt: Text(L10n.Consultations.titleLabel).foregroundStyle(palette.textTertiary), axis: .vertical) { Text(L10n.Consultations.titleLabel) }
                            .font(PostMetrics.name)
                            .focused($focus, equals: .title)
                            .submitLabel(.next)
                            .onSubmit { focus = .body }
                            .onChange(of: title) { _, v in vm.updateTitle(value: v) }
                            .disabled(state.submitted)
                            .padding(14)
                            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                            .background(palette.inset, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        problem(.title, L10n.Consultations.Errors.title)
                    }
                }

                TextField(text: $text, prompt: Text(L10n.Consultations.bodyLabel).foregroundStyle(palette.textTertiary), axis: .vertical) { Text(L10n.Consultations.bodyLabel) }
                    .font(PostMetrics.text)
                    .focused($focus, equals: .body)
                    .onChange(of: text) { _, v in vm.updateBody(value: v) }
                    .disabled(state.submitted)
                    .padding(14)
                    .frame(maxWidth: .infinity, minHeight: 120, maxHeight: .infinity, alignment: .topLeading)
                    .background(palette.inset, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .onTapGesture { focus = .body }
                    .overlay(alignment: .bottomTrailing) {
                        let count = Int(state.bodyLength)
                        if count > 0, count < Self.minimumBody {
                            Text(L10n.Contribute.counter(count: String(count), min: String(Self.minimumBody)))
                                .font(.footnote)
                                .foregroundStyle(palette.textSecondary)
                                .padding(12)
                                .allowsHitTesting(false)
                        }
                    }
                problem(.body, L10n.Consultations.Errors.body)

                attachments.disabled(state.submitted)
                PhotoAttach(
                    max: Int(NewConsultationUiState.companion.MAX_PHOTOS),
                    images: state.photos.map { BytesKt.dataOf(bytes: $0.jpeg) as Data },
                    add: { vm.addPhoto(jpeg: BytesKt.byteArrayOf(data: $0)) },
                    remove: { vm.removePhoto(index: Int32($0)) }
                ).padding(.top, 2).disabled(state.submitted)
                if let error = state.error {
                    NoticeCard(symbol: "exclamationmark.circle.fill", title: error == .offline ? L10n.Common.offline : L10n.Common.errorTitle, body: nil, ink: palette.dangerInk)
                }
                Label(L10n.Consultations.publicNote, systemImage: "eye")
                    .font(.footnote)
                    .foregroundStyle(palette.textSecondary)
            }
            .padding(.horizontal, PostMetrics.inset)
            .padding(.top, 12)
            .padding(.bottom, 8)
        }
        .safeAreaInset(edge: .bottom) {
            SubmitBar(title: state.error != nil ? L10n.Common.retry : L10n.Consultations.submit, busy: state.sending, enabled: !state.sending && !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) { vm.send() }
        }
        .onAppear { focus = .title }
        #if DEBUG
        // `SIMCTL_CHILD_RUTA_DEBUG_FORM=send` (+ `RUTA_DEBUG_PHOTOS=/a.jpg,/b.jpg`): fills the case, attaches the
        // files through the same JPEG pipeline as the picker, and sends it (the system picker can't be driven here).
        .task {
            let env = ProcessInfo.processInfo.environment
            guard env["RUTA_DEBUG_FORM"] == "send" else { return }
            while state.categories.isEmpty || state.municipalities.isEmpty { try? await Task.sleep(for: .milliseconds(200)) }
            title = "Basura acumulada en la calle Duarte"
            text = "Hace dos semanas que no pasa el camión de la basura y se acumula en la esquina."
            if let basura = state.categories.first(where: { $0.name == "Basura" }) { vm.selectCategory(id: basura.id) }
            if let town = state.municipalities.first(where: { $0.name == "Sabaneta" }) { vm.selectMunicipality(id: town.id) }
            for path in (env["RUTA_DEBUG_PHOTOS"] ?? "").split(separator: ",") {
                if let image = UIImage(contentsOfFile: String(path)), let jpeg = PhotoAttach.jpeg(image) { vm.addPhoto(jpeg: BytesKt.byteArrayOf(data: jpeg)) }
            }
            try? await Task.sleep(for: .milliseconds(800))
            vm.send()
        }
        #endif
        .sheet(isPresented: $picking) {
            LocationPicker(start: pinned) { vm.setLocation(latitude: $0.latitude, longitude: $0.longitude) }
        }
        .fullScreenCover(isPresented: Binding(
            get: { state.signInRequested },
            set: { if !$0 { vm.signInHandled() } }
        )) { SignInScreen() }
    }

    private var pinned: CLLocationCoordinate2D? {
        guard let lat = state.latitude?.doubleValue, let lng = state.longitude?.doubleValue else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }

    /// The topic's avatar once chosen; a neutral one before.
    private var avatar: some View {
        Group {
            if let category {
                CategoryPinBadge(icon: category.icon, hex: category.color, size: PostMetrics.avatar)
            } else {
                Circle().fill(palette.inset).frame(width: PostMetrics.avatar, height: PostMetrics.avatar)
                    .overlay { Image(systemName: "text.bubble").font(.system(size: 15)).foregroundStyle(palette.textTertiary) }
            }
        }
        .animation(.snappy, value: state.categoryId)
    }

    /// Topic, municipality and place as labelled chips: each shows what it
    /// is until something is chosen, then the choice.
    private var attachments: some View {
        VStack(alignment: .leading, spacing: 6) {
            FlowChips {
                Menu {
                    Picker(L10n.Consultations.category, selection: Binding(
                        get: { state.categoryId ?? "" }, set: { vm.selectCategory(id: $0) }
                    )) {
                        ForEach(state.categories, id: \.id) { c in
                            Label(c.name, systemImage: CategoryGlyph.symbol(c.icon)).tag(c.id)
                        }
                    }
                } label: {
                    AttachChip(
                        text: category?.name ?? L10n.Consultations.category,
                        symbol: category.map { CategoryGlyph.symbol($0.icon) } ?? "tag",
                        tint: category.map { CategoryGlyph.style($0.icon, hex: $0.color).color },
                        chosen: category != nil,
                        problem: state.problems.contains(.category)
                    )
                }

                Menu {
                    Picker(L10n.Consultations.municipality, selection: Binding(
                        get: { state.municipalityId ?? "" }, set: { vm.selectMunicipality(id: $0) }
                    )) {
                        ForEach(state.municipalities, id: \.id) { m in Text(m.name).tag(m.id) }
                    }
                } label: {
                    AttachChip(
                        text: municipality?.name ?? L10n.Consultations.municipality,
                        symbol: "building.columns",
                        tint: nil,
                        chosen: municipality != nil,
                        problem: state.problems.contains(.municipality)
                    )
                }

                Button { picking = true } label: {
                    AttachChip(
                        text: L10n.Consultations.location,
                        symbol: pinned == nil ? "mappin.and.ellipse" : "mappin.circle.fill",
                        tint: nil,
                        chosen: pinned != nil,
                        problem: false
                    )
                }
                .buttonStyle(.plain)
                .accessibilityLabel(pinned == nil ? L10n.Consultations.addLocation : L10n.Consultations.changeLocation)
            }
            problem(.category, L10n.Consultations.Errors.category)
            problem(.municipality, L10n.Consultations.Errors.municipality)
        }
    }

    @ViewBuilder private func problem(_ p: NewConsultationUiState.Problem, _ text: String) -> some View {
        if state.problems.contains(p) {
            Label(text, systemImage: "exclamationmark.circle.fill")
                .font(.footnote.weight(.medium))
                .foregroundStyle(palette.dangerInk)
        }
    }
}

/// A 44 pt chip with its label: the field's name until chosen, the choice after.
struct AttachChip: View {
    let text: String
    let symbol: String
    let tint: Color?
    let chosen: Bool
    let problem: Bool
    @Environment(\.palette) private var palette

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: symbol).font(.system(size: 14, weight: .semibold)).foregroundStyle(tint ?? (problem ? palette.dangerInk : palette.textSecondary))
            Text(text).font(.subheadline.weight(chosen ? .semibold : .regular)).lineLimit(1)
                .foregroundStyle(problem ? palette.dangerInk : palette.text)
        }
        .padding(.horizontal, 12)
        .frame(minHeight: 44)
        .background(palette.inset, in: Capsule())
        .overlay { Capsule().strokeBorder(problem ? palette.dangerInk : .clear, lineWidth: 1.5) }
        .contentShape(Capsule())
    }
}

/// Chips that wrap onto new lines.
struct FlowChips<Content: View>: View {
    @ViewBuilder let content: Content
    var body: some View {
        FlowLayout(spacing: 6) { content }
    }
}

nonisolated struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        rows(proposal.width ?? .infinity, subviews).size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        for (index, point) in rows(bounds.width, subviews).points.enumerated() {
            subviews[index].place(at: CGPoint(x: bounds.minX + point.x, y: bounds.minY + point.y), proposal: .unspecified)
        }
    }

    private func rows(_ width: CGFloat, _ subviews: Subviews) -> (points: [CGPoint], size: CGSize) {
        var points: [CGPoint] = []
        var x: CGFloat = 0, y: CGFloat = 0, lineHeight: CGFloat = 0, maxX: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width {
                x = 0
                y += lineHeight + spacing
                lineHeight = 0
            }
            points.append(CGPoint(x: x, y: y))
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
            maxX = max(maxX, x - spacing)
        }
        return (points, CGSize(width: maxX, height: y + lineHeight))
    }
}
