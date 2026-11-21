import RutaKit
import SwiftUI

/// The province to browse without the map: a shortcut per kind of place, the eco routes, and
/// shelves of cards for what you would go out for. Every card opens its place on the map.
struct DiscoverScreen: View {
    var body: some View {
        Host(make: { $0.discover() }, flow: { $0.state }) { model in
            DiscoverBody(model: model)
        }
    }
}

private struct CategoryRoute: Hashable {
    let id: String
}

private struct DiscoverBody: View {
    let model: Screen<DiscoverViewModel, DiscoverUiState>
    @Environment(DeepLinks.self) private var links
    @State private var path: [CategoryRoute] = []

    private var state: DiscoverUiState { model.state }

    var body: some View {
        NavigationStack(path: $path) {
            content
                .rootHeader(L10n.Discover.title) {
                    HeaderFilters {
                        Chip(title: L10n.Discover.all, selected: state.municipalityId == nil, onBrand: true) { model.vm.selectMunicipality(id: nil) }
                        ForEach(state.municipalities, id: \.id) { town in
                            Chip(title: town.name, selected: state.municipalityId == town.id, onBrand: true) { model.vm.selectMunicipality(id: town.id) }
                        }
                    }
                }
                .paperBackground()
                .navigationDestination(for: CategoryRoute.self) { route in
                    if let category = state.categories.first(where: { $0.id == route.id }) {
                        CategoryPage(model: model, category: category, open: open)
                    }
                }
        }
    }

    @ViewBuilder private var content: some View {
        if state.loading && state.shelves.isEmpty && state.routes.isEmpty {
            DiscoverSkeleton()
        } else if let error = state.error, state.shelves.isEmpty {
            StateView(error: error) { model.vm.refresh() }
        } else if state.isEmpty {
            StateView(symbol: "square.grid.2x2", title: L10n.Discover.empty, message: L10n.Discover.emptyBody, actionTitle: nil, action: nil)
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: 30) {
                    if !state.categories.isEmpty { categories.rise(0) }
                    if !state.routes.isEmpty { routes.rise(1) }
                    ForEach(Array(state.shelves.enumerated()), id: \.element.id) { index, shelf in
                        ShelfView(shelf: shelf, open: open).rise(min(index + 2, 5))
                    }
                }
                .padding(.top, 18)
                .padding(.bottom, 32)
            }
            .refreshable { model.vm.refresh() }
        }
    }

    private func open(_ place: DiscoverPlace) { links.go(.place(slug: place.slug)) }

    // MARK: Shortcuts

    private var categories: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionTitle(title: L10n.Discover.categories)
            ScrollView(.horizontal) {
                HStack(alignment: .top, spacing: 6) {
                    ForEach(state.categories, id: \.id) { category in
                        Button { path.append(CategoryRoute(id: category.id)) } label: {
                            CategoryTile(name: category.name, icon: category.icon, color: category.color)
                        }
                        .buttonStyle(Pressable())
                    }
                }
                .padding(.horizontal, Metrics.gutter)
            }
            .scrollIndicators(.hidden)
        }
    }

    // MARK: Routes

    private var routes: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionTitle(title: L10n.Discover.routes, symbol: "figure.hiking", model: .adventure, subtitle: L10n.Discover.routesBody)
            ScrollView(.horizontal) {
                HStack(spacing: 12) {
                    ForEach(state.routes, id: \.id) { route in
                        Button { links.go(.route(id: route.id)) } label: { RouteCard(route: route) }
                            .buttonStyle(Pressable(scale: 0.98))
                    }
                }
                .padding(.horizontal, Metrics.gutter)
                .scrollTargetLayout()
            }
            .scrollTargetBehavior(.viewAligned)
            .modifier(CardShelfEdges())
        }
    }
}

