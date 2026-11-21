import MapKit
import RutaKit
import SwiftUI

typealias EcoRoute = RoutesBrowseOutput.Item

extension MapPlace {
    var coordinate: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: latitude, longitude: longitude) }
    /// The admin colour folded onto the map's family of tones.
    var tone: PinTone { .of(hex: color) }
    var tint: Color { tone.color }
}

extension EcoRoute {
    var coordinates: [CLLocationCoordinate2D] { path.map { CLLocationCoordinate2D(latitude: $0.lat, longitude: $0.lng) } }
    var start: CLLocationCoordinate2D? { coordinates.first }
}

extension TrafficNotice {
    var coordinate: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: latitude, longitude: longitude) }
    var tone: PinTone { severity == .blocking ? .blocked : .caution }
    var tint: Color { tone.color }
}

private extension MKPolyline {
    var path: [GeoPoint] {
        var points = [CLLocationCoordinate2D](repeating: kCLLocationCoordinate2DInvalid, count: pointCount)
        getCoordinates(&points, range: NSRange(location: 0, length: pointCount))
        return points.map(GeoPoint.init)
    }
}

/// The province on one map: places, eco routes and what is happening on the road.
struct MapScreen: View {
    var body: some View {
        Host(make: { $0.map() }, flow: { $0.state }) { model in
            MapBody(model: model)
        }
    }
}

private struct MapBody: View {
    let model: Screen<MapViewModel, MapUiState>
    @Environment(DeepLinks.self) private var links
    @Environment(AppChrome.self) private var chrome: AppChrome?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var camera = CameraRequest(move: .region(center: GeoPoint(CLLocationCoordinate2D(latitude: 19.4772, longitude: -71.3414)), latitudeSpan: 0.024, longitudeSpan: 0.024))
    @State private var viewport: Viewport?
    @State private var mapHeight: CGFloat = 700
    @State private var mapWidth: CGFloat = 400
    /// What MapKit keeps clear at the map's bottom (the tab bar and home indicator): the
    /// region it is given is centred in the space above it.
    @State private var mapBottomInset: CGFloat = 0
    /// Where the header ends and where the map starts, on screen: the map runs under the status
    /// bar and the header, so what it must keep clear is the distance between the two.
    @State private var headerBottom: CGFloat = 0
    @State private var mapTop: CGFloat = 0
    private var headerHeight: CGFloat { max(headerBottom - mapTop, 0) }
    @State private var following = false
    /// The pin in hand, keyed like `selectionKey`.
    @State private var picked: String?
    @State private var searching = DebugHook.value("RUTA_DEBUG_COMPOSE") == "search"
    @State private var afterSearch: (() -> Void)?
    @State private var navigator = RouteNavigator()
    /// Walking an eco route stop by stop.
    @State private var trail = TrailGuide()
    @State private var framed = false
    /// The trip card's room at the map's bottom while previewing a route, so MapKit keeps its
    /// logo and legal link in view above the card.
    private var cardInset: CGFloat { routing && !guiding ? CGFloat(Self.previewCover) : 0 }
    /// Where the map stood before a route took it over, so ending the route gives it back.
    @State private var beforeRoute: Viewport?
    /// The pin a route leads to: while routing it is the only pin on the map, so the way reads clearly.
    @State private var routeTarget: String?
    @State private var location = CLLocationManager()
    /// The map in relief, remembered between launches.
    @AppStorage("map.threeD") private var threeD = false

    private var state: MapUiState { model.state }
    private var vm: MapViewModel { model.vm }
    private var routing: Bool { navigator.phase != .idle || trail.active }
    private var guiding: Bool { navigator.phase == .navigating || navigator.phase == .arrived }

