import MapKit
import RutaKit
import SwiftUI

/// What was picked on the map, as one sheet over it: a place, an eco route or a road report.
struct SelectionSheet: View {
    let model: Screen<MapViewModel, MapUiState>
    let close: () -> Void
    let directions: (Destination) -> Void
    @State private var detent: PresentationDetent = .height(360)
    /// The resting height follows what the panel holds, so a short place leaves no empty paper.
    @State private var fit: CGFloat = 360
    private var rest: PresentationDetent { .height(fit) }

    private func rest(at height: CGFloat) {
        let next = min(max(height, 180), 400)
        guard abs(next - fit) > 1 else { return }
        let resting = detent != .large
        fit = next
        if resting { detent = .height(next) }
    }

    var body: some View {
        Group {
            switch onEnum(of: model.state.selection) {
            case .none: Color.clear
            case .place(let place): PlacePanel(sheet: place.sheet, vm: model.vm, close: close, directions: directions, fit: rest(at:))
            case .route(let route): RoutePanel(route: route.route, close: close, directions: directions)
            case .traffic:
                if let notice = model.state.selectedTraffic { TrafficPanel(notice: notice, vm: model.vm, close: close) }
            }
        }
        .paperBackground()
        .presentationDetents([rest, .large], selection: $detent)
        .presentationBackgroundInteraction(.enabled(upThrough: rest))
        .presentationCornerRadius(Metrics.radiusPanel)
        .presentationDragIndicator(.visible)
    }
}

/// A sheet's heading: a disc in the thing's own colour, its name, one line of context, and a way out.
private struct PanelHeader: View {
    let tint: Color
    let symbol: String
    let title: String
    let subtitle: String
    /// Set when the place is verified: the badge sits beside the name, read out with this text.
    var verified: String?
    let close: () -> Void

    private var heading: Text {
        guard verified != nil else { return Text(title) }
        return Text(title) + Text(" ") + Text(Image(systemName: "checkmark.seal.fill")).font(.system(size: 17)).foregroundStyle(Color.iris)
    }

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: symbol).font(.system(size: 19, weight: .medium)).foregroundStyle(.white)
                .frame(width: 46, height: 46).background(tint, in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                heading.type(.title).fixedSize(horizontal: false, vertical: true)
                    .accessibilityLabel(verified.map { "\(title), \($0)" } ?? title)
                Text(subtitle).type(.callout, .ink3)
            }
            Spacer(minLength: 8)
            IconButton(symbol: "xmark", label: L10n.Common.close, action: close)
        }
    }
}

// MARK: - Place

private struct PlacePanel: View {
    let sheet: PlaceSheet
    let vm: MapViewModel
    let close: () -> Void
    let directions: (Destination) -> Void
    var fit: (CGFloat) -> Void = { _ in }
    @Environment(\.openURL) private var openURL

