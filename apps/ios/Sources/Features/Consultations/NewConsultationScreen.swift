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
                    Composer(model: model)
                } else {
                    Color.clear
                }
            }
            .navigationTitle(L10n.Consultations.newTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L10n.Common.cancel) { dismiss() }
                }
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

    private enum Field { case title, body }
    private var state: NewConsultationUiState { model.state }
    private var vm: NewConsultationViewModel { model.viewModel }

    private var category: ConsultationsCategoriesItem? { state.categories.first { $0.id == state.categoryId } }
    private var municipality: MunicipalitiesListItem? { state.municipalities.first { $0.id == state.municipalityId } }

    var body: some View {
        ScrollView {
            HStack(alignment: .top, spacing: PostMetrics.gap) {
                avatar
                VStack(alignment: .leading, spacing: 6) {
                    TextField(text: $title, prompt: Text(L10n.Consultations.titleLabel).foregroundStyle(palette.textTertiary), axis: .vertical) { Text(L10n.Consultations.titleLabel) }
                        .font(PostMetrics.name)
                        .focused($focus, equals: .title)
                        .submitLabel(.next)
                        .onSubmit { focus = .body }
                        .onChange(of: title) { _, v in vm.updateTitle(value: v) }
                    problem(.title, L10n.Consultations.Errors.title)

                    TextField(text: $text, prompt: Text(L10n.Consultations.bodyLabel).foregroundStyle(palette.textTertiary), axis: .vertical) { Text(L10n.Consultations.bodyLabel) }
                        .font(PostMetrics.text)
                        .lineLimit(4...)
                        .focused($focus, equals: .body)
                        .onChange(of: text) { _, v in vm.updateBody(value: v) }
                    problem(.body, L10n.Consultations.Errors.body)

                    chips.padding(.top, 8)
                    attachments.padding(.top, 2)
                    Label(L10n.Consultations.publicNote, systemImage: "eye")
                        .font(.footnote)
                        .foregroundStyle(palette.textTertiary)
                        .padding(.top, 28)
                }
            }
            .padding(.horizontal, PostMetrics.inset)
            .padding(.top, 12)
        }
        .scrollDismissesKeyboard(.interactively)
        .safeAreaInset(edge: .bottom) { footer }
        .onAppear { focus = .title }
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

    /// Chosen attachments as removable-looking chips; tap one to change it.
    @ViewBuilder private var chips: some View {
        let any = category != nil || municipality != nil || pinned != nil
        if any {
            FlowChips {
                if let category {
                    Chip(text: category.name, symbol: CategoryGlyph.symbol(category.icon), tint: CategoryGlyph.style(category.icon, hex: category.color).color)
                }
                if let municipality {
                    Chip(text: municipality.name, symbol: "building.columns", tint: nil)
                }
                if pinned != nil {
                    Button { picking = true } label: {
                        Chip(text: L10n.Consultations.pinned, symbol: "mappin.and.ellipse", tint: nil)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    /// Icon-only attach row, like the composer's media row in Threads.
    private var attachments: some View {
        HStack(spacing: 0) {
            Menu {
                Picker(L10n.Consultations.category, selection: Binding(
                    get: { state.categoryId ?? "" }, set: { vm.selectCategory(id: $0) }
                )) {
                    ForEach(state.categories, id: \.id) { c in
                        Label(c.name, systemImage: CategoryGlyph.symbol(c.icon)).tag(c.id)
                    }
                }
            } label: {
                attachIcon("tag", problem: state.problems.contains(.category))
            }
            .accessibilityLabel(L10n.Consultations.category)

            Menu {
                Picker(L10n.Consultations.municipality, selection: Binding(
                    get: { state.municipalityId ?? "" }, set: { vm.selectMunicipality(id: $0) }
                )) {
                    ForEach(state.municipalities, id: \.id) { m in Text(m.name).tag(m.id) }
                }
            } label: {
                attachIcon("building.columns", problem: state.problems.contains(.municipality))
            }
            .accessibilityLabel(L10n.Consultations.municipality)

            Button { picking = true } label: {
                attachIcon(pinned == nil ? "mappin.and.ellipse" : "mappin.circle.fill", problem: false)
            }
            .accessibilityLabel(pinned == nil ? L10n.Consultations.addLocation : L10n.Consultations.changeLocation)
        }
        .padding(.leading, -10)
        .overlay(alignment: .bottomLeading) {
            VStack(alignment: .leading, spacing: 2) {
                problem(.category, L10n.Consultations.Errors.category)
                problem(.municipality, L10n.Consultations.Errors.municipality)
            }
            .offset(y: 26)
        }
    }

    private func attachIcon(_ symbol: String, problem: Bool) -> some View {
        Image(systemName: symbol)
            .font(.system(size: 18))
            .foregroundStyle(problem ? palette.danger : palette.textSecondary)
            .frame(width: 40, height: 40)
            .contentShape(Rectangle())
    }

    @ViewBuilder private func problem(_ p: NewConsultationUiState.Problem, _ text: String) -> some View {
        if state.problems.contains(p) {
            Label(text, systemImage: "exclamationmark.circle.fill")
                .font(.footnote.weight(.medium))
                .foregroundStyle(palette.dangerInk)
        }
    }

    private var footer: some View {
        HStack(spacing: 12) {
            BodyRing(length: Int(state.bodyLength), minimum: 40)
            Spacer(minLength: 8)
            Button {
                vm.send()
            } label: {
                ZStack {
                    Text(L10n.Consultations.submit).opacity(state.sending ? 0 : 1)
                    if state.sending { ProgressView().tint(RutaHighlight.onPrimary(palette)) }
                }
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 6)
                .frame(minHeight: 36)
            }
            .buttonStyle(RutaProminentStyle())
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }
}

/// Fills toward the description's minimum; a check once it's enough.
private struct BodyRing: View {
    let length: Int
    let minimum: Int
    @Environment(\.palette) private var palette

    var body: some View {
        let progress = min(Double(length) / Double(minimum), 1)
        ZStack {
            Circle().stroke(palette.hairline, lineWidth: 2.5)
            Circle()
                .trim(from: 0, to: progress)
                .stroke(progress >= 1 ? palette.success : palette.text, style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
                .rotationEffect(.degrees(-90))
            if progress >= 1 {
                Image(systemName: "checkmark").font(.system(size: 9, weight: .bold)).foregroundStyle(palette.success)
            }
        }
        .frame(width: 22, height: 22)
        .animation(.snappy, value: progress)
        .accessibilityElement()
        .accessibilityLabel(L10n.Consultations.bodyHelper(count: String(length)))
    }
}

struct Chip: View {
    let text: String
    let symbol: String
    let tint: Color?
    @Environment(\.palette) private var palette

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: symbol).font(.system(size: 11, weight: .semibold)).foregroundStyle(tint ?? palette.textSecondary)
            Text(text).font(.footnote.weight(.semibold))
        }
        .padding(.horizontal, 10)
        .frame(height: 28)
        .background(palette.inset, in: Capsule())
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
