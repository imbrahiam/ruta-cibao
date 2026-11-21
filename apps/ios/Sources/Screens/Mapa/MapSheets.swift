import MapKit
import RutaKit
import SwiftUI

/// What was picked on the map, as one sheet over it: a place, an eco route or a road report.
struct SelectionSheet: View {
    let model: Screen<MapViewModel, MapUiState>
    let close: () -> Void
    let directions: (Destination) -> Void
    /// Walk an eco route stop by stop.
    var startTrail: (EcoRoute, [TrailStop]) -> Void = { _, _ in }
    @State private var detent: PresentationDetent

    init(model: Screen<MapViewModel, MapUiState>, close: @escaping () -> Void, directions: @escaping (Destination) -> Void, startTrail: @escaping (EcoRoute, [TrailStop]) -> Void) {
        self.model = model
        self.close = close
        self.directions = directions
        self.startTrail = startTrail
        _detent = State(initialValue: Self.resting(for: model.state))
    }

    /// The resting height, settled before the sheet appears: a presented sheet ignores later
    /// height changes, so it can't follow content that loads in. For a place it holds the
    /// header, the way there, the street, the picture and the check row, with air below.
    private static func resting(for state: MapUiState) -> PresentationDetent {
        switch onEnum(of: state.selection) {
        case .place(let place):
            // A name past about twenty letters wraps to a second line at title size.
            .height(place.sheet.place.name.count > 20 ? 424 : 392)
        // A road notice: its title, its text and the two answers, sized to what it holds so
        // no empty paper hangs under the buttons. Longer text is a drag away.
        case .traffic: .height(state.selectedTraffic.map(trafficHeight) ?? 240)
        default: .height(360)
        }
    }

    private var rest: PresentationDetent { Self.resting(for: model.state) }

    /// Heading and paddings, then about 40 characters per body line (capped at four), then the
    /// answers or, once answered, the tally and the thanks.
    private static func trafficHeight(_ notice: TrafficNotice) -> CGFloat {
        var height: CGFloat = 22 + 52 + 16
        if let details = notice.details, !details.isEmpty {
            height += 14 + CGFloat(min((details.count + 39) / 40, 4)) * 22
        }
        if notice.canConfirm {
            height += 14 + 40
        } else {
            if notice.stillCount > 0 || notice.clearedCount > 0 { height += 14 + 20 }
            if notice.myVerdict != nil { height += 14 + 56 }
        }
        return height
    }