    private var place: MapPlace { sheet.place }
    private var contact: Contact? {
        switch onEnum(of: sheet.business) {
        case .listed(let listed): listed.contact
        case .owned(let owned): owned.contact
        case .notABusiness, .claimPending: nil
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                PanelHeader(tint: place.tint, symbol: Glyph.symbol(place.icon, filled: true), title: place.name,
                            subtitle: [place.categoryName, sheet.detail?.municipality.name].compactMap { $0 }.joined(separator: " · "),
                            verified: sheet.detail.flatMap { $0.trust.state == .established && !sheet.cached ? L10n.Place.Trust.established : nil }, close: close)

                HStack(spacing: 10) {
                    Button { directions(Destination(name: place.name, coordinate: place.coordinate)) } label: {
                        Label(L10n.Place.directions, systemImage: "arrow.triangle.turn.up.right.diamond")
                    }
                    .buttonStyle(.ink)
                    IconButton(symbol: sheet.saved ? "bookmark.fill" : "bookmark", label: sheet.saved ? L10n.Place.savedLabel : L10n.Place.save) { vm.toggleSaved() }
                        .symbolEffect(.bounce, value: sheet.saved)
                        .sensoryFeedback(.impact(weight: .light), trigger: sheet.saved)
                    ShareLink(item: URL(string: "https://rutacibao.do/lugares/\(place.slug)")!, subject: Text(place.name)) {
                        Image(systemName: "square.and.arrow.up").font(.system(size: 17)).foregroundStyle(Color.ink)
                            .frame(width: 44, height: 44).background(Color.paper2, in: Circle())
                    }
                    .accessibilityLabel(L10n.Common.share)
                }

                if let url = sheet.detail?.imageUrl ?? place.thumbnailUrl {
                    RemoteImage(url: url).frame(height: 190).clipShape(RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
                }

                if sheet.loading && sheet.detail == nil {
                    LoadingDots().frame(height: 60)
                } else if let detail = sheet.detail {
                    if !sheet.cached, detail.trust.state != .established { trust(detail.trust.state) }
                    if let text = detail.description_, !text.isEmpty { Text(text).type(.body, .ink2).lineSpacing(3) }

                    if detail.address != nil || contact != nil {
                        VStack(alignment: .leading, spacing: 12) {
                            if let address = detail.address { info("mappin.and.ellipse", address) }
                            if let hours = contact?.hours { info("clock", hours) }
                        }
                        let phone = contact?.phoneLink.flatMap(URL.init(string:)), whatsapp = contact?.whatsappLink.flatMap(URL.init(string:))
                        if phone != nil || whatsapp != nil {
                            HStack(spacing: 8) {
                                if let phone {
                                    Button { openURL(phone) } label: { Label(L10n.Place.call, systemImage: "phone") }.buttonStyle(.pill(.quiet, compact: true))
                                }
                                if let whatsapp {
                                    Button { openURL(whatsapp) } label: { Label(L10n.Place.whatsapp, systemImage: "message") }.buttonStyle(.pill(.quiet, compact: true))
                                }
                            }
                        }
                    }

                    if let report = sheet.report {
                        ReportPlace(report: report, vm: vm)
                    } else if !detail.isMine {
                        // Feedback is secondary: one quiet line under a hairline, not a block of its own.
                        Hairline()
                        HStack(spacing: 4) {
                            Text(L10n.Place.stillThere).type(.callout, .ink3)
                            Spacer(minLength: 8)
                            verdict(.exists, L10n.Place.exists, "checkmark", chosen: detail.myVerdict == .exists)
                            verdict(.gone, L10n.Place.gone, "xmark", chosen: detail.myVerdict == .gone)
                            Button { vm.openPlaceReport() } label: {
                                Image(systemName: "flag").font(.system(size: 15)).foregroundStyle(Color.ink2).frame(width: 40, height: 44).contentShape(Rectangle())
                            }
                            .accessibilityLabel(L10n.Place.report)
                        }
                        if sheet.feedbackError != nil { Text(L10n.Common.errorTitle).type(.caption, .danger) }
                    }
                } else if sheet.error != nil {
                    StateView(error: sheet.error ?? .unknown) { vm.select(placeId: place.id) }.frame(height: 200)
                }
            }
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { fit($0 + 24) }
            .padding(.horizontal, Metrics.gutter)
            .padding(.top, 22)
            .padding(.bottom, 12)
            .readable()
        }
        .accessibilityLabel(L10n.Map.sheetLabel)
    }