private struct DiscoverSkeleton: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 30) {
                VStack(alignment: .leading, spacing: 12) {
                    SectionTitle(title: L10n.Discover.categories)
                    row(spacing: 6) {
                        ForEach(0..<6) { _ in
                            VStack(spacing: 7) {
                                Circle().frame(width: CategoryTile.iconSize, height: CategoryTile.iconSize)
                                SkeletonLine(50, lineHeight: 15, barHeight: 9, relativeTo: .caption)
                                    .frame(height: CategoryTile.labelHeight, alignment: .top)
                            }
                            .frame(width: CategoryTile.width)
                        }
                    }
                }
                VStack(alignment: .leading, spacing: 12) {
                    SectionTitle(title: L10n.Discover.routes, symbol: "figure.hiking", model: .adventure, subtitle: L10n.Discover.routesBody)
                    row(fades: true) {
                        ForEach(0..<2) { _ in
                            VStack(alignment: .leading, spacing: 0) {
                                Rectangle().frame(height: RouteCard.imageHeight)
                                    .overlay(alignment: .topLeading) {
                                        Capsule().fill(Color.paper3).frame(width: 88, height: 26).padding(10)
                                    }
                                VStack(alignment: .leading, spacing: 10) {
                                    SkeletonLine(164, lineHeight: 20, barHeight: 13, relativeTo: .headline)
                                    HStack(spacing: 6) {
                                        ForEach([76.0, 68, 78], id: \.self) { width in
                                            Capsule().frame(width: width, height: 28)
                                        }
                                    }
                                }
                                .padding(14)
                            }
                            .frame(width: RouteCard.width, alignment: .leading)
                            .background(Color.paper2)
                            .clipShape(RoundedRectangle(cornerRadius: Metrics.radiusCard))
                        }
                    }
                }
                VStack(alignment: .leading, spacing: 12) {
                    SectionTitle(title: L10n.Discover.todo, symbol: "sparkles")
                    row(fades: true) {
                        ForEach(0..<2) { _ in
                            VStack(alignment: .leading, spacing: 0) {
                                RoundedRectangle(cornerRadius: Metrics.radiusCard)
                                    .frame(width: DiscoverCard.width, height: DiscoverCard.imageHeight)
                                    .overlay(alignment: .topLeading) {
                                        Capsule().fill(Color.paper3).frame(width: 96, height: 26).padding(10)
                                    }
                                SkeletonLine(160).padding(.top, 10)
                                SkeletonLine(92, lineHeight: 16, barHeight: 10, relativeTo: .caption).padding(.top, 3)
                            }
                            .frame(width: DiscoverCard.width, alignment: .leading)
                        }
                    }
                }
            }
            .padding(.top, 18)
            .padding(.bottom, 32)
        }
    }

    private func row<Content: View>(spacing: CGFloat = 12, fades: Bool = false, @ViewBuilder content: () -> Content) -> some View {
        let placeholders = content()
        return ScrollView(.horizontal) {
            Skeleton {
                HStack(alignment: .top, spacing: spacing) { placeholders }
                    .padding(.horizontal, Metrics.gutter)
            }
        }
        .scrollIndicators(.hidden)
        .scrollDisabled(true)
        .modifier(CardShelfEdges(enabled: fades))
    }
}

// MARK: - Pieces

/// A section's title: its glyph in the brand's ink, the title, and a line on what is in it.
private struct SectionTitle: View {
    let title: String
    var symbol: String?
    var model: PlaceModel?
    var subtitle: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 8) {
                if let symbol {
                    CategoryArtwork(model: model, symbol: symbol, size: 17).foregroundStyle(Color.brandDeep)
                        .frame(width: 28, height: 28).background(Color.brandSoft, in: Circle())
                }
                Text(title).type(.title).accessibilityAddTraits(.isHeader)
            }
            if let subtitle { Text(subtitle).type(.callout, .ink3) }
        }
        .padding(.horizontal, Metrics.gutter)
    }
}

/// A kind of place: its glyph on a soft wash of its own colour, and its name.
private struct CategoryTile: View {
    static let width: CGFloat = 80
    static let iconSize: CGFloat = 58
    static let labelHeight: CGFloat = 30

    let name: String
    let icon: String
    let color: String

