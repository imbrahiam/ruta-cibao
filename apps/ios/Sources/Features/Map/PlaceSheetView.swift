import MapKit
import RutaKit
import SwiftUI

/// A place, Apple Maps style: the first frame comes from the pin, the rest
/// arrives with the detail. One dominant action (directions), the rest icons.
struct PlaceSheetView: View {
    let sheet: PlaceSheet
    let save: () -> Void
    /// In-app turn-by-turn (RouteNavigator), not a hand-off to Apple Maps.
    let directions: () -> Void
    /// Asks to claim; false when sign-in is needed first.
    let requestClaim: () -> Bool
    let refreshBusiness: () -> Void
    let confirm: (PlacesConfirmInput.Verdict) -> Void
    let requestReport: () -> Void
    let updateReportReason: (PlacesReportInput.Reason) -> Void
    let updateReportDetails: (String) -> Void
    let submitReport: () -> Void
    let closeReport: () -> Void

    private var place: MapPlace { sheet.place }
    private var detail: PlacesDetailOutput? { sheet.detail }

    /// Opens tall enough for the whole photo; without one, just the essentials.
    /// Without one, about 46% of the screen: header, actions, hours and two lines of description, nothing clipped.
    static func compactHeight(hasPhoto: Bool, screen: CGFloat) -> CGFloat { hasPhoto ? 440 : max(320, (screen * 0.46).rounded()) }