    private func info(_ symbol: String, _ text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Image(systemName: symbol).font(.system(size: 14)).foregroundStyle(Color.ink3).frame(width: 20)
            Text(text).type(.callout, .ink2).fixedSize(horizontal: false, vertical: true)
        }
    }

    private func trust(_ state: PlacesDetailOutput.TrustState) -> some View {
        let (symbol, text, color): (String, String, Color) = switch state {
        case .confirmed: ("checkmark.circle", L10n.Place.Trust.confirmed, .ink2)
        case .doubted: ("questionmark.circle", L10n.Place.Trust.doubted, .warning)
        default: ("sparkles", L10n.Place.Trust.new, .ink3)
        }
        return Label(text, systemImage: symbol).type(.callout, color)
    }

    /// A glyph in a small disc; the chosen one fills with the success tone and keeps its glyph.
    private func verdict(_ value: PlacesConfirmInput.Verdict, _ title: String, _ symbol: String, chosen: Bool) -> some View {
        Button { vm.confirmPlace(verdict: value) } label: {
            Image(systemName: symbol).font(.system(size: 14, weight: .semibold))
                .foregroundStyle(chosen ? Color.onInk : Color.ink)
                .frame(width: 36, height: 36)
                .background(chosen ? Color.action : Color.paper2, in: Circle())
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(Pressable())
        .accessibilityLabel(title)
        .accessibilityAddTraits(chosen ? .isSelected : [])
        .disabled(sheet.confirming)
        .sensoryFeedback(.success, trigger: chosen) { _, now in now }
    }
}

/// Telling the ayuntamiento what is wrong with a place: a reason, and details when it needs them.
private struct ReportPlace: View {
    let report: PlaceReportState
    let vm: MapViewModel
    @State private var details = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if report.sent {
                Notice(symbol: "checkmark.circle", title: report.queued ? L10n.Offline.queuedToast : L10n.Place.reportSent, message: report.queued ? L10n.Offline.queuedToastBody : L10n.Place.reportSentBody)
            } else {
                HStack {
                    Text(L10n.Place.reportTitle).type(.label)
                    Spacer()
                    IconButton(symbol: "xmark", label: L10n.Common.cancel) { vm.closePlaceReport() }
                }
                ChoiceFlow(items: PlacesReportInput.Reason.allCases, selected: report.reason, title: { $0.label }) { vm.updatePlaceReportReason(reason: $0) }
                Field(placeholder: L10n.Place.reportDetails, text: $details, lines: 2...5)
                    .onChange(of: details) { _, value in vm.updatePlaceReportDetails(value: value) }
                if report.invalidDetails { Text(L10n.Place.reportDetailsRequired).type(.caption, .danger) }
                if report.error != nil { Text(L10n.Common.errorTitle).type(.caption, .danger) }
                Button { vm.submitPlaceReport() } label: {
                    HStack(spacing: 10) { if report.submitting { ProgressView().tint(.onInk) }; Text(L10n.Common.send) }
                }
                .buttonStyle(.ink)
                .disabled(report.submitting)
            }
        }
        .padding(16)
        .background(Color.paper2, in: RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
    }
}

extension PlacesReportInput.Reason {
    var label: String {
        switch self {
        case .incorrectInformation: L10n.Place.Reasons.incorrect_information
        case .closed: L10n.Place.Reasons.closed
        case .duplicate: L10n.Place.Reasons.duplicate
        case .wrongLocation: L10n.Place.Reasons.wrong_location
        case .other: L10n.Place.Reasons.other
        }
    }
}

// MARK: - Eco route

private struct RoutePanel: View {
    let route: EcoRoute
    let close: () -> Void
    let directions: (Destination) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                PanelHeader(tint: .success, symbol: "figure.hiking", title: route.name, subtitle: "\(route.categoryName) · \(route.municipalityName)", close: close)