    /// Pins that would sit on top of each other give way until the zoom separates them.
    private var places: [MapPlace] {
        guard let viewport else { return state.places }
        let perPoint = viewport.latitudeSpan / Double(max(mapHeight, 1))
        let cell = perPoint * 46
        let gridded = Clustering.shared.declutter(places: state.places, cellLatitude: cell, cellLongitude: cell, keep: state.sheet?.place.id)
        // Road notices are live and few: they always show, and places give way around them.
        let notices = state.traffic.map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) }
        return spaced(gridded, around: notices, perPoint: perPoint, keep: state.sheet?.place.id)
    }

    /// The grid leaves neighbours that straddle a cell edge almost touching, so a second
    /// pass keeps a marker's footprint (a balloon about 40 × 48 pt) free around each pin and
    /// around the fixed points given (road notices).
    private func spaced(_ places: [MapPlace], around fixed: [CLLocationCoordinate2D], perPoint: Double, keep: String?) -> [MapPlace] {
        guard perPoint > 0 else { return places }
        let ordered = places.sorted { ($0.id == keep ? 0 : 1) < ($1.id == keep ? 0 : 1) }
        var taken = fixed
        var kept: [MapPlace] = []
        for place in ordered {
            let scale = cos(place.latitude * .pi / 180)
            let clear = place.id == keep || taken.allSatisfy { other in
                let dx = (place.longitude - other.longitude) * scale / perPoint / 40
                let dy = (place.latitude - other.latitude) / perPoint / 48
                return dx * dx + dy * dy >= 1
            }
            if clear {
                kept.append(place)
                taken.append(place.coordinate)
            }
        }
        return kept
    }

    var body: some View {
        map
            .overlay(alignment: .top) { if !routing { topBar.transition(.move(edge: .top).combined(with: .opacity)) } }
            .overlay(alignment: .bottomTrailing) { if !routing { controls.transition(.opacity) } }
            .overlay(alignment: .bottom) {
                if navigator.phase != .idle, !guiding { RoutePreview(navigator: navigator).hidesTabBar().transition(.move(edge: .bottom).combined(with: .opacity)) }
            }
            .overlay { if guiding { Guidance(navigator: navigator).hidesTabBar().transition(.opacity) } }
            .overlay { if trail.active { TrailGuidance(guide: trail).hidesTabBar().transition(.opacity) } }
            .overlay {
                if state.phase == .failed {
                    StateView(error: state.error ?? .unknown) { vm.retry() }
                        .frame(maxWidth: 320, maxHeight: 280)
                        .floating(in: RoundedRectangle(cornerRadius: Metrics.radiusPanel, style: .continuous))
                }
            }
            .animation(reduceMotion ? nil : Motion.settle, value: navigator.phase)
            .sheet(isPresented: Binding(get: { selected && !routing && !searching }, set: { if !$0 { dismissSelection() } })) {
                SelectionSheet(model: model, close: dismissSelection, directions: navigate, startTrail: walk)
            }
            // A result opens once search has fully left: presenting the next sheet while this
            // one is still dismissing with the keyboard up crashes UIKit's keyboard layout guide.
            .sheet(isPresented: $searching, onDismiss: { afterSearch?(); afterSearch = nil }) {
                MapSearch(places: state.all, routes: state.routes, municipalities: state.municipalities, categories: state.categories,
                          pickCategory: { category in afterSearch = { vm.clearFilters(); vm.toggleCategory(id: category.id) }; searching = false },
                          pickPlace: { place in afterSearch = { vm.select(placeId: place.id) }; searching = false },
                          pickRoute: { route in afterSearch = { vm.selectRoute(id: route.id) }; searching = false },
                          pickRoutes: { afterSearch = { vm.clearFilters(); vm.toggleRoutes() }; searching = false },
                          suggest: { afterSearch = { chrome?.requested = .place }; searching = false })
            }
            .fullScreenCover(isPresented: Binding(get: { state.signInRequested }, set: { if !$0 { vm.signInHandled() } })) { SignInScreen() }
            .onAppear { vm.setMapVisible(visible: true) }
            .onDisappear { vm.setMapVisible(visible: false) }
            .task {
                // Open where the person is when the phone already knows; otherwise on the town centre.
                guard !framed, state.sheet == nil, let here = await CurrentLocation.once(timeout: .seconds(2)) else { return }
                framed = true
                if !selected { look(.region(center: GeoPoint(here), latitudeSpan: 0.02, longitudeSpan: 0.02), animated: false) }
            }
            .onChange(of: selectionKey) { _, key in
                if picked != (key.isEmpty ? nil : key) { picked = key.isEmpty ? nil : key }
                focusSelection()
            }
            .onChange(of: picked) { _, key in
                guard key != (selectionKey.isEmpty ? nil : selectionKey) else { return }
                guard let key else { return dismissSelection() }
                let id = String(key.dropFirst())
                switch key.first {
                case "p": vm.select(placeId: id)
                // A trail's ends are markers, not things to open.
                case "s": picked = selectionKey.isEmpty ? nil : selectionKey
                case "t": vm.selectTraffic(id: id)
                default: vm.selectRoute(id: id)
                }
            }
            .onChange(of: links.requestId, initial: true) { _, _ in
                switch links.pending {
                case .place(let slug): vm.openPlace(slug: slug)
                case .route(let id): vm.openRoute(id: id)
                case .traffic(let id): vm.openTraffic(id: id)
                default: return
                }
                links.pending = nil
            }
            .onChange(of: navigator.route) { _, route in
                guard let route, navigator.phase != .navigating else { return }
                // The whole way, above the trip card (the header is away while routing).
                frame(route.polyline.path.map(\.coordinate), cover: Self.previewCover)
            }
            // Ending a route (or turn-by-turn) puts the map back where it was, with its pins,
            // instead of leaving it on a street-level close-up.
            .onChange(of: navigator.phase) { old, phase in
                guard phase == .idle, old != .idle, let before = beforeRoute else { return }
                beforeRoute = nil
                look(.region(center: GeoPoint(CLLocationCoordinate2D(latitude: (before.north + before.south) / 2, longitude: (before.east + before.west) / 2)),
                             latitudeSpan: before.latitudeSpan, longitudeSpan: before.east - before.west))
            }
            // Showing only the routes brings them into view: they run outside the towns, so
            // the filter would otherwise leave an empty map.
            .onChange(of: state.routesSelected) { _, on in
                guard on, !selected else { return }
                frame(state.routes.flatMap(\.coordinates))
            }
            // Closing a route's sheet under the Rutas filter frames every route again.
            .onChange(of: selected) { _, now in
                guard !now, !routing, beforeRoute == nil, state.routesSelected else { return }
                frame(state.routes.flatMap(\.coordinates))
            }
            // On the trail the map follows you, close in, as you walk.
            .onChange(of: trail.location) { _, here in
                guard trail.active, let here else { return }
                look(.follow(center: GeoPoint(here.coordinate), distance: 360, heading: trail.course), animated: true)
            }
            .onChange(of: trail.active) { was, now in
                guard was, !now, let before = beforeRoute else { return }
                beforeRoute = nil
                look(.region(center: GeoPoint(CLLocationCoordinate2D(latitude: (before.north + before.south) / 2, longitude: (before.east + before.west) / 2)),
                             latitudeSpan: before.latitudeSpan, longitudeSpan: before.east - before.west))
            }
            .onChange(of: navigator.location) { _, here in
                guard navigator.phase == .navigating, let here else { return }
                look(.follow(center: GeoPoint(here.coordinate), distance: navigator.mode.onRoads ? 700 : 320, heading: navigator.course), animated: true)
            }
    }

    // MARK: Map

    private var map: some View {
        AppleMap(
            pins: pins, lines: lines, selected: picked, camera: camera,
            topInset: routing ? statusInset : headerHeight, bottomInset: cardInset,
            threeD: threeD, traveller: guiding ? navigator.mode : (trail.active ? .walk : nil),
            onPick: { picked = $0 },
            onMove: { box in
                viewport = box
                vm.onViewportChanged(west: box.west, south: box.south, east: box.east, north: box.north)
            },
            onFollowing: { following = $0 }
        )
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { mapHeight = $0.height; mapWidth = $0.width; mapTop = $0.minY }
        .onGeometryChange(for: CGFloat.self) { $0.safeAreaInsets.bottom } action: { mapBottomInset = $0 }
        .ignoresSafeArea(edges: .top)
        .accessibilityLabel(L10n.Tabs.map)
    }

    private var pins: [MapPin] {
        if trail.active { return stopPins(trail.stops) }
        guard !routing else { return allPins.filter { $0.key == routeTarget } }
        // A route in hand shows its stops in order; the places it passes give way to them.
        if case .route(let route) = onEnum(of: state.selection) {
            let stops = TrailStops.of(route.route, places: state.all)
            let onRoute = Set(stops.compactMap(\.placeId).map { "p" + $0 })
            return allPins.filter { !onRoute.contains($0.key) && !$0.key.hasPrefix("r") } + stopPins(stops)
        }
        return allPins
    }

    /// A trail's stops as markers: flags at the ends, the stop's number in between.
    private func stopPins(_ stops: [TrailStop]) -> [MapPin] {
        stops.enumerated().map { index, stop in
            let symbol = stop.kind == .place ? (index <= 50 ? "\(index).circle.fill" : "circle.fill") : stop.symbol
            return MapPin(key: stop.placeId.map { "p" + $0 } ?? "s" + stop.id, latitude: stop.coordinate.latitude, longitude: stop.coordinate.longitude,
                          title: stop.name, symbol: symbol, tone: .trail)
        }
    }

    /// The status bar's height: with the header away while routing, the map keeps clear of it.
    private var statusInset: CGFloat {
        (UIApplication.shared.connectedScenes.first as? UIWindowScene)?.keyWindow?.safeAreaInsets.top ?? 59
    }

    private var allPins: [MapPin] {
        places.map { MapPin(key: "p" + $0.id, latitude: $0.latitude, longitude: $0.longitude, title: $0.name, symbol: Glyph.symbol($0.icon, filled: true), tone: $0.tone) }
            // A notice stands on its stretch of road as its marker, at the stretch's middle; a
            // closed road also gets a smaller one at either end, so where it starts and stops reads.
            + state.traffic.flatMap { notice -> [MapPin] in
                let sign = TrafficSignKind.of(category: notice.categoryName, icon: notice.icon)
                let middle = notice.path.count > 1 ? notice.path[notice.path.count / 2] : nil
                let key = "t" + notice.id
                var pins = [MapPin(key: key, latitude: middle?.latitude ?? notice.latitude, longitude: middle?.longitude ?? notice.longitude,
                                   title: notice.categoryName, symbol: Glyph.symbol(notice.icon, filled: true), tone: notice.tone, sign: sign)]
                if sign.striped, notice.path.count > 2, let first = notice.path.first, let last = notice.path.last {
                    for (end, point) in [("s", first), ("e", last)] {
                        pins.append(MapPin(key: key + end, latitude: point.latitude, longitude: point.longitude, title: notice.categoryName,
                                           symbol: Glyph.symbol(notice.icon, filled: true), tone: notice.tone, sign: sign, selects: key, small: true))
                    }
                }
                return pins
            }
            + state.visibleRoutes.compactMap { route in
                route.start.map { MapPin(key: "r" + route.id, latitude: $0.latitude, longitude: $0.longitude, title: route.name, symbol: "figure.hiking", tone: .trail) }
            }
    }

    private var lines: [MapLine] {
        (trail.route.map { [MapLine(id: "trail", path: $0.coordinates.map(GeoPoint.init), color: PinTone.trail.css, width: 7)] } ?? [])
        // The affected stretch drawn on the road itself: in the hazard's colour on a white edge,
        // or as a red and white barrier when the road is closed.
        + state.traffic.filter { $0.path.count > 1 }.map { notice in
            let sign = TrafficSignKind.of(category: notice.categoryName, icon: notice.icon)
            return MapLine(id: "t" + notice.id, path: notice.path.map { GeoPoint(CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude)) },
                           color: sign.lineCSS, width: 7, casing: true, stripes: sign.striped)
        }
            + state.visibleRoutes.map { MapLine(id: "r" + $0.id, path: $0.coordinates.map(GeoPoint.init), color: PinTone.trail.css, width: state.route?.id == $0.id ? 6 : 4) }
            + (navigator.route.map { [MapLine(id: "way", path: $0.polyline.path, color: PinTone.pine.css, width: 7)] } ?? [])
    }

    private func look(_ move: CameraRequest.Move, animated: Bool = true) {
        camera = CameraRequest(id: camera.id + 1, move: move, animated: animated && !reduceMotion)
    }

    // MARK: Chrome

    /// The header over the map: the search and adding to the map on one row, the kinds to filter
    /// by under it.
    private var topBar: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Button { searching = true } label: {
                    HStack(spacing: 10) {
                        Text(L10n.Map.searchPlaceholder).type(.body, .ink3).lineLimit(1)
                        Spacer(minLength: 0)
                        Image(systemName: "magnifyingglass").font(.system(size: 15, weight: .semibold)).foregroundStyle(Color.onInk)
                            .frame(width: 38, height: 38).background(Color.brand, in: Circle())
                    }
                    .padding(.leading, 18)
                    .padding(.trailing, 5)
                    .frame(height: 48)
                    .background(Color.paper, in: Capsule())
                    .contentShape(Capsule())
                }
                .buttonStyle(Pressable(scale: 0.98))
                .accessibilityLabel(L10n.Map.searchLabel)
                ContributeButton()
            }
            .padding(.horizontal, Metrics.gutter)

            // With something in hand the filters step aside and give the map their room.
            if !selected { HeaderFilters {
                if state.filtering {
                    Button { withAnimation(Motion.quick) { vm.clearFilters() } } label: {
                        Image(systemName: "xmark").font(.system(size: 12, weight: .bold)).foregroundStyle(Color.brandDeep)
                            .frame(width: 34, height: 34).background(Color.onInk, in: Circle()).frame(minHeight: 44)
                    }
                    .buttonStyle(Pressable())
                    .accessibilityLabel(L10n.Map.clearFilters)
                    .transition(.scale.combined(with: .opacity))
                }
                if !state.routes.isEmpty {
                    Chip(title: L10n.Map.routes, symbol: "figure.hiking", selected: state.routesSelected, onBrand: true) { vm.toggleRoutes() }
                }
                ForEach(state.categories, id: \.id) { category in
                    Chip(title: category.name, symbol: Glyph.symbol(category.icon), selected: state.selectedCategories.contains(category.id), onBrand: true) { vm.toggleCategory(id: category.id) }
                }
            }
            .accessibilityLabel(L10n.Map.filterPlaces)
            .animation(Motion.quick, value: state.filtering)
                .transition(.opacity)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 4)
        .padding(.bottom, 8)
        .animation(reduceMotion ? nil : Motion.quick, value: selected)
        .brandHeader()
        // The map's top inset keeps the full header height while the filters step aside for a
        // selection: shrinking it would shift the map in one unanimated step before the camera
        // glides, which reads as a jump.
        .onGeometryChange(for: CGFloat.self) { $0.frame(in: .global).maxY } action: { if !selected { headerBottom = $0 } }
    }

    private var controls: some View {
        VStack(spacing: 10) {
            // Flat or in relief: the label says what a tap switches to.
            IconButton(symbol: threeD ? "map" : "view.3d", label: threeD ? L10n.Map.view2d : L10n.Map.view3d, floating: true) {
                threeD.toggle()
                if let viewport {
                    look(.region(center: GeoPoint(CLLocationCoordinate2D(latitude: (viewport.north + viewport.south) / 2, longitude: (viewport.east + viewport.west) / 2)),
                                 latitudeSpan: viewport.latitudeSpan, longitudeSpan: viewport.east - viewport.west))
                }
            }
            IconButton(symbol: following ? "location.fill" : "location", label: L10n.Map.locate, floating: true) {
                if location.authorizationStatus == .notDetermined { location.requestWhenInUseAuthorization() }
                look(.user)
            }
        }
        .sensoryFeedback(.selection, trigger: threeD)
        .padding(16)
    }

    // MARK: Selection and camera

    private var selected: Bool { if case .none = onEnum(of: state.selection) { false } else { true } }

    private var selectionKey: String {
        switch onEnum(of: state.selection) {
        case .none: ""
        case .place(let place): "p" + place.sheet.place.id
        case .route(let route): "r" + route.route.id
        case .traffic(let traffic): "t" + traffic.id
        }
    }

    private func dismissSelection() {
        switch onEnum(of: state.selection) {
        case .none: break
        case .place: vm.dismissSheet()
        case .route: vm.dismissRoute()
        case .traffic: vm.dismissTraffic()
        }
    }

    /// Bring what was picked into the upper half, above its sheet.
    private func focusSelection() {
        switch onEnum(of: state.selection) {
        case .none: break
        case .place(let place): focus(place.sheet.place.coordinate)
        case .traffic(let traffic): if let notice = state.traffic.first(where: { $0.id == traffic.id }) { focus(notice.coordinate) }
        case .route(let route): frame(route.route.coordinates, lower: true)
        }
    }

    /// How much of the map's bottom the resting sheet covers, in points.
    private static let sheetCover: Double = 420
    /// How much the route preview's trip card covers.
    private static let previewCover: Double = 250

    /// Points between the middle of the region MapKit centres (inside its safe area) and the
    /// middle of the map left uncovered by the header and, when `covered`, the sheet.
    private func lift(covered: Bool) -> Double { lift(cover: covered ? Self.sheetCover : 0) }

    private func lift(cover: Double) -> Double { (cover - Double(mapBottomInset + cardInset)) / 2 }

    /// Glide so the point sits midway between the header and the resting sheet's top edge.
    private func focus(_ point: CLLocationCoordinate2D) {
        let span = min(viewport?.latitudeSpan ?? 0.02, 0.012)
        // A square span is fitted to the map's width (the narrow side), so one point there is
        // span × cos(latitude) / width degrees of latitude.
        let perPoint = span * cos(point.latitude * .pi / 180) / Double(max(mapWidth, 1))
        let center = CLLocationCoordinate2D(latitude: point.latitude - lift(covered: true) * perPoint, longitude: point.longitude)
        look(.region(center: GeoPoint(center), latitudeSpan: span, longitudeSpan: span))
    }

    /// Fit the points into the map left uncovered: below the header, above the resting sheet
    /// when `lower`, with room at the edges for a pin standing on its point and its name.
    private func frame(_ points: [CLLocationCoordinate2D], lower: Bool = false) {
        frame(points, cover: lower ? Self.sheetCover : nil)
    }

    /// `cover` is how much of the map's bottom a sheet or card hides; nil leaves only the tab bar.
    private func frame(_ points: [CLLocationCoordinate2D], cover: Double?) {
        let lats = points.map(\.latitude), lngs = points.map(\.longitude)
        guard let minLat = lats.min(), let maxLat = lats.max(), let minLng = lngs.min(), let maxLng = lngs.max() else { return }
        let header = Double(routing ? statusInset : headerHeight)
        let scale = cos((minLat + maxLat) / 2 * .pi / 180)
        let safeHeight = max(Double(mapHeight) - header - Double(mapBottomInset + cardInset), 1), width = Double(max(mapWidth, 1))
        let open = Double(mapHeight) - header - (cover ?? Double(mapBottomInset))
        // Room at the sides for a pin's name, which runs wider than the pin.
        let usableHeight = max(open - 2 * 56, 80), usableWidth = max(width - 2 * 72, 80)
        // Degrees of latitude per point: whichever side is tighter decides, never closer than
        // about a town block.
        let perPoint = max((maxLat - minLat) / usableHeight, (maxLng - minLng) * scale / usableWidth, 0.004 / safeHeight)
        let center = CLLocationCoordinate2D(latitude: (minLat + maxLat) / 2 - lift(cover: cover ?? 0) * perPoint, longitude: (minLng + maxLng) / 2)
        look(.region(center: GeoPoint(center), latitudeSpan: perPoint * safeHeight, longitudeSpan: perPoint * width / scale))
    }

    /// Walk the route stop by stop, from wherever the walker is on it.
    private func walk(_ route: EcoRoute, _ stops: [TrailStop]) {
        if beforeRoute == nil { beforeRoute = viewport }
        dismissSelection()
        trail.start(route, stops: stops)
        frame(route.coordinates, cover: Self.previewCover)
    }

    private func navigate(_ destination: Destination) {
        if beforeRoute == nil { beforeRoute = viewport }
        routeTarget = picked
        dismissSelection()
        Task { await navigator.plan(to: destination) }
    }
}