    var body: some View {
        Group {
            switch onEnum(of: model.state.selection) {
            case .none: Color.clear
            case .place(let place): PlacePanel(sheet: place.sheet, vm: model.vm, close: close, directions: directions)
            case .route(let route):
                RoutePanel(route: route.route, stops: TrailStops.of(route.route, places: model.state.all), close: close, directions: directions,
                           startTrail: startTrail, openPlace: { model.vm.select(placeId: $0) })
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
    /// A road notice leads with its report icon, as drawn on the map.
    var sign: TrafficSignKind?
    let close: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Group {
                if let sign {
                    TrafficBadge(kind: sign, size: 44)
                } else {
                    Image(systemName: symbol)
                        .font(.system(size: 19, weight: .medium))
                        .foregroundStyle(Color.onInk)
                        .frame(width: 40, height: 40)
                        .background(tint.markerTint, in: Circle())
                        .accessibilityHidden(true)
                }
            }
                // Verified is a seal stuck on the disc's corner, like a stamp on a postcard.
                .overlay(alignment: .bottomTrailing) {
                    if verified != nil {
                        Image(systemName: "checkmark.seal.fill")
                            .font(.system(size: 16))
                            .foregroundStyle(Color.onInk, Color.brand)
                            .symbolRenderingMode(.palette)
                            .background(Circle().fill(Color.paper).padding(-2))
                            .offset(x: 5, y: 5)
                            .accessibilityHidden(true)
                    }
                }
            VStack(alignment: .leading, spacing: 2) {
                Text(title).type(.title).fixedSize(horizontal: false, vertical: true)
                    .accessibilityLabel(verified.map { "\(title), \($0)" } ?? title)
                Text(subtitle).type(.callout, .ink3)
            }
            Spacer(minLength: 8)
            // A smaller disc gives the name the width; the target is still 44 points.
            IconButton(symbol: "xmark", label: L10n.Common.close, glass: true, compact: true, action: close)
                .padding(.trailing, -6)
                .padding(.top, -4)
        }
    }
}

// MARK: - Place

private struct PlacePanel: View {
    let sheet: PlaceSheet
    let vm: MapViewModel
    let close: () -> Void
    let directions: (Destination) -> Void
    @Environment(\.openURL) private var openURL
    @State private var verifying = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

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
                // The resting sheet holds this block (see `SelectionSheet.resting`): who it is,
                // how to get there, its street, its picture and the check row.
                VStack(alignment: .leading, spacing: 16) {
                PanelHeader(tint: place.tint, symbol: Glyph.symbol(place.icon, filled: true), title: place.name,
                            subtitle: [place.categoryName, sheet.detail?.municipality.name].compactMap { $0 }.joined(separator: " · "),
                            verified: sheet.detail.flatMap { $0.trust.state == .established ? L10n.Place.Trust.established : nil }, close: close)

                HStack(spacing: 10) {
                    Button { directions(Destination(name: place.name, coordinate: place.coordinate)) } label: {
                        Label(L10n.Place.directions, systemImage: "arrow.triangle.turn.up.right.diamond")
                    }
                    // The same colour as the place's disc above it: one thing, not two.
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

                // Where it is comes before what it looks like: the street is what you read
                // to find it, so it sits with the way there, in the first glance.
                if let address = sheet.detail?.address {
                    info(Glyph.location, fullAddress(address, in: sheet.detail?.municipality.name ?? ""))
                } else if sheet.loading && sheet.detail == nil {
                    Skeleton { SkeletonLine(166, lineHeight: 18, barHeight: 11, relativeTo: .callout) }
                }

                PlaceMedia(sheet: sheet)

                // Checking the place sits right under its picture, as one closed row that
                // ends the resting sheet; the answers open in place.
                if let detail = sheet.detail, !detail.isMine, sheet.report == nil {
                    verification(detail)
                } else if sheet.loading && sheet.detail == nil {
                    Skeleton {
                        HStack(spacing: 10) {
                            Circle().frame(width: 36, height: 36)
                            VStack(alignment: .leading, spacing: 6) {
                                SkeletonLine(140)
                                SkeletonLine(105, lineHeight: 18, barHeight: 10, relativeTo: .callout)
                            }
                            Spacer()
                        }
                        .padding(.horizontal, 14)
                        .frame(height: 62)
                        .background(Color.paper2, in: RoundedRectangle(cornerRadius: Metrics.radiusCard))
                    }
                }
                }

                if let detail = sheet.detail {
                    if !sheet.cached, detail.isMine, detail.trust.state != .established { trust(detail.trust.state) }
                    if let text = detail.description_, !text.isEmpty { Text(text).type(.body, .ink2).lineSpacing(3) }

                    if contact != nil {
                        if let hours = contact?.hours { info("clock", hours) }
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
                        if sheet.feedbackError != nil { Text(L10n.Common.errorTitle).type(.caption, .danger) }
                    }
                } else if !sheet.loading, sheet.error != nil {
                    StateView(error: sheet.error ?? .unknown) { vm.select(placeId: place.id) }.frame(height: 200)
                }
            }
            .padding(.horizontal, Metrics.gutter)
            .padding(.top, 22)
            // Room under the last row, so nothing sits on the screen's curve.
            .padding(.bottom, 28)
            .readable()
        }
        .accessibilityLabel(L10n.Map.sheetLabel)
    }

    private func info(_ symbol: String, _ text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Image(systemName: symbol).font(.system(size: 14)).foregroundStyle(Color.ink2).frame(width: 20)
            Text(text).type(.callout).fixedSize(horizontal: false, vertical: true).textSelection(.enabled)
        }
    }

    @ViewBuilder private func trust(_ state: PlacesDetailOutput.TrustState) -> some View {
        switch state {
        case .confirmed:
            Label(L10n.Place.Trust.confirmed, systemImage: "checkmark.circle").type(.callout, .ink2)
        case .doubted:
            Label(L10n.Place.Trust.doubted, systemImage: "questionmark.circle").type(.callout, .warning)
        default:
            EmptyView()
        }
    }

    /// A white card with a hairline: the row that opens it, then the question with its two
    /// answers, and reporting as a row of its own under a rule.
    private func verification(_ detail: PlacesDetailOutput) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Button { withAnimation(reduceMotion ? nil : Motion.quick) { verifying.toggle() } } label: {
                HStack(spacing: 10) {
                    CategoryArtwork(model: .placeCheck, symbol: "mappin", size: 23)
                        .frame(width: 36, height: 36)
                        .background(Color.brandSoft, in: Circle())
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(L10n.Place.stillThere).type(.bodyStrong)
                        if detail.trust.confirmations > 0 {
                            Text(L10n.Place.confirmationCount(count: Int(detail.trust.confirmations))).type(.callout, .ink2)
                        } else if detail.trust.state != .established {
                            trust(detail.trust.state)
                        }
                        if let given = verdictLabel(detail.myVerdict) {
                            Label(given, systemImage: "checkmark").type(.caption, .brandDeep)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .multilineTextAlignment(.leading)
                    if sheet.confirming { ProgressView() } else {
                        Image(systemName: "chevron.down").font(.system(size: 12, weight: .semibold)).foregroundStyle(Color.ink3)
                            .rotationEffect(.degrees(verifying ? 180 : 0))
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .frame(minHeight: 62)
                .contentShape(Rectangle())
            }
            .buttonStyle(Pressable(scale: 1))
            .accessibilityAddTraits(verifying ? .isSelected : [])

            if verifying {
                VStack(alignment: .leading, spacing: 10) {
                    // Side by side while they fit; stacked at large text sizes.
                    ViewThatFits(in: .horizontal) {
                        HStack(spacing: 8) { answers(detail) }
                        VStack(spacing: 8) { answers(detail) }
                    }
                }
                .padding(.horizontal, 14)
                .padding(.bottom, 14)
                .transition(.opacity)

                Hairline()
                Button { vm.openPlaceReport() } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "flag").font(.system(size: 14)).foregroundStyle(Color.ink2).frame(width: 20)
                        Text(L10n.Place.report).type(.callout)
                        Spacer(minLength: 8)
                        Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(Color.ink4)
                    }
                    .padding(.horizontal, 14)
                    .frame(minHeight: 48)
                    .contentShape(Rectangle())
                }
                .buttonStyle(RowPress())
                .transition(.opacity)
            }
        }
        // A grey block like the sheet's other surfaces, not an outlined card.
        .background(Color.paper2, in: RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
        .clipShape(RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
        .disabled(sheet.confirming)
    }

    @ViewBuilder private func answers(_ detail: PlacesDetailOutput) -> some View {
        verdict(.exists, L10n.Place.exists, chosen: detail.myVerdict == .exists)
        verdict(.gone, L10n.Place.gone, chosen: detail.myVerdict == .gone)
    }

    /// An answer as a pill with its word, both alike (an "x" would read as closing); the one
    /// given gains a check and a ring, so the choice never rests on colour alone.
    private func verdict(_ value: PlacesConfirmInput.Verdict, _ title: String, chosen: Bool) -> some View {
        Button { vm.confirmPlace(verdict: value) } label: {
            if chosen { Label(title, systemImage: "checkmark") } else { Text(title) }
        }
            .buttonStyle(.pill(chosen ? .tonal : .outline))
            .overlay { if chosen { Capsule().strokeBorder(Color.brand, lineWidth: 1.5) } }
            .accessibilityAddTraits(chosen ? .isSelected : [])
    }

    private func verdictLabel(_ verdict: PlacesDetailOutput.MyVerdict?) -> String? {
        switch verdict {
        case .exists: L10n.Place.exists
        case .gone: L10n.Place.gone
        default: nil
        }
    }

    /// The street with its town, unless the address already names it.
    private func fullAddress(_ address: String, in town: String) -> String {
        town.isEmpty || address.localizedCaseInsensitiveContains(town) ? address : "\(address), \(town)"
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
                    IconButton(symbol: "xmark", label: L10n.Common.cancel, glass: true) { vm.closePlaceReport() }
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
    let stops: [TrailStop]
    let close: () -> Void
    let directions: (Destination) -> Void
    let startTrail: (EcoRoute, [TrailStop]) -> Void
    let openPlace: (String) -> Void
    @State private var showingAll = false

    /// The sheet shows the first stops; the route's own page has every one.
    private var preview: [TrailStop] { stops.count <= 5 ? stops : Array(stops.prefix(3)) + [stops[stops.count - 1]] }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                PanelHeader(tint: PinTone.trail.color, symbol: "figure.hiking", title: route.name, subtitle: "\(route.categoryName) · \(route.municipalityName)", close: close)

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
                // At the trailhead, the walk itself: stop by stop, without leaving the app.
                Button { startTrail(route, stops) } label: { Label(L10n.Routes.startTrail, systemImage: "figure.hiking") }
                    .buttonStyle(.pill(.outline))

                if !route.services.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(L10n.Routes.services).type(.label)
                        ScrollView(.horizontal) {
                            HStack(spacing: 8) {
                                ForEach(route.services.map(\.name), id: \.self) { service in
                                    VStack(spacing: 5) {
                                        RouteServiceModel(service: service)
                                            .frame(width: 64, height: 54)
                                            .accessibilityHidden(true)
                                        Text(RouteService.label(service)).type(.caption).multilineTextAlignment(.center)
                                    }
                                    .padding(8)
                                    .frame(minWidth: 82)
                                    .background(Color.paper2, in: RoundedRectangle(cornerRadius: 16))
                                }
                            }
                        }
                        .scrollIndicators(.hidden)
                        .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
                    }
                }

                if !stops.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text(L10n.Routes.stops).type(.heading)
                            Spacer()
                            if stops.count > 2 { Text(L10n.Routes.stopsCount(count: stops.count - 2)).type(.callout, .ink3) }
                        }
                        StopTimeline(stops: preview, open: { if let id = $0.placeId { openPlace(id) } })
                        // The whole trail on its own page, every stop in order.
                        Button(L10n.Routes.seeRoute) { showingAll = true }.buttonStyle(.pill(.quiet, compact: true))
                    }
                }

                Text(route.description_).type(.body, .ink2).lineSpacing(3)
                Notice(symbol: "exclamationmark.shield", title: L10n.Routes.safetyTitle, message: L10n.Routes.safetyBody)
            }
            .padding(.horizontal, Metrics.gutter)
            .padding(.top, 22)
            .padding(.bottom, 28)
            .readable()
        }
        .sheet(isPresented: $showingAll) {
            RoutePage(route: route, stops: stops, startTrail: { startTrail(route, stops) }, openPlace: openPlace)
        }
    }

    private var durationLabel: String { duration }

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

    /// A blocked road is answered in its own words ("Sigue bloqueada");
    /// a pothole, a flood or slow traffic share "Sigue ahí".
    private var blocking: Bool { notice.severity == .blocking }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                PanelHeader(tint: notice.tint, symbol: Glyph.symbol(notice.icon, filled: true), title: notice.categoryName,
                            subtitle: "\(notice.municipality) · \(CompactTime.since(notice.createdAt.date))",
                            sign: TrafficSignKind.of(category: notice.categoryName, icon: notice.icon), close: close)
                if let details = notice.details, !details.isEmpty { Text(details).type(.body, .ink2) }

                // The answers carry their own tallies, so the sheet never says "bloqueada" three
                // times; a side nobody has taken shows no number rather than a zero.
                if notice.canConfirm {
                    HStack(spacing: 8) {
                        answer(.still, blocking ? L10n.Traffic.stillBlocked : L10n.Traffic.still, count: notice.stillCount)
                        answer(.cleared, blocking ? L10n.Traffic.goneBlocked : L10n.Traffic.gone, count: notice.clearedCount)
                    }
                } else {
                    if !tally.isEmpty {
                        Text(tally).type(.callout, .ink3).contentTransition(.numericText())
                    }
                    if let mine = notice.myVerdict {
                        Notice(symbol: "checkmark.circle", title: mine == .still ? L10n.Traffic.thanksStill : L10n.Traffic.thanksCleared)
                    }
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

    /// "2 personas lo confirman · 1 dice que ya se puede pasar", or empty when nobody answered.
    private var tally: String {
        var parts: [String] = []
        if notice.stillCount > 0 { parts.append(voices(.still)) }
        if notice.clearedCount > 0 { parts.append(voices(.cleared)) }
        return parts.joined(separator: " · ")
    }

    private func voices(_ verdict: TrafficVerdict) -> String {
        switch verdict {
        case .still: blocking ? L10n.Traffic.stillBlockedVoices(count: Int(notice.stillCount)) : L10n.Traffic.stillVoices(count: Int(notice.stillCount))
        default: blocking ? L10n.Traffic.goneBlockedVoices(count: Int(notice.clearedCount)) : L10n.Traffic.clearedVoices(count: Int(notice.clearedCount))
        }
    }

    private func answer(_ verdict: TrafficVerdict, _ title: String, count: Int32) -> some View {
        let chosen = notice.myVerdict == verdict
        return Button { vm.confirmTraffic(verdict: verdict) } label: {
            HStack(spacing: 6) {
                Text(title)
                if count > 0 {
                    Text(count, format: .number)
                        .monospacedDigit()
                        .foregroundStyle(chosen ? Color.onInk.opacity(0.75) : Color.ink3)
                        .contentTransition(.numericText())
                }
            }
        }
        .buttonStyle(.pill(chosen ? .ink : .quiet, compact: true))
        .accessibilityValue(count > 0 ? voices(verdict) : "")
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
    /// Shows every eco route on the map, like the header's Rutas chip.
    var pickRoutes: (() -> Void)?
    /// Nothing matched: offers to add the place that is missing.
    var suggest: (() -> Void)?
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @FocusState private var focused: Bool

    private var foundRoutes: [EcoRoute] {
        query.isEmpty ? routes : routes.filter { "\($0.name) \($0.municipalityName)".localizedStandardContains(query) }
    }
    private var foundPlaces: [MapPlace] {
        let sorted = places.sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
        guard !query.isEmpty else { return sorted }
        // Names that start with what was typed first, then names that contain it, then matches
        // on the category or town only, so "co" finds Colmado before every bank.
        func rank(_ place: MapPlace) -> Int? {
            let name = place.name.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
            let typed = query.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
            if name.hasPrefix(typed) || name.contains(" " + typed) { return 0 }
            if name.contains(typed) { return 1 }
            return "\(place.categoryName) \(municipalities[place.municipalityId] ?? "")".localizedStandardContains(query) ? 2 : nil
        }
        return sorted.compactMap { place in rank(place).map { (place, $0) } }.sorted { $0.1 < $1.1 }.map(\.0)
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Field(placeholder: L10n.Search.placeholder, text: $query, symbol: "magnifyingglass")
                    .focused($focused)
                    .submitLabel(.search)
                    .autocorrectionDisabled()
                IconButton(symbol: "xmark", label: L10n.Common.close, glass: true) { dismiss() }
            }
            .padding(.horizontal, 16)
            .padding(.top, 18)
            .padding(.bottom, 8)

            if query.isEmpty, !categories.isEmpty {
                // Before typing: every category as a tile, the way the system's browse screens open.
                ScrollView {
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                        // Routes first, as on the map's filter row.
                        if let pickRoutes, !routes.isEmpty {
                            Button(action: pickRoutes) {
                                CategoryTile(name: L10n.Map.routes, symbol: "figure.hiking", model: .adventure, color: PinTone.trail.color, detail: L10n.Map.routesCount(count: routes.count))
                            }
                            .buttonStyle(Pressable(scale: 0.97))
                        }
                        ForEach(categories, id: \.id) { category in
                            Button { pickCategory(category) } label: {
                                CategoryTile(name: category.name, symbol: Glyph.symbol(category.icon, filled: true), model: PlaceModel(icon: category.icon), color: PinTone.of(hex: category.color).color, detail: L10n.Explore.placesCount(count: Int(category.count)))
                            }
                            .buttonStyle(Pressable(scale: 0.97))
                        }
                    }
                    .padding(.horizontal, Metrics.gutter)
                    .padding(.top, 8)
                    .padding(.bottom, 24)
                    .readable()
                }
                .scrollDismissesKeyboard(.immediately)
            } else if foundRoutes.isEmpty && foundPlaces.isEmpty {
                StateView(symbol: "magnifyingglass", title: L10n.Search.emptyTitle, message: L10n.Search.emptyBody,
                          actionTitle: suggest == nil ? nil : L10n.Contributions.examplePlaceTitle, action: suggest)
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        if !foundRoutes.isEmpty {
                            FormLabel(text: L10n.Map.routes).padding(.horizontal, Metrics.gutter)
                            ForEach(foundRoutes, id: \.id) { route in
                                row(symbol: "figure.hiking", model: .adventure, tint: .solid(PinTone.trail.color), title: route.name, detail: "\(route.categoryName) · \(route.municipalityName)") { pickRoute(route) }
                            }
                        }
                        if !foundPlaces.isEmpty {
                            FormLabel(text: L10n.Search.places).padding(.horizontal, Metrics.gutter).padding(.top, 8)
                            ForEach(foundPlaces, id: \.id) { place in
                                row(symbol: Glyph.symbol(place.icon, filled: true), model: PlaceModel(icon: place.icon), tint: .solid(place.tint), title: place.name, detail: [place.categoryName, municipalities[place.municipalityId]].compactMap { $0 }.joined(separator: " · ")) { pickPlace(place) }
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

    private func row(symbol: String, model: PlaceModel? = nil, tint: Tint = .neutral, title: String, detail: String, action: @escaping () -> Void) -> some View {
        VStack(spacing: 0) {
            Button(action: action) {
                HStack(spacing: 14) {
                    GlyphDisc(symbol: symbol, model: model, tint: tint)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(title).type(.bodyStrong).lineLimit(1)
                        Text(detail).type(.callout, .ink3)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, Metrics.gutter)
                .padding(.vertical, 8)
            }
            .buttonStyle(RowPress())
        }
    }
}

/// A category as a quiet tile: its glyph on a disc in the kind's colour and how many places it
/// has on the top row, its name under them, so nothing sits on top of anything else.
private struct CategoryTile: View {
    let name: String
    let symbol: String
    let model: PlaceModel?
    let color: Color
    let detail: String

    var body: some View {
        HStack(spacing: 12) {
            CategoryArtwork(model: model, symbol: symbol, size: 22)
                .foregroundStyle(Color.onInk)
                .frame(width: 36, height: 36)
                .background(color, in: Circle())
            VStack(alignment: .leading, spacing: 1) {
                Text(name).type(.bodyStrong).lineLimit(2).multilineTextAlignment(.leading).minimumScaleFactor(0.9)
                Text(detail).type(.caption, .ink3)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, minHeight: 82, alignment: .leading)
        .background(Color.paper2)
        .clipShape(RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

private struct PlaceMedia: View {
    static let height: CGFloat = 150
    let sheet: PlaceSheet
    @State private var failed: Set<URL> = []
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var candidates: [URL] {
        let source = sheet.detail?.imageUrl.flatMap { value in
            value.hasPrefix("/") || value.hasPrefix("http://") || value.hasPrefix("https://") ? value : nil
        }
        let urls = [sheet.detail?.thumbnailUrl].compactMap { $0 }
            + (sheet.detail?.photos ?? [])
            + [sheet.place.thumbnailUrl, source].compactMap { $0 }
        var seen: Set<URL> = []
        return urls.compactMap(AppConfig.url).filter { seen.insert($0).inserted }
    }

    var body: some View {
        if let url = candidates.first(where: { !failed.contains($0) }) {
            AsyncImage(url: url, transaction: Transaction(animation: reduceMotion ? nil : .easeOut(duration: 0.25))) { phase in
                if let image = phase.image {
                    image.resizable().scaledToFill()
                        .frame(maxWidth: .infinity)
                        .frame(height: PlaceMedia.height)
                        .clipped()
                        .opensPhotos(gallery(startingAt: url))
                } else {
                    placeholder
                        .task(id: phase.error != nil) {
                            if phase.error != nil { failed.insert(url) }
                        }
                }
            }
            .id(url)
            .clipShape(RoundedRectangle(cornerRadius: Metrics.radiusCard))
        } else if sheet.loading, sheet.detail == nil {
            placeholder
        } else {
            PlaceStreet(coordinate: sheet.place.coordinate, tint: sheet.place.tint, icon: sheet.place.icon)
        }
    }

    private var placeholder: some View {
        Skeleton { RoundedRectangle(cornerRadius: Metrics.radiusCard).frame(height: PlaceMedia.height) }
    }

    private func gallery(startingAt url: URL) -> [String] {
        var seen: Set<URL> = [url]
        let others = (sheet.detail?.photos ?? []).compactMap(AppConfig.url)
            .filter { !failed.contains($0) && seen.insert($0).inserted }
        return ([url] + others).map(\.absoluteString)
    }
}

/// A still, close map of the place's street with its category marker: what stands in
/// for a photo until someone adds one.
private struct PlaceStreet: View {
    let coordinate: CLLocationCoordinate2D
    let tint: Color
    let icon: String

    var body: some View {
        Map(initialPosition: .region(MKCoordinateRegion(center: coordinate, latitudinalMeters: 320, longitudinalMeters: 320)), interactionModes: []) {
            Marker("", systemImage: Glyph.symbol(icon, filled: true), coordinate: coordinate).tint(tint.markerTint)
        }
        .mapStyle(.standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll))
        .frame(height: PlaceMedia.height)
        .clipShape(RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous).strokeBorder(Color.line, lineWidth: 1))
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}