                HStack(spacing: 0) {
                    fact(L10n.Routes.distance, Measurement(value: route.distanceMeters / 1000, unit: UnitLength.kilometers).formatted(.measurement(width: .abbreviated, usage: .asProvided, numberFormatStyle: .number.precision(.fractionLength(1)))))
                    Rectangle().fill(Color.line).frame(width: 1, height: 34)
                    fact(L10n.Routes.duration, duration)
                    Rectangle().fill(Color.line).frame(width: 1, height: 34)
                    fact(L10n.Routes.difficulty, difficulty)
                }
                .padding(.vertical, 14)
                .background(Color.paper2, in: RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))

                if let start = route.start {
                    Button { directions(Destination(name: route.name, coordinate: start)) } label: {
                        Label(L10n.Routes.toStart, systemImage: "arrow.triangle.turn.up.right.diamond")
                    }
                    .buttonStyle(.ink)
                }
                Text(route.description_).type(.body, .ink2).lineSpacing(3)
                Notice(symbol: "exclamationmark.shield", title: L10n.Routes.safetyTitle, message: L10n.Routes.safetyBody)
            }
            .padding(.horizontal, Metrics.gutter)
            .padding(.top, 22)
            .padding(.bottom, 28)
            .readable()
        }
    }

    private var duration: String {
        let f = DateComponentsFormatter()
        f.unitsStyle = .abbreviated
        f.allowedUnits = [.hour, .minute]
        return f.string(from: route.durationMinutes * 60) ?? ""
    }

    private var difficulty: String {
        switch route.difficulty {
        case .easy: L10n.Explore.Difficulty.easy
        case .moderate: L10n.Explore.Difficulty.moderate
        case .hard: L10n.Explore.Difficulty.hard
        }
    }

    private func fact(_ label: String, _ value: String) -> some View {
        VStack(spacing: 3) {
            Text(value).type(.heading)
            Text(label).type(.caption, .ink3)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Road report

private struct TrafficPanel: View {
    let notice: TrafficNotice
    let vm: MapViewModel
    let close: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                PanelHeader(tint: notice.tint, symbol: Glyph.symbol(notice.icon, filled: true), title: notice.categoryName,
                            subtitle: "\(notice.municipality) · \(CompactTime.since(notice.createdAt.date))", close: close)
                if let details = notice.details, !details.isEmpty { Text(details).type(.body, .ink2) }

                HStack(spacing: 0) {
                    count(Int(notice.stillCount), L10n.Traffic.stillShort, "checkmark")
                    Rectangle().fill(Color.line).frame(width: 1, height: 34)
                    count(Int(notice.clearedCount), L10n.Traffic.goneShort, "xmark")
                }
                .padding(.vertical, 14)
                .background(Color.paper2, in: RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))

                if notice.canConfirm {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(L10n.Traffic.ask).type(.label)
                        HStack(spacing: 8) {
                            answer(.still, L10n.Traffic.still)
                            answer(.cleared, L10n.Traffic.gone)
                        }
                    }
                } else if let mine = notice.myVerdict {
                    Notice(symbol: "checkmark.circle", title: mine == .still ? L10n.Traffic.thanksStill : L10n.Traffic.thanksCleared)
                }
            }
            .padding(.horizontal, Metrics.gutter)
            .padding(.top, 22)
            .padding(.bottom, 28)
            .readable()
            .animation(Motion.settle, value: notice.myVerdict)
        }
        .accessibilityLabel(L10n.Traffic.sheetLabel(category: notice.categoryName))
        .sensoryFeedback(.success, trigger: notice.myVerdict)
    }

    private func count(_ value: Int, _ label: String, _ symbol: String) -> some View {
        VStack(spacing: 3) {
            Text("\(value)").type(.title).contentTransition(.numericText())
            Label(label, systemImage: symbol).type(.caption, .ink3).lineLimit(1)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(symbol == "checkmark" ? L10n.Traffic.stillVoices(count: value) : L10n.Traffic.clearedVoices(count: value))
    }

    private func answer(_ verdict: TrafficVerdict, _ title: String) -> some View {
        Button(title) { vm.confirmTraffic(verdict: verdict) }.buttonStyle(.pill(notice.myVerdict == verdict ? .ink : .quiet, compact: true))
    }
}

// MARK: - Search

/// Search across places and eco routes: type, see, tap.
struct MapSearch: View {
    let places: [MapPlace]
    let routes: [EcoRoute]
    var municipalities: [String: String] = [:]
    var categories: [MapCategory] = []
    var pickCategory: (MapCategory) -> Void = { _ in }
    let pickPlace: (MapPlace) -> Void
    let pickRoute: (EcoRoute) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @FocusState private var focused: Bool

