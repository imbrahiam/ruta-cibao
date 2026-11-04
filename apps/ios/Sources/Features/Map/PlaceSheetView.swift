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

    private var place: MapPlace { sheet.place }
    private var detail: PlacesDetailOutput? { sheet.detail }

    /// Opens tall enough for the whole photo; without one, just the essentials.
    static func compactHeight(hasPhoto: Bool) -> CGFloat { hasPhoto ? 440 : 230 }

    @Namespace private var zoom
    @State private var viewing = false
    @State private var showingExperiences = false
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                actions
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
                experiencesLink
                if sheet.loading {
                    ProgressView().frame(maxWidth: .infinity)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
            .padding(.bottom, 12)
        }
        .sheet(isPresented: $showingExperiences) {
            PlaceExperiencesView(place: place)
        }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 12) {
            CategoryPinBadge(icon: place.icon, hex: place.color, size: 44)
            VStack(alignment: .leading, spacing: 2) {
                Text(place.name)
                    .font(.headline)
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
            }
            Spacer(minLength: 8)
            SheetCloseButton()
        }
    }

    private var openElsewhere: some View {
        Menu {
            Button(L10n.Place.openAppleMaps, systemImage: "map") { open(Self.appleMaps(place)) }
            Button(L10n.Place.openGoogleMaps, systemImage: "globe.americas") { open(Self.googleMaps(place)) }
        } label: {
            Image(systemName: "arrow.up.forward.app")
                .font(.system(size: 17, weight: .semibold))
                .frame(width: 44, height: 44)
        }
        .buttonStyle(.plain)
        .glassEffect(.regular.interactive(), in: .circle)
        .accessibilityLabel(L10n.Place.openIn)
    }

    private var experiencesLink: some View {
        Button { showingExperiences = true } label: {
            HStack(spacing: 10) {
                Image(systemName: "text.bubble")
                    .font(.system(size: 17, weight: .medium))
                    .frame(width: 24)
                Text(L10n.Comments.experiences)
                    .font(.subheadline.weight(.semibold))
                Spacer(minLength: 8)
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            .foregroundStyle(.primary)
            .padding(.horizontal, 14)
            .frame(minHeight: 56)
            .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
        .glassEffect(.regular.interactive(), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
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
            .foregroundStyle(RutaProminentStyle.ink(on: categoryColor, scheme))
            .buttonStyle(.plain)
            .background(categoryColor.gradient, in: Capsule())

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

            openElsewhere

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

private struct PlaceExperiencesView: View {
    let place: MapPlace
    @Environment(\.graph) private var graph
    @State private var model: CommentsModel?
    @FocusState private var composing: Bool

    var body: some View {
        NavigationStack {
            ScrollView {
                if let model {
                    VStack(alignment: .leading, spacing: 4) {
                        CommentsHeader(title: L10n.Comments.experiences, total: Int(model.state.total))
                        CommentComposer(model: model, placeholder: L10n.Comments.experiencePlaceholder, focus: $composing)
                        CommentList(model: model, empty: L10n.Comments.emptyExperiences)
                    }
                } else {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 24)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(place.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { SheetCloseButton() } }
        }
        .task(id: place.slug) {
            guard let graph else { return }
            let model = CommentsModel(graph: graph, kind: .place, ref: place.slug)
            self.model = model
            await model.observe()
        }
        .fullScreenCover(isPresented: Binding(
            get: { model?.state.signInRequested ?? false },
            set: { if !$0 { model?.viewModel.signInHandled() } }
        )) {
            SignInScreen()
        }
    }
}