    var body: some View {
        let tone = PinTone.of(hex: color).color
        VStack(spacing: 7) {
            CategoryArtwork(icon: icon, size: 34)
                .foregroundStyle(tone)
                .frame(width: Self.iconSize, height: Self.iconSize)
                .background(tone.opacity(0.13), in: Circle())
            Text(name)
                .font(.system(size: 12.5, weight: .medium))
                .foregroundStyle(Color.ink)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .frame(width: 76, height: Self.labelHeight, alignment: .top)
        }
        .frame(width: Self.width)
        .accessibilityElement(children: .combine)
    }
}

private extension ShelfId {
    var title: String {
        switch self {
        case .todo: L10n.Discover.todo
        case .eat: L10n.Discover.eat
        case .shop: L10n.Discover.shop
        case .stay: L10n.Discover.stay
        case .services: L10n.Discover.services
        }
    }

    var symbol: String {
        switch self {
        case .todo: "sparkles"
        case .eat: "fork.knife"
        case .shop: "basket.fill"
        case .stay: "bed.double.fill"
        case .services: "wrench.and.screwdriver.fill"
        }
    }

    var artwork: PlaceModel? {
        switch self {
        case .todo: nil
        case .eat: .food
        case .shop: .market
        case .stay: .lodging
        case .services: .repair
        }
    }
}

private struct ShelfView: View {
    let shelf: Shelf
    let open: (DiscoverPlace) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionTitle(title: shelf.id.title, symbol: shelf.id.symbol, model: shelf.id.artwork)
            ScrollView(.horizontal) {
                HStack(alignment: .top, spacing: 12) {
                    ForEach(shelf.places, id: \.id) { place in
                        Button { open(place) } label: { DiscoverCard(place: place) }
                            .buttonStyle(Pressable(scale: 0.98))
                    }
                }
                .padding(.horizontal, Metrics.gutter)
                .scrollTargetLayout()
            }
            .scrollTargetBehavior(.viewAligned)
            .modifier(CardShelfEdges())
        }
    }
}

private struct CardShelfEdges: ViewModifier {
    var enabled = true

    private struct HiddenEdges: Equatable {
        var leading = false
        var trailing = false
    }

    @State private var edges = HiddenEdges()

    func body(content: Content) -> some View {
        content
            .scrollIndicators(.hidden)
            .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
            .onScrollGeometryChange(for: HiddenEdges.self) { geometry in
                HiddenEdges(
                    leading: geometry.visibleRect.minX > 1,
                    trailing: geometry.visibleRect.maxX < geometry.contentSize.width - 1
                )
            } action: { _, value in
                edges = value
            }
            .edgeFade(leading: enabled && edges.leading, trailing: enabled && edges.trailing)
    }
}

/// A place's picture, or its glyph on its colour when there is none.
private struct PlacePicture: View {
    let place: DiscoverPlace

    var body: some View {
        let tone = PinTone.of(hex: place.categoryColor).color
        ZStack {
            tone.opacity(0.14)
            CategoryArtwork(icon: place.categoryIcon, size: PlaceModel(icon: place.categoryIcon) == nil ? 42 : 84)
                .foregroundStyle(tone.opacity(0.7))
            if let image = place.imageUrl, let url = URL(string: image) {
                AsyncImage(url: url) { phase in
                    if let picture = phase.image {
                        picture.resizable().scaledToFill().transition(.opacity)
                    } else if phase.error == nil {
                        Skeleton { Rectangle() }
                    }
                }
            }
        }
        .clipped()
        .accessibilityHidden(true)
    }
}

/// The category and its glyph on a tinted label over the picture.
private struct KindChip: View {
    let place: DiscoverPlace

    var body: some View {
        HStack(spacing: 5) {
            CategoryArtwork(icon: place.categoryIcon, size: 15).foregroundStyle(PinTone.of(hex: place.categoryColor).color)
            Text(place.categoryName).font(.system(size: 12, weight: .semibold)).foregroundStyle(Color.ink).lineLimit(1)
        }
        .padding(.horizontal, 9)
        .frame(height: 26)
        .background(Color.brandSoft, in: Capsule())
        .shadow(color: .black.opacity(0.08), radius: 4, y: 1)
    }
}