    private var foundRoutes: [EcoRoute] {
        query.isEmpty ? routes : routes.filter { "\($0.name) \($0.municipalityName)".localizedStandardContains(query) }
    }
    private var foundPlaces: [MapPlace] {
        let sorted = places.sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
        return query.isEmpty ? sorted : sorted.filter { "\($0.name) \($0.categoryName) \(municipalities[$0.municipalityId] ?? "")".localizedStandardContains(query) }
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Field(placeholder: L10n.Search.placeholder, text: $query, symbol: "magnifyingglass")
                    .focused($focused)
                    .submitLabel(.search)
                    .autocorrectionDisabled()
                IconButton(symbol: "xmark", label: L10n.Common.close) { dismiss() }
            }
            .padding(.horizontal, 16)
            .padding(.top, 18)
            .padding(.bottom, 8)

            if query.isEmpty, !categories.isEmpty {
                // Before typing: every category as a tile, the way the system's browse screens open.
                ScrollView {
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                        ForEach(categories, id: \.id) { category in
                            Button { pickCategory(category) } label: { CategoryTile(category: category) }.buttonStyle(Pressable(scale: 0.97))
                        }
                    }
                    .padding(.horizontal, Metrics.gutter)
                    .padding(.top, 8)
                    .padding(.bottom, 24)
                    .readable()
                }
                .scrollDismissesKeyboard(.immediately)
            } else if foundRoutes.isEmpty && foundPlaces.isEmpty {
                StateView(symbol: "magnifyingglass", title: L10n.Search.emptyTitle, message: L10n.Search.emptyBody)
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        if !foundRoutes.isEmpty {
                            FormLabel(text: L10n.Map.routes).padding(.horizontal, Metrics.gutter)
                            ForEach(foundRoutes, id: \.id) { route in
                                row(symbol: "figure.hiking", tint: .mint, title: route.name, detail: "\(route.categoryName) · \(route.municipalityName)") { pickRoute(route) }
                            }
                        }
                        if !foundPlaces.isEmpty {
                            FormLabel(text: L10n.Search.places).padding(.horizontal, Metrics.gutter).padding(.top, 8)
                            ForEach(foundPlaces, id: \.id) { place in
                                row(symbol: Glyph.symbol(place.icon), tint: .of(hex: place.color), title: place.name, detail: [place.categoryName, municipalities[place.municipalityId]].compactMap { $0 }.joined(separator: " · ")) { pickPlace(place) }
                            }
                        }
                    }
                    .readable()
                }
                .scrollDismissesKeyboard(.immediately)
            }
        }
        .paperBackground()
        .presentationCornerRadius(Metrics.radiusPanel)
        .onAppear { focused = true }
    }

    private func row(symbol: String, tint: Tint = .neutral, title: String, detail: String, action: @escaping () -> Void) -> some View {
        VStack(spacing: 0) {
            Button(action: action) {
                HStack(spacing: 14) {
                    GlyphDisc(symbol: symbol, tint: tint)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(title).type(.bodyStrong).lineLimit(1)
                        Text(detail).type(.callout, .ink3)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, Metrics.gutter)
                .padding(.vertical, 10)
            }
            .buttonStyle(RowPress())
            Hairline(inset: Metrics.gutter + 54)
        }
    }
}

/// A category as a coloured tile: its name at the bottom, its glyph large and faint in the corner.
private struct CategoryTile: View {
    let category: MapCategory

    var body: some View {
        let color = Tint.of(hex: category.color).solid
        ZStack(alignment: .bottomLeading) {
            LinearGradient(colors: [color, color.mix(with: .black, by: 0.16)], startPoint: .top, endPoint: .bottom)
            Image(systemName: Glyph.symbol(category.icon, filled: true))
                .font(.system(size: 54, weight: .regular))
                .foregroundStyle(.white.opacity(0.28))
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                .padding(12)
            VStack(alignment: .leading, spacing: 1) {
                Text(category.name).font(.system(size: 17, weight: .semibold)).tracking(-0.2).lineLimit(2).multilineTextAlignment(.leading)
                Text("\(category.count)").font(.system(size: 13, weight: .medium)).opacity(0.8)
            }
            .foregroundStyle(.white)
            .padding(12)
        }
        .frame(height: 104)
        .clipShape(RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}