    @Namespace private var zoom
    @State private var viewing = false
    @State private var showingExperiences = false
    @State private var businessForm: BusinessFormMode?
    @Environment(\.colorScheme) private var scheme
    @Environment(\.palette) private var palette

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                actions
                contactRow
                if let raw = heroRaw {
                    // A fixed frame first, the image inside it: a fill-scaled
                    // image must never widen the column it sits in.
                    Button { viewing = true } label: {
                        RemotePhoto(photo: PostPhoto(url: raw, width: 0, height: 0, alt: place.name))
                            .frame(height: 200)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .matchedTransitionSource(id: "hero", in: zoom)
                    .accessibilityLabel(L10n.Place.photoOpen)
                    .fullScreenCover(isPresented: $viewing) {
                        PhotoViewer(photos: [PostPhoto(url: raw, width: 0, height: 0, alt: place.name)], start: 0)
                            .navigationTransition(.zoom(sourceID: "hero", in: zoom))
                    }
                }
                if let description = detail?.description_, !description.isEmpty {
                    Text(description)
                        .font(.subheadline)
                        .lineSpacing(3)
                }
                VStack(alignment: .leading, spacing: 24) {
                    PlaceFeedbackView(sheet: sheet, confirm: confirm, requestReport: requestReport)
                    infoList
                }
                .padding(.top, 8)
                if sheet.loading {
                    ProgressView().frame(maxWidth: .infinity)
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 20)
            .padding(.bottom, 12)
        }
        .presentationBackground(scheme == .dark ? AnyShapeStyle(.thickMaterial) : AnyShapeStyle(.regularMaterial))
        .sheet(isPresented: $showingExperiences) {
            PlaceExperiencesView(place: place)
        }
        .sheet(isPresented: Binding(get: { sheet.report != nil }, set: { if !$0 { closeReport() } })) {
            if let report = sheet.report {
                PlaceReportView(
                    report: report, updateReason: updateReportReason, updateDetails: updateReportDetails,
                    submit: submitReport, close: closeReport
                )
                .interactiveDismissDisabled(report.submitting)
            }
        }
        #if DEBUG
        // `SIMCTL_CHILD_RUTA_DEBUG_COMPOSE=claim|edit` opens the business form (screenshot runs).
        .onChange(of: sheet.business is BusinessStateListed || sheet.business is BusinessStateOwned, initial: true) { _, ready in
            let hook = ProcessInfo.processInfo.environment["RUTA_DEBUG_COMPOSE"]
            guard ready, businessForm == nil else { return }
            if hook == "claim" { businessForm = .claim } else if hook == "edit" { businessForm = .edit }
        }
        #endif
        .sheet(item: $businessForm) { mode in
            BusinessFormScreen(placeId: place.id, mode: mode, contact: contact) { refreshBusiness() }
        }
    }

    private var contact: Contact? {
        switch onEnum(of: sheet.business) {
        case .listed(let listed): listed.contact
        case .owned(let owned): owned.contact
        case .notABusiness, .claimPending: nil
        }
    }

    /// Call and WhatsApp as pills with the other actions, hours as one info row.
    /// Only what the business published.
    @ViewBuilder private var contactRow: some View {
        if let contact {
            let pills = [
                contact.phoneLink.map { (L10n.Place.call, "phone.fill", $0) },
                contact.whatsappLink.map { (L10n.Place.whatsapp, "message.fill", $0) },
            ].compactMap { $0 }
            if !pills.isEmpty {
                HStack(spacing: 10) {
                    ForEach(pills, id: \.0) { label, symbol, link in
                        Button { open(URL(string: link)) } label: {
                            Label(label, systemImage: symbol)
                                .font(.subheadline.weight(.semibold))
                                .frame(maxWidth: .infinity, minHeight: 44)
                        }
                        .buttonStyle(.plain)
                        // Threads' secondary button: a flat grey fill, no border, bold label.
                        .background(scheme == .dark ? palette.fillPressed : palette.inset, in: Capsule())
                    }
                }
            }
            if let hours = contact.hours {
                Label(hours, systemImage: "clock")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityElement(children: .combine)
            }
        }
    }

    /// One grouped inset list: experiences, the business row when it applies, report.
    private var infoList: some View {
        let shape = RoundedRectangle(cornerRadius: 16, style: .continuous)
        return VStack(spacing: 0) {
            listRow(L10n.Comments.experiences, symbol: "text.bubble") { showingExperiences = true }
            switch onEnum(of: sheet.business) {
            case .listed(let listed) where listed.canClaim:
                Divider().padding(.leading, 52)
                listRow(L10n.Place.claimTitle, symbol: "storefront") {
                    if requestClaim() { businessForm = .claim }
                }
            case .claimPending:
                Divider().padding(.leading, 52)
                listRow(L10n.Place.claimReview, symbol: "hourglass", action: nil)
            case .owned:
                Divider().padding(.leading, 52)
                listRow(L10n.Place.editBusiness, symbol: "pencil") { businessForm = .edit }
            default:
                EmptyView()
            }
            Divider().padding(.leading, 52)
            listRow(L10n.Place.report, symbol: "flag", action: requestReport)
        }
        .background(scheme == .dark ? palette.fillPressed : Color.primary.opacity(0.06), in: shape)
        .clipShape(shape)
    }

    @ViewBuilder private func listRow(_ title: String, symbol: String, action: (() -> Void)?) -> some View {
        let content = HStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 17, weight: .medium))
                .frame(width: 24)
            Text(title)
                .font(.body)
                .multilineTextAlignment(.leading)
            Spacer(minLength: 8)
            if action != nil {
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
        }
        .foregroundStyle(action == nil ? Color.secondary : Color.primary)
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
        .contentShape(Rectangle())
        if let action {
            Button(action: action) { content }.buttonStyle(.plain)
        } else {
            content.accessibilityElement(children: .combine)
        }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 12) {
            CategoryPinBadge(icon: place.icon, hex: place.color, size: 44)
            VStack(alignment: .leading, spacing: 2) {
                Text(place.name)
                    .font(.title2.bold())
                    .foregroundStyle(.primary)
                    .lineLimit(2)
                    .accessibilityAddTraits(.isHeader)
                HStack(spacing: 6) {
                    Text(place.categoryName)
                    if let municipality = detail?.municipality.name {
                        Text(verbatim: "·")
                        Text(municipality)
                    }
                }
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(1)
                if sheet.cached == false, let trust = detail?.trust { trustLine(trust.state) }
            }
            Spacer(minLength: 8)
            SheetCloseButton()
        }
    }

    /// How much neighbours vouch for the place, as icon + words.
    private func trustLine(_ state: PlacesDetailOutput.TrustState) -> some View {
        let (symbol, text, ink): (String, String, Color) = switch state {
        case .confirmed: ("checkmark.circle.fill", L10n.Place.Trust.confirmed, palette.successInk)
        case .doubted: ("questionmark.circle", L10n.Place.Trust.doubted, palette.warningInk)
        case .established: ("checkmark.seal.fill", L10n.Place.Trust.established, palette.successInk)
        default: ("sparkles", L10n.Place.Trust.new, palette.textSecondary)
        }
        return Label(text, systemImage: symbol)
            .font(.footnote.weight(.medium))
            .foregroundStyle(ink)
            .padding(.top, 2)
    }

    @Environment(\.openURL) private var openURL
    private func open(_ url: URL?) { if let url { openURL(url) } }

    static func appleMaps(_ place: MapPlace) -> URL? {
        var c = URLComponents(string: "https://maps.apple.com/")
        c?.queryItems = [
            URLQueryItem(name: "ll", value: "\(place.latitude),\(place.longitude)"),
            URLQueryItem(name: "q", value: place.name),
        ]
        return c?.url
    }

    /// Google's universal link: opens the app when installed, the web if not.
    static func googleMaps(_ place: MapPlace) -> URL? {
        var c = URLComponents(string: "https://www.google.com/maps/search/")
        c?.queryItems = [
            URLQueryItem(name: "api", value: "1"),
            URLQueryItem(name: "query", value: "\(place.latitude),\(place.longitude)"),
        ]
        return c?.url
    }

    private var actions: some View {
        HStack(spacing: 10) {
            Button(action: directions) {
                Label(L10n.Map.directions, systemImage: "arrow.triangle.turn.up.right.diamond.fill")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .foregroundStyle(.white)
            .buttonStyle(.plain)
            .background(RutaProminentStyle.fill(forWhiteOn: categoryColor, scheme), in: Capsule())

            Button(action: save) {
                Image(systemName: sheet.saved ? "bookmark.fill" : "bookmark")
                    .font(.system(size: 17, weight: .semibold))
                    .contentTransition(.symbolEffect(.replace))
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .glassEffect(.regular.interactive(), in: .circle)
            .sensoryFeedback(.impact(weight: .light), trigger: sheet.saved)
            .accessibilityLabel(sheet.saved ? L10n.Place.savedLabel : L10n.Place.save)

            ShareLink(item: URL(string: "https://rutacibao.do/lugares/\(place.slug)")!, subject: Text(place.name)) {
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .glassEffect(.regular.interactive(), in: .circle)
            .accessibilityLabel(L10n.Common.share)
        }
    }

    private var categoryColor: Color {
        CategoryGlyph.style(place.icon, hex: place.color).color
    }

    private var heroRaw: String? {
        detail?.imageUrl ?? place.thumbnailUrl
    }
}

extension BusinessFormMode: @retroactive Identifiable {
    public var id: Int { Int(ordinal) }
}