private struct DiscoverCard: View {
    static let width: CGFloat = 228
    static let imageHeight: CGFloat = 152

    let place: DiscoverPlace

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            PlacePicture(place: place)
                .frame(width: Self.width, height: Self.imageHeight)
                .overlay(alignment: .topLeading) { KindChip(place: place).padding(10) }
                .clipShape(RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
            Text(place.name).type(.bodyStrong).lineLimit(2).multilineTextAlignment(.leading).padding(.top, 10)
            Label(place.municipalityName, systemImage: "mappin.and.ellipse").font(.system(size: 13, weight: .medium)).foregroundStyle(Color.ink3).padding(.top, 3)
        }
        .frame(width: Self.width, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

private extension RoutesBrowseOutput.Item {
    var difficultyTitle: String {
        switch difficulty {
        case .easy: L10n.Discover.Difficulty.easy
        case .moderate: L10n.Discover.Difficulty.moderate
        case .hard: L10n.Discover.Difficulty.hard
        }
    }

    var difficultyTint: Color {
        switch difficulty {
        case .easy: Color.success
        case .moderate: Color.solid(0xA9740F)
        case .hard: Color.solid(0xC0623A)
        }
    }
}

/// An eco route: its line drawn over contours, how hard it is, and how long and far.
private struct RouteCard: View {
    static let width: CGFloat = 300
    static let imageHeight: CGFloat = 140

    let route: RoutesBrowseOutput.Item

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            RouteSketch(points: route.path.map { CGPoint(x: $0.lng, y: $0.lat) })
                .frame(height: Self.imageHeight)
                .overlay(alignment: .topLeading) {
                    HStack(spacing: 6) {
                        Circle().fill(route.difficultyTint).frame(width: 8, height: 8)
                        Text(route.difficultyTitle).font(.system(size: 12.5, weight: .semibold)).foregroundStyle(Color.ink)
                    }
                    .padding(.horizontal, 10)
                    .frame(height: 26)
                    .background(Color.paper3, in: Capsule())
                    .padding(10)
                }
            VStack(alignment: .leading, spacing: 10) {
                Text(route.name).type(.heading).lineLimit(2).multilineTextAlignment(.leading)
                HStack(spacing: 6) {
                    MetaTag(symbol: "clock", text: L10n.Discover.minutes(minutes: "\(Int(route.durationMinutes))"), fill: .brandSoft)
                    MetaTag(symbol: "point.topleft.down.to.point.bottomright.curvepath", text: L10n.Discover.km(km: (route.distanceMeters / 1000).formatted(.number.precision(.fractionLength(1)))), fill: .brandSoft)
                    MetaTag(symbol: "mappin.and.ellipse", text: route.municipalityName, fill: .brandSoft)
                }
            }
            .padding(14)
        }
        .frame(width: Self.width)
        .background(Color.paper2)
        .clipShape(RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

/// The route's line, fitted into the card over faint contour lines, with its start and end.
private struct RouteSketch: View {
    let points: [CGPoint]

    var body: some View {
        Canvas { context, size in
            for index in 0..<7 {
                let y = size.height * (0.1 + CGFloat(index) * 0.14)
                var line = Path()
                line.move(to: CGPoint(x: -10, y: y))
                line.addCurve(to: CGPoint(x: size.width + 10, y: y - 10), control1: CGPoint(x: size.width * 0.35, y: y - 22), control2: CGPoint(x: size.width * 0.7, y: y + 18))
                context.stroke(line, with: .color(Color.brand.opacity(0.12)), lineWidth: 1)
            }
            guard points.count > 1 else { return }
            let latitude = points[0].y * .pi / 180
            let xs = points.map { $0.x * cos(latitude) }, ys = points.map(\.y)
            let minX = xs.min()!, maxX = xs.max()!, minY = ys.min()!, maxY = ys.max()!
            let pad: CGFloat = 26
            let scale = min((size.width - pad * 2) / max(maxX - minX, 1e-9), (size.height - pad * 2) / max(maxY - minY, 1e-9))
            let offX = (size.width - (maxX - minX) * scale) / 2, offY = (size.height - (maxY - minY) * scale) / 2
            let projected = zip(xs, ys).map { CGPoint(x: ($0 - minX) * scale + offX, y: size.height - (($1 - minY) * scale + offY)) }
            var trail = Path()
            trail.addLines(projected)
            context.stroke(trail, with: .color(.white), style: StrokeStyle(lineWidth: 8, lineCap: .round, lineJoin: .round))
            context.stroke(trail, with: .color(Color.brand), style: StrokeStyle(lineWidth: 4.5, lineCap: .round, lineJoin: .round))
            if let start = projected.first, let end = projected.last {
                context.fill(Circle().path(in: CGRect(x: start.x - 7, y: start.y - 7, width: 14, height: 14)), with: .color(.white))
                context.stroke(Circle().path(in: CGRect(x: start.x - 5.5, y: start.y - 5.5, width: 11, height: 11)), with: .color(Color.brand), lineWidth: 3)
                context.fill(Circle().path(in: CGRect(x: end.x - 6.5, y: end.y - 6.5, width: 13, height: 13)), with: .color(Color.brand))
            }
        }
        .background(Color.brandSoft)
        .accessibilityHidden(true)
    }
}

/// Every place of one kind, as a list of cards.
private struct CategoryPage: View {
    static let imageSize: CGFloat = 84

    let model: Screen<DiscoverViewModel, DiscoverUiState>
    let category: PlacesCategoriesItem
    let open: (DiscoverPlace) -> Void

    var body: some View {
        let places = model.state.category?.id == category.id ? model.state.categoryPlaces : nil
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 12) {
                if let places {
                    Text(L10n.Discover.count(count: places.count)).type(.callout, .ink3)
                    ForEach(places, id: \.id) { place in
                        Button { open(place) } label: {
                            HStack(spacing: 14) {
                                PlacePicture(place: place)
                                    .frame(width: Self.imageSize, height: Self.imageSize)
                                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(place.name).type(.bodyStrong).lineLimit(2).multilineTextAlignment(.leading)
                                    Label(place.municipalityName, systemImage: "mappin.and.ellipse").font(.system(size: 13, weight: .medium)).foregroundStyle(Color.ink3)
                                }
                                Spacer(minLength: 0)
                                Image(systemName: "chevron.right").font(.system(size: 12, weight: .medium)).foregroundStyle(Color.ink4)
                            }
                            .padding(10)
                            .background(Color.paper2, in: RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
                        }
                        .buttonStyle(Pressable(scale: 0.98))
                        .accessibilityHint(L10n.Discover.openMap)
                    }
                    if places.isEmpty {
                        StateView(symbol: Glyph.symbol(category.icon), model: PlaceModel(icon: category.icon), title: L10n.Discover.empty, message: L10n.Discover.emptyBody, actionTitle: nil, action: nil).frame(height: 300)
                    }
                } else if let error = model.state.categoryError {
                    StateView(error: error) { model.vm.openCategory(category: category) }.frame(minHeight: 240)
                } else {
                    Skeleton {
                        VStack(spacing: 12) {
                            ForEach(0..<4) { _ in
                                HStack(spacing: 14) {
                                    RoundedRectangle(cornerRadius: 14).frame(width: Self.imageSize, height: Self.imageSize)
                                    VStack(alignment: .leading, spacing: 4) {
                                        SkeletonLine(158)
                                        SkeletonLine(108, lineHeight: 16, barHeight: 10, relativeTo: .caption)
                                    }
                                    Spacer(minLength: 0)
                                    SkeletonLine(10, lineHeight: 14, barHeight: 8)
                                }
                                .padding(10)
                                .background(Color.paper2, in: RoundedRectangle(cornerRadius: Metrics.radiusCard))
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, Metrics.gutter)
            .padding(.vertical, 16)
        }
        .paperBackground()
        .navigationTitle(category.name)
        .navigationBarTitleDisplayMode(.large)
        .onAppear { model.vm.openCategory(category: category) }
        .onDisappear { model.vm.closeCategory() }
    }
}
