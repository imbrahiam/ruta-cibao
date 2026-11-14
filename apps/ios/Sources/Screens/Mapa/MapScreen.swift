import MapKit
import RutaKit
import SwiftUI

typealias EcoRoute = RoutesBrowseOutput.Item

extension MapPlace {
    var coordinate: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: latitude, longitude: longitude) }
    /// The admin colour folded onto the palette, so the map shares the app's colours.
    var tint: Color { Tint.of(hex: color).solid }
}

extension EcoRoute {
    var coordinates: [CLLocationCoordinate2D] { path.map { CLLocationCoordinate2D(latitude: $0.lat, longitude: $0.lng) } }
    var start: CLLocationCoordinate2D? { coordinates.first }
}

extension TrafficNotice {
    var coordinate: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: latitude, longitude: longitude) }
    var tint: Color { severity == .blocking ? .danger : .warning }
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
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var camera: MapCameraPosition = .region(MKCoordinateRegion(center: CLLocationCoordinate2D(latitude: 19.4772, longitude: -71.3414), latitudinalMeters: 2600, longitudinalMeters: 2600))
    @State private var region: MKCoordinateRegion?
    @State private var mapHeight: CGFloat = 700
    @State private var satellite = false
    /// The system marker in hand, keyed like `selectionKey`. MapKit owns the tap and the lift.
    @State private var picked: String?
    @State private var searching = DebugHook.value("RUTA_DEBUG_COMPOSE") == "search"
    @State private var afterSearch: (() -> Void)?
    @State private var navigator = RouteNavigator()
    @State private var framed = false
    @State private var location = CLLocationManager()

    private var state: MapUiState { model.state }
    private var vm: MapViewModel { model.vm }
    private var routing: Bool { navigator.phase != .idle }
    private var guiding: Bool { navigator.phase == .navigating || navigator.phase == .arrived }

    /// Pins that would sit on top of each other give way until the zoom separates them.
    private var places: [MapPlace] {
        guard let region else { return state.places }
        let cell = region.span.latitudeDelta * 46 / Double(max(mapHeight, 1))
        return Clustering.shared.declutter(places: state.places, cellLatitude: cell, cellLongitude: cell, keep: state.sheet?.place.id)
    }

    var body: some View {
        map
            .overlay(alignment: .top) { if !routing { topBar.transition(.move(edge: .top).combined(with: .opacity)) } }
            .overlay(alignment: .bottomTrailing) { if !routing { controls.transition(.opacity) } }
            .overlay(alignment: .bottom) {
                if routing, !guiding { RoutePreview(navigator: navigator).transition(.move(edge: .bottom).combined(with: .opacity)) }
            }
            .overlay { if guiding { Guidance(navigator: navigator).hidesTabBar().transition(.opacity) } }
            .overlay {
                if state.phase == .failed {
                    StateView(error: state.error ?? .unknown) { vm.retry() }
                        .frame(maxWidth: 320, maxHeight: 280)
                        .floating(in: RoundedRectangle(cornerRadius: Metrics.radiusPanel, style: .continuous))
                }
            }
            .animation(reduceMotion ? nil : Motion.settle, value: navigator.phase)
            .sheet(isPresented: Binding(get: { selected && !routing && !searching }, set: { if !$0 { dismissSelection() } })) {
                SelectionSheet(model: model, close: dismissSelection, directions: navigate)
            }
            // A result opens once search has fully left: presenting the next sheet while this
            // one is still dismissing with the keyboard up crashes UIKit's keyboard layout guide.
            .sheet(isPresented: $searching, onDismiss: { afterSearch?(); afterSearch = nil }) {
                MapSearch(places: state.all, routes: state.routes, municipalities: state.municipalities, categories: state.categories,
                          pickCategory: { category in afterSearch = { vm.clearFilters(); vm.toggleCategory(id: category.id) }; searching = false },
                          pickPlace: { place in afterSearch = { vm.select(placeId: place.id) }; searching = false },
                          pickRoute: { route in afterSearch = { vm.selectRoute(id: route.id) }; searching = false })
            }
            .fullScreenCover(isPresented: Binding(get: { state.signInRequested }, set: { if !$0 { vm.signInHandled() } })) { SignInScreen() }
            .onAppear { vm.setMapVisible(visible: true) }
            .onDisappear { vm.setMapVisible(visible: false) }
            .task {
                // Open where the person is when the phone already knows; otherwise on the town centre.
                guard !framed, state.sheet == nil, let here = await CurrentLocation.once(timeout: .seconds(2)) else { return }
                framed = true
                if !selected { camera = .region(MKCoordinateRegion(center: here, latitudinalMeters: 2200, longitudinalMeters: 2200)) }
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
                let rect = route.polyline.boundingMapRect
                let pad = max(rect.size.width, rect.size.height) * 0.35
                withAnimation(reduceMotion ? nil : .smooth(duration: 0.6)) {
                    camera = .rect(rect.insetBy(dx: -pad, dy: -pad * 1.6).offsetBy(dx: 0, dy: pad * 0.6))
                }
            }
            .onChange(of: navigator.location) { _, here in
                guard navigator.phase == .navigating, let here else { return }
                withAnimation(.linear(duration: 0.9)) {
                    camera = .camera(MapCamera(centerCoordinate: here.coordinate, distance: navigator.mode == .drive ? 700 : 320, heading: navigator.course, pitch: 55))
                }
            }
    }

    // MARK: Map

    private var map: some View {
        Map(position: $camera, selection: $picked) {
            ForEach(places, id: \.id) { place in
                Marker(place.name, systemImage: Glyph.symbol(place.icon, filled: true), coordinate: place.coordinate)
                    .tint(place.tint)
                    .tag("p" + place.id)
            }
            ForEach(state.traffic, id: \.id) { notice in
                if notice.path.count > 1 {
                    MapPolyline(coordinates: notice.path.map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) })
                        .stroke(notice.tint, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                }
                Marker(notice.categoryName, systemImage: Glyph.symbol(notice.icon, filled: true), coordinate: notice.coordinate)
                    .tint(notice.tint)
                    .tag("t" + notice.id)
            }
            ForEach(state.visibleRoutes, id: \.id) { route in
                MapPolyline(coordinates: route.coordinates)
                    .stroke(Color.success, style: StrokeStyle(lineWidth: state.route?.id == route.id ? 6 : 4, lineCap: .round, lineJoin: .round))
                if let start = route.start {
                    Marker(route.name, systemImage: "figure.hiking", coordinate: start)
                        .tint(Color.success)
                        .tag("r" + route.id)
                }
            }
            if let route = navigator.route {
                MapPolyline(route.polyline).stroke(Color.ink, style: StrokeStyle(lineWidth: 7, lineCap: .round, lineJoin: .round))
            }
            UserAnnotation()
        }
        .mapStyle(satellite ? .hybrid(elevation: .flat, pointsOfInterest: .excludingAll) : .standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll))
        .mapControls { MapCompass() }
        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { mapHeight = $0 }
        .onMapCameraChange(frequency: .onEnd) { context in
            region = context.region
            let box = context.region
            vm.onViewportChanged(
                west: box.center.longitude - box.span.longitudeDelta / 2, south: box.center.latitude - box.span.latitudeDelta / 2,
                east: box.center.longitude + box.span.longitudeDelta / 2, north: box.center.latitude + box.span.latitudeDelta / 2
            )
        }
        .ignoresSafeArea(edges: .top)
    }

    // MARK: Chrome

    private var topBar: some View {
        VStack(spacing: 10) {
            Button { searching = true } label: {
                HStack(spacing: 10) {
                    Image(systemName: "magnifyingglass").font(.system(size: 16))
                    Text(L10n.Map.searchPlaceholder).type(.body, .ink2)
                    Spacer(minLength: 0)
                }
                .foregroundStyle(Color.ink)
                .padding(.horizontal, 18)
                .frame(height: 52)
                .glassEffect(.regular.interactive(), in: Capsule())
            }
            .buttonStyle(Pressable(scale: 0.98))
            .accessibilityLabel(L10n.Map.searchLabel)
            .frame(maxWidth: 440)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)

            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    if state.filtering {
                        Button { withAnimation(Motion.quick) { vm.clearFilters() } } label: {
                            Image(systemName: "xmark").font(.system(size: 13, weight: .medium)).foregroundStyle(Color.onInk)
                                .frame(width: 38, height: 38).glassEffect(.regular.tint(Color.action).interactive(), in: Circle())
                        }
                        .buttonStyle(Pressable())
                        .accessibilityLabel(L10n.Map.clearFilters)
                        .transition(.scale.combined(with: .opacity))
                    }
                    if !state.routes.isEmpty {
                        Chip(title: L10n.Map.routes, symbol: "figure.hiking", selected: state.routesSelected, glass: true) { vm.toggleRoutes() }
                    }
                    ForEach(state.categories, id: \.id) { category in
                        Chip(title: category.name, symbol: Glyph.symbol(category.icon), selected: state.selectedCategories.contains(category.id), glass: true) { vm.toggleCategory(id: category.id) }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 4)
            }
            .scrollIndicators(.hidden)
            .accessibilityLabel(L10n.Map.filterPlaces)
            .animation(Motion.quick, value: state.filtering)
        }
        .padding(.top, 6)
    }

    private var controls: some View {
        VStack(spacing: 10) {
            IconButton(symbol: satellite ? "map" : "globe.americas", label: satellite ? L10n.MapLayers.standard : L10n.MapLayers.satellite, floating: true) {
                withAnimation(Motion.quick) { satellite.toggle() }
            }
            IconButton(symbol: camera.followsUserLocation ? "location.fill" : "location", label: L10n.Map.locate, floating: true) {
                if location.authorizationStatus == .notDetermined { location.requestWhenInUseAuthorization() }
                withAnimation(reduceMotion ? nil : .smooth(duration: 0.55)) { camera = .userLocation(fallback: camera) }
            }
        }
        .padding(16)
        .sensoryFeedback(.impact(weight: .light), trigger: satellite)
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

    private func focus(_ point: CLLocationCoordinate2D) {
        let span = min(region?.span.latitudeDelta ?? 0.02, 0.012)
        let center = CLLocationCoordinate2D(latitude: point.latitude - span * 0.22, longitude: point.longitude)
        withAnimation(reduceMotion ? nil : .smooth(duration: 0.5)) {
            camera = .region(MKCoordinateRegion(center: center, span: MKCoordinateSpan(latitudeDelta: span, longitudeDelta: span)))
        }
    }

    private func frame(_ points: [CLLocationCoordinate2D], lower: Bool = false) {
        let lats = points.map(\.latitude), lngs = points.map(\.longitude)
        guard let minLat = lats.min(), let maxLat = lats.max(), let minLng = lngs.min(), let maxLng = lngs.max() else { return }
        let latSpan = max(0.008, (maxLat - minLat) * (lower ? 2.2 : 1.25)), lngSpan = max(0.008, (maxLng - minLng) * 1.25)
        let center = CLLocationCoordinate2D(latitude: (minLat + maxLat) / 2 - (lower ? latSpan * 0.2 : 0), longitude: (minLng + maxLng) / 2)
        withAnimation(reduceMotion ? nil : .smooth(duration: 0.6)) {
            camera = .region(MKCoordinateRegion(center: center, span: MKCoordinateSpan(latitudeDelta: latSpan, longitudeDelta: lngSpan)))
        }
    }

    private func navigate(_ destination: Destination) {
        dismissSelection()
        Task { await navigator.plan(to: destination) }
    }
}
