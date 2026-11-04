import MapKit
import Observation
import RutaKit
import SwiftUI

@Observable
final class MapModel {
    private(set) var state: MapUiState
    @ObservationIgnored private let scope: ScreenScope
    @ObservationIgnored let viewModel: MapViewModel

    init(graph: AppGraph) {
        scope = ScreenScope(graph: graph)
        viewModel = scope.map()
        state = viewModel.state.value
    }

    func observe() async {
        for await next in viewModel.state { state = next }
    }

    isolated deinit { scope.close() }
}

/// The province on one screen. Our places carry the map (Apple's POIs are
/// off); far out they are dots, closer in they become pins with their glyph.
struct MapScreen: View {
    @Environment(\.graph) private var graph
    @State private var model: MapModel?

    var body: some View {
        Group {
            if let model {
                MapContent(model: model)
            } else {
                Color.clear
            }
        }
        .task {
            guard let graph else { return }
            let model = self.model ?? MapModel(graph: graph)
            self.model = model
            await model.observe()
        }
    }
}

private enum Province {
    /// Santiago Rodríguez (`packages/shared/src/geo.ts` PROVINCE_BOUNDS).
    static let region = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 19.369, longitude: -71.296),
        span: MKCoordinateSpan(latitudeDelta: 0.46, longitudeDelta: 0.50)
    )
}

private struct MapContent: View {
    let model: MapModel
    @Environment(\.palette) private var palette
    @State private var camera: MapCameraPosition = .region(Province.region)
    @State private var region: MKCoordinateRegion = Province.region
    @State private var framed = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var searching = Self.debugSearch
    @Namespace private var glass
    /// Search asked for while a place or route sheet was up: SwiftUI shows one
    /// sheet at a time, so that one closes first and search opens after.
    @State private var searchAfterSheet = false
    /// Satellite with roads on top: where Apple has no land cover (most of
    /// the province), the photo is the colourful map.
    @State private var satellite = false
    @State private var cameraMode = Self.debugCamera
    @State private var debugTrafficDone = false
    @State private var navigator = RouteNavigator()
    @Environment(DeepLinks.self) private var links
    @Environment(AppChrome.self) private var chrome
    private var routing: Bool { navigator.phase != .idle }

    /// Debug-only: `SIMCTL_CHILD_RUTA_DEBUG_COMPOSE=camera` opens camera mode.
    private static var debugCamera: Bool {
        #if DEBUG
        return ProcessInfo.processInfo.environment["RUTA_DEBUG_COMPOSE"] == "camera"
        #else
        return false
        #endif
    }


    /// Debug-only: `SIMCTL_CHILD_RUTA_DEBUG_COMPOSE=search` opens search (screenshot runs).
    private static var debugSearch: Bool {
        #if DEBUG
        return ProcessInfo.processInfo.environment["RUTA_DEBUG_COMPOSE"] == "search"
        #else
        return false
        #endif
    }
    @State private var location = CLLocationManager()

    private var state: MapUiState { model.state }
    private var vm: MapViewModel { model.viewModel }

    /// Google Maps-style: a few well-spaced places at first, more as you zoom.
    /// About 6×10 cells on screen, one place per cell; the selection always stays.
    /// The cell snaps to a power-of-two zoom step, so panning (which nudges the
    /// span a little each time) keeps the same grid and the same places; only
    /// a real zoom changes what shows.
    private var visible: [MapPlace] {
        let cell = pow(2, (log2(max(region.span.latitudeDelta, 0.0005) / 10)).rounded())
        return Clustering.shared.declutter(
            places: state.places,
            cellLatitude: cell,
            cellLongitude: cell * 1.6,
            keep: state.sheet?.place.id
        )
    }

    /// The closest a tap will take you: a block or two, still readable.
    private static let closest: CLLocationDegrees = 0.0045

    var body: some View {
        Map(position: $camera, interactionModes: routing ? .all : [.pan, .zoom, .rotate], selection: selectionBinding) {
            // Routes under the pins: the line, then its start as a marker.
            ForEach(state.visibleRoutes, id: \.id) { route in
                MapPolyline(coordinates: route.coordinates)
                    .stroke(route.tint.opacity(state.route?.id == route.id ? 1 : 0.75), style: StrokeStyle(lineWidth: state.route?.id == route.id ? 6 : 4, lineCap: .round, lineJoin: .round))
                if let start = route.start {
                    Marker(route.name, systemImage: route.symbol, coordinate: start)
                        .tint(route.tint)
                        .tag(Self.routeTag(route.id))
                }
            }
            // Apple's own Marker balloons: native selection (the balloon
            // grows), label placement and VoiceOver, tinted by category.
            if let route = navigator.route {
                MapPolyline(route.polyline)
                    .stroke(palette.locate, style: StrokeStyle(lineWidth: 7, lineCap: .round, lineJoin: .round))
            }
            // Road reports over the routes, under the pins; never clustered with places.
            ForEach(state.traffic, id: \.id) { notice in
                if !notice.path.isEmpty {
                    MapPolyline(coordinates: notice.pathCoordinates)
                        .stroke(notice.style.color.opacity(0.85), style: StrokeStyle(lineWidth: notice.lineWidth, lineCap: .round, lineJoin: .round))
                }
                Annotation("", coordinate: notice.coordinate, anchor: .center) {
                    TrafficMarker(notice: notice, selected: state.selectedTraffic?.id == notice.id)
                }
                .tag(Self.trafficTag(notice.id))
            }
            ForEach(visible, id: \.id) { place in
                Marker(place.name, systemImage: CategoryGlyph.symbol(place.icon), coordinate: place.coordinate)
                    .tint(CategoryGlyph.style(place.icon, hex: place.color).color)
                    .tag(place.id)
            }
            UserAnnotation()
        }
        // "You are here" in the system blue (status token), never the theme accent.
        .tint(palette.locate)
        // Apple's full-colour map, flat (2D) by default: the province has no
        // 3D data, and only navigation tilts the camera. Of Apple's own POIs
        // only green and blue places show, so ours still carry the map.
        .mapStyle(satellite
            ? .hybrid(elevation: .flat, pointsOfInterest: .excludingAll, showsTraffic: false)
            : .standard(elevation: .flat, emphasis: .automatic, pointsOfInterest: .including([.park, .nationalPark, .beach]), showsTraffic: false))
        .mapControls {
            MapCompass()
            MapScaleView()
        }
        .overlay(alignment: .bottomTrailing) {
            if !routing {
            // Apple Maps' control stack: one glass capsule, the icons stacked.
            VStack(spacing: 0) {
                MapRoundButton(symbol: "camera.viewfinder", label: L10n.Map.camera, active: false) { cameraMode = true }
                MapRoundButton(symbol: satellite ? "map.fill" : "globe.americas.fill", label: satellite ? L10n.MapLayers.standard : L10n.MapLayers.satellite, active: false) {
                    withAnimation(.snappy) { satellite.toggle() }
                }
                LocateButton(active: camera.followsUserLocation) {
                    if location.authorizationStatus == .notDetermined { location.requestWhenInUseAuthorization() }
                    withAnimation(reduceMotion ? nil : .smooth(duration: 0.55)) {
                        camera = .userLocation(fallback: camera)
                    }
                }
            }
            .padding(.vertical, 4)
            .glassEffect(.regular.interactive(), in: Capsule())
            .padding(16)
            }
        }
        .onMapCameraChange(frequency: .onEnd) { context in
            region = context.region
            let box = context.region
            vm.onViewportChanged(
                west: box.center.longitude - box.span.longitudeDelta / 2,
                south: box.center.latitude - box.span.latitudeDelta / 2,
                east: box.center.longitude + box.span.longitudeDelta / 2,
                north: box.center.latitude + box.span.latitudeDelta / 2
            )
        }
        #if DEBUG
        // `SIMCTL_CHILD_RUTA_DEBUG_TRAFFIC=select|still` opens the first road report that isn't yours,
        // and `still` also answers "Sigue ahí" (screenshot runs).
        .onChange(of: state.traffic.count, initial: true) { _, _ in
            guard !debugTrafficDone, let hook = ProcessInfo.processInfo.environment["RUTA_DEBUG_TRAFFIC"],
                  let notice = state.traffic.first(where: { !$0.isMine && $0.myVerdict == nil }) else { return }
            debugTrafficDone = true
            vm.selectTraffic(id: notice.id)
            focus(latitude: notice.latitude, longitude: notice.longitude)
            if hook == "still" {
                Task { try? await Task.sleep(for: .seconds(5)); vm.confirmTraffic(verdict: .still) }
            }
        }
        #endif
        .onAppear { vm.setMapVisible(visible: true) }
        .onDisappear { vm.setMapVisible(visible: false) }
        .safeAreaInset(edge: .top) { if !routing { topBar } }
        .overlay(alignment: .bottom) {
            if navigator.phase == .loading || navigator.phase == .preview || { if case .failed = navigator.phase { return true }; return false }() {
                RoutePreviewCard(navigator: navigator)
                    .padding(.bottom, 8)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .overlay {
            if navigator.phase == .navigating || navigator.phase == .arrived {
                NavigationChrome(navigator: navigator).transition(.opacity)
            }
        }
        .animation(.snappy, value: navigator.phase)
        .onChange(of: navigator.phase) { _, phase in
            chrome.immersive = phase == .navigating || phase == .arrived
            #if DEBUG
            // `RUTA_DEBUG_COMPOSE=navigate`: start as soon as the route is ready.
            if phase == .preview, ProcessInfo.processInfo.environment["RUTA_DEBUG_COMPOSE"] == "navigate" { navigator.start() }
            #endif
            if phase == .navigating, let here = navigator.location { follow(here) }
        }
        // A link to a place or route opens it once the map has its data.
        .onChange(of: links.pending, initial: true) { _, _ in openLinkedItem() }
        .onChange(of: state.all.count) { _, _ in openLinkedItem() }
        .onChange(of: state.routes.count) { _, _ in openLinkedItem() }
        .onChange(of: navigator.route) { _, route in
            guard let route, navigator.phase != .navigating else { return }
            let rect = route.polyline.boundingMapRect
            let pad = max(rect.size.width, rect.size.height) * 0.35
            withAnimation(reduceMotion ? nil : .smooth(duration: 0.6)) {
                camera = .rect(rect.insetBy(dx: -pad, dy: -pad * 1.6).offsetBy(dx: 0, dy: pad * 0.6))
            }
        }
        .onChange(of: navigator.location) { _, here in
            if navigator.phase == .navigating, let here { follow(here) }
        }
        .overlay {
            if state.phase == .failed {
                ErrorStateView(error: state.error ?? .unknown) { vm.retry() }
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
                    .padding(32)
            }
        }
        .sheet(isPresented: sheetBinding, onDismiss: openPendingSearch) {
            if let sheet = state.sheet {
                let compact = PresentationDetent.height(PlaceSheetView.compactHeight(hasPhoto: sheet.place.thumbnailUrl != nil || sheet.detail?.imageUrl != nil))
                PlaceSheetView(
                    sheet: sheet,
                    save: { vm.toggleSaved() },
                    directions: { navigate(to: Destination(name: sheet.place.name, coordinate: sheet.place.coordinate)) },
                    requestClaim: { vm.requestClaim() },
                    refreshBusiness: { vm.refreshBusiness() }
                )
                    .presentationDetents([compact, .large])
                    .presentationBackgroundInteraction(.enabled(upThrough: compact))
                    .presentationDragIndicator(.visible)
            }
        }
        .sheet(isPresented: trafficSheetBinding, onDismiss: openPendingSearch) {
            if let notice = state.selectedTraffic {
                TrafficSheetView(notice: notice, failure: state.trafficError) { vm.confirmTraffic(verdict: $0) }
                    .presentationDetents([.height(TrafficSheetView.height), .large])
                    .presentationBackgroundInteraction(.enabled(upThrough: .height(TrafficSheetView.height)))
                    .presentationDragIndicator(.visible)
            }
        }
        .fullScreenCover(isPresented: $cameraMode) {
            CameraMode(places: state.all) { place in
                focus(on: place)
                vm.select(placeId: place.id)
            }
        }
        .sheet(isPresented: routeSheetBinding, onDismiss: openPendingSearch) {
            if let route = state.route {
                RouteSheetView(route: route) {
                    if let start = route.start { navigate(to: Destination(name: route.name, coordinate: start)) }
                }
                    .presentationDetents([.height(300), .large])
                    .presentationBackgroundInteraction(.enabled(upThrough: .height(300)))
                    .presentationDragIndicator(.visible)
            }
        }
        .sheet(isPresented: $searching) {
            MapSearch(
                places: state.all,
                routes: state.routes,
                categories: state.categories,
                municipalities: state.municipalities,
                pickPlace: { place in
                    searching = false
                    focus(on: place)
                    vm.select(placeId: place.id)
                },
                pickRoute: { route in
                    searching = false
                    show(route)
                }
            )
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
        }
        .fullScreenCover(isPresented: Binding(
            get: { state.signInRequested },
            set: { if !$0 { vm.signInHandled() } }
        )) { SignInScreen() }
        // No prompt on appear: the first-run primer asks; tapping "find me"
        // asks in context if the person skipped it.
        // Once, when places first arrive: frame where they are, not the whole province.
        .onChange(of: state.all.count, initial: true) { _, count in
            guard count > 0, !framed else { return }
            framed = true
            #if DEBUG
            // `SIMCTL_CHILD_RUTA_DEBUG_COMPOSE=route`: plan a route on launch (screenshot runs).
            if ["route", "navigate"].contains(ProcessInfo.processInfo.environment["RUTA_DEBUG_COMPOSE"] ?? ""),
               let target = state.all.first(where: { $0.name.contains("Monción") }) ?? state.all.last {
                navigate(to: Destination(name: target.name, coordinate: target.coordinate))
            }
            #endif
            let fit = Self.fit(state.all)
            camera = .region(fit)
        }

    }

    private static func routeTag(_ id: String) -> String { "route:\(id)" }
    private static func trafficTag(_ id: String) -> String { "traffic:\(id)" }

    private func openLinkedItem() {
        switch links.pending {
        case .place(let slug):
            guard let place = state.all.first(where: { $0.slug == slug }) else { return }
            links.pending = nil
            vm.select(placeId: place.id)
            focus(on: place)
        case .route(let id):
            guard let route = state.routes.first(where: { $0.id == id }) else { return }
            links.pending = nil
            show(route)
        case .map:
            links.pending = nil
        default:
            break
        }
    }

    /// Close the sheet and plan in-app turn-by-turn to the destination.
    private func navigate(to destination: Destination) {
        vm.dismissSheet()
        vm.dismissRoute()
        Task { await navigator.plan(to: destination) }
    }

    /// Navigation camera: close, pitched, turned to where you're heading.
    private func follow(_ here: CLLocation) {
        let distance: CLLocationDistance = navigator.mode == .drive ? 700 : 320
        withAnimation(reduceMotion ? nil : .linear(duration: 0.9)) {
            camera = .camera(MapCamera(centerCoordinate: here.coordinate, distance: distance, heading: navigator.course, pitch: 58))
        }
    }


    private var selectionBinding: Binding<String?> {
        Binding(get: { state.sheet?.place.id ?? state.route.map { Self.routeTag($0.id) } ?? state.selectedTraffic.map { Self.trafficTag($0.id) } }, set: { id in
            if let id, id.hasPrefix("traffic:"), let notice = state.traffic.first(where: { Self.trafficTag($0.id) == id }) {
                vm.selectTraffic(id: notice.id)
                focus(latitude: notice.latitude, longitude: notice.longitude)
            } else if let id, id.hasPrefix("route:"), let route = state.routes.first(where: { Self.routeTag($0.id) == id }) {
                show(route)
            } else if let id, let place = state.all.first(where: { $0.id == id }) {
                vm.select(placeId: id)
                focus(on: place)
            } else {
                vm.dismissSheet()
                vm.dismissRoute()
                vm.dismissTraffic()
            }
        })
    }

    private var trafficSheetBinding: Binding<Bool> {
        Binding(get: { state.selectedTraffic != nil }, set: { if !$0 { vm.dismissTraffic() } })
    }

    private var routeSheetBinding: Binding<Bool> {
        Binding(get: { state.route != nil }, set: { if !$0 { vm.dismissRoute() } })
    }

    /// Select a route and frame its whole line above the sheet.
    private func show(_ route: EcoRoute) {
        vm.selectRoute(id: route.id)
        withAnimation(reduceMotion ? nil : .smooth(duration: 0.55)) {
            camera = .region(route.region)
        }
    }

    private var sheetBinding: Binding<Bool> {
        Binding(get: { state.sheet != nil }, set: { if !$0 { vm.dismissSheet() } })
    }

    /// Where to open: the densest town at street level, where pins show their
    /// glyphs. The province's towns are ~35 km apart east to west; framing
    /// them all on a tall screen leaves the pins as specks.
    private static func fit(_ places: [MapPlace]) -> MKCoordinateRegion {
        let town = Clustering.shared.cluster(places: places, cellLatitude: 0.05, cellLongitude: 0.05)
            .max { $0.count < $1.count }
        guard let town else { return Province.region }
        return MKCoordinateRegion(center: town.coordinate, latitudinalMeters: 3200, longitudinalMeters: 3200)
    }

    /// Zoom toward a place: each tap gets closer (a third of the current span),
    /// down to `closest`, and it never zooms out. The place sits above the sheet.
    private func focus(on place: MapPlace) { focus(latitude: place.latitude, longitude: place.longitude) }

    private func focus(latitude: Double, longitude: Double) {
        let current = region.span.latitudeDelta
        let span = current <= Self.closest ? current : max(Self.closest, current / 3)
        let target = CLLocationCoordinate2D(latitude: latitude - span * 0.18, longitude: longitude)
        let ratio = region.span.longitudeDelta / max(region.span.latitudeDelta, 0.0001)
        withAnimation(reduceMotion ? nil : .smooth(duration: 0.55)) {
            camera = .region(MKCoordinateRegion(center: target, span: MKCoordinateSpan(latitudeDelta: span, longitudeDelta: span * ratio)))
        }
    }

    private func startSearch() {
        if state.sheet != nil || state.route != nil || state.selectedTraffic != nil {
            searchAfterSheet = true
            vm.dismissSheet()
            vm.dismissRoute()
            vm.dismissTraffic()
        } else {
            searching = true
        }
    }

    private func openPendingSearch() {
        guard searchAfterSheet else { return }
        searchAfterSheet = false
        searching = true
    }

    private var topBar: some View {
        VStack(spacing: 10) {
            // One glass group: the reset button grows out of the search bar
            // when a filter is on and melts back into it when cleared.
            GlassEffectContainer(spacing: 10) {
                HStack(spacing: 10) {
                    Button(action: startSearch) {
                        HStack(spacing: 10) {
                            Image(systemName: "magnifyingglass").font(.body.weight(.semibold)).foregroundStyle(palette.text)
                            Text(L10n.Map.searchPlaceholder).font(.body.weight(.medium)).foregroundStyle(palette.text).lineLimit(1)
                            Spacer(minLength: 0)
                        }
                        .font(.body)
                        .padding(.horizontal, 18)
                        .frame(height: 52)
                        .contentShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .glassEffect(.regular.interactive(), in: Capsule())
                    .glassEffectID("search", in: glass)
                    .accessibilityLabel(L10n.Map.searchLabel)

                    if state.filtering {
                        Button { withAnimation(reduceMotion ? nil : .snappy) { vm.clearFilters() } } label: {
                            Image(systemName: "xmark")
                                .font(.system(size: 17, weight: .semibold))
                                .foregroundStyle(palette.text)
                                .frame(width: 52, height: 52)
                                .contentShape(Circle())
                        }
                        .buttonStyle(.plain)
                        .glassEffect(.regular.interactive(), in: Circle())
                        .glassEffectID("reset", in: glass)
                        .accessibilityLabel(L10n.Map.clearFilters)
                        .sensoryFeedback(.impact(weight: .light), trigger: state.filtering)
                    }
                }
                .animation(reduceMotion ? nil : .snappy, value: state.filtering)
            }
            .padding(.horizontal, 16)

            CategoryChips(
                categories: state.categories,
                selected: Set(state.selectedCategories),
                hasRoutes: !state.routes.isEmpty,
                routesOnly: state.routesSelected,
                toggleRoutes: { vm.toggleRoutes() }
            ) { vm.toggleCategory(id: $0) }
        }
        .padding(.top, 4)
    }
}

/// One control in the map's glass stack: ink glyph, blue and selected when
/// its mode is on.
private struct MapRoundButton: View {
    let symbol: String
    let label: String
    let active: Bool
    let action: () -> Void
    @Environment(\.palette) private var palette

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(active ? palette.locate : palette.text)
                .contentTransition(.symbolEffect(.replace))
                .frame(width: 50, height: 48)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityAddTraits(active ? .isSelected : [])
    }
}

/// Find me: the arrow in ink, blue and filled once the map follows you.
private struct LocateButton: View {
    let active: Bool
    let action: () -> Void
    @Environment(\.palette) private var palette

    var body: some View {
        Button(action: action) {
            Image(systemName: active ? "location.fill" : "location")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(active ? palette.locate : palette.text)
                .contentTransition(.symbolEffect(.replace))
                .frame(width: 50, height: 48)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(L10n.Map.locate)
        .accessibilityAddTraits(active ? .isSelected : [])
    }
}

// MARK: - Pins

extension MapCluster {
    var coordinate: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: latitude, longitude: longitude) }
}

extension MapPlace {
    var coordinate: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: latitude, longitude: longitude) }
}

// MARK: - Categories

private struct CategoryChips: View {
    let categories: [MapCategory]
    /// Chips stack: any number can be on at once.
    let selected: Set<String>
    let hasRoutes: Bool
    let routesOnly: Bool
    let toggleRoutes: () -> Void
    let select: (String) -> Void
    @Environment(\.palette) private var palette

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            Group {
                HStack(spacing: 8) {
                    if hasRoutes {
                        FilterChip(symbol: "figure.hiking", tint: .green, title: L10n.Map.routes, selected: routesOnly, floating: true, action: toggleRoutes)
                    }
                    ForEach(categories, id: \.id) { category in
                        let tint = CategoryGlyph.style(category.icon, hex: category.color).color
                        FilterChip(symbol: CategoryGlyph.symbol(category.icon), tint: tint, title: category.name, selected: selected.contains(category.id), floating: true) {
                            select(category.id)
                        }
                    }
                }
                .padding(.horizontal, 16)
            }
        }
        // Chips cast a shadow over the map; don't clip it at the row's edge.
        .scrollClipDisabled()
        .accessibilityLabel(L10n.Map.filterPlaces)
    }
}

/// A filter chip: monochrome outline icon and label; filled ink when on (a
/// fill, not a hue change: it reads without colour vision too). Over the map (`floating`)
/// it's Liquid Glass; in the search sheet, outlined white.
struct FilterChip: View {
    let symbol: String
    let tint: Color
    let title: String
    let selected: Bool
    var onTint: Color = .white
    var floating = false
    let action: () -> Void
    @Environment(\.palette) private var palette
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                // One weight and a fixed icon slot: selecting never resizes the chip.
                Image(systemName: symbol)
                    .font(.system(size: 13, weight: .semibold))
                    .frame(width: 16)
                Text(title)
                    .font(.subheadline.weight(.semibold))
            }
            .padding(.horizontal, 14)
            .frame(height: 36)
            .foregroundStyle(selected ? palette.background : palette.text)
            .background {
                if selected { Capsule().fill(palette.text) }
                else if !floating { Capsule().fill(palette.surface) }
            }
            .overlay { if !floating && !selected { Capsule().strokeBorder(palette.separator, lineWidth: 1) } }
            // Over the map: Liquid Glass; in the search sheet: outlined white.
            .glassEffect(floating && !selected ? .regular.interactive() : .identity, in: Capsule())
            .frame(minHeight: 44)
            .contentShape(Rectangle())
            .animation(reduceMotion ? nil : .snappy(duration: 0.25), value: selected)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
        .sensoryFeedback(.selection, trigger: selected)
    }
}

// MARK: - Search

/// Search that works before you type: scopes (everything, routes, each
/// category) and the list under them, routes first. Typing narrows by name,
/// category or municipality, accents and case ignored.
private struct MapSearch: View {
    enum Scope: Hashable { case all, routes, category(String) }

    let places: [MapPlace]
    let routes: [EcoRoute]
    let categories: [MapCategory]
    let municipalities: [String: String]
    let pickPlace: (MapPlace) -> Void
    let pickRoute: (EcoRoute) -> Void
    @State private var query = ""
    @State private var scope: Scope = .all
    @Environment(\.palette) private var palette

    private func fold(_ text: String) -> String {
        text.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
    }

    private var needle: String { fold(query.trimmingCharacters(in: .whitespaces)) }

    private var routeResults: [EcoRoute] {
        guard scope == .all || scope == .routes else { return [] }
        let q = needle
        let matches = q.isEmpty ? routes : routes.filter {
            fold($0.name).contains(q) || fold($0.categoryName).contains(q) || fold($0.municipalityName).contains(q)
        }
        return matches.sorted { $0.name < $1.name }
    }

    private var placeResults: [MapPlace] {
        let scoped: [MapPlace] = switch scope {
        case .all: places
        case .routes: []
        case .category(let id): places.filter { $0.categoryId == id }
        }
        let q = needle
        let matches = q.isEmpty ? scoped : scoped.filter {
            fold($0.name).contains(q) || fold($0.categoryName).contains(q) || fold(municipalities[$0.municipalityId] ?? "").contains(q)
        }
        return matches.sorted { $0.name < $1.name }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ScopeChips(scope: $scope, hasRoutes: !routes.isEmpty, categories: categories)
                        .listRowInsets(EdgeInsets())
                        .listRowSeparator(.hidden)
                }
                if !routeResults.isEmpty {
                    Section {
                        ForEach(routeResults, id: \.id) { route in
                            Button { pickRoute(route) } label: {
                                ResultRow(title: route.name, subtitle: "\(route.categoryName) · \(route.municipalityName) · \(route.distanceText)") {
                                    PinBadge(symbol: route.symbol, color: route.tint, size: 36)
                                }
                            }
                            .listRowSeparatorTint(palette.hairline)
                        }
                    } header: {
                        if scope == .all { SectionTitle(text: L10n.Map.routes) }
                    }
                }
                if !placeResults.isEmpty {
                    Section {
                        ForEach(placeResults, id: \.id) { place in
                            Button { pickPlace(place) } label: {
                                ResultRow(title: place.name, subtitle: [place.categoryName, municipalities[place.municipalityId]].compactMap { $0 }.joined(separator: " · ")) {
                                    CategoryPinBadge(icon: place.icon, hex: place.color, size: 36)
                                }
                            }
                            .listRowSeparatorTint(palette.hairline)
                        }
                    } header: {
                        if scope == .all, !routeResults.isEmpty { SectionTitle(text: L10n.Search.places) }
                    }
                }
            }
            .listStyle(.plain)
            .listSectionSpacing(0)
            .overlay {
                if routeResults.isEmpty, placeResults.isEmpty {
                    EmptyState(symbol: "magnifyingglass", title: L10n.Search.emptyTitle, message: L10n.Search.emptyBody)
                }
            }
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: L10n.Search.placeholder)
            .navigationTitle(L10n.Search.title)
            .navigationBarTitleDisplayMode(.inline)
            .animation(.snappy(duration: 0.2), value: scope)
        }
    }
}

private struct SectionTitle: View {
    let text: String
    @Environment(\.palette) private var palette

    var body: some View {
        Text(text)
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(palette.text)
            .textCase(nil)
            .padding(.top, 8)
            .accessibilityAddTraits(.isHeader)
    }
}

private struct ResultRow<Leading: View>: View {
    let title: String
    let subtitle: String
    @ViewBuilder let leading: Leading
    @Environment(\.palette) private var palette

    var body: some View {
        HStack(spacing: 12) {
            leading
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(palette.text).lineLimit(1)
                Text(subtitle).font(.subheadline).foregroundStyle(palette.textTertiary).lineLimit(1)
            }
        }
        .padding(.vertical, 2)
        .contentShape(Rectangle())
    }
}

/// The scopes as one row of chips: "Todo", "Rutas", then each category.
private struct ScopeChips: View {
    @Binding var scope: MapSearch.Scope
    let hasRoutes: Bool
    let categories: [MapCategory]
    @Environment(\.palette) private var palette

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                FilterChip(symbol: "square.grid.2x2", tint: palette.text, title: L10n.Search.all, selected: scope == .all, onTint: palette.background) { scope = .all }
                if hasRoutes {
                    FilterChip(symbol: "figure.hiking", tint: .green, title: L10n.Map.routes, selected: scope == .routes) {
                        scope = scope == .routes ? .all : .routes
                    }
                }
                ForEach(categories, id: \.id) { category in
                    let tint = CategoryGlyph.style(category.icon, hex: category.color).color
                    FilterChip(symbol: CategoryGlyph.symbol(category.icon), tint: tint, title: category.name, selected: scope == .category(category.id)) {
                        scope = scope == .category(category.id) ? .all : .category(category.id)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 4)
        }
    }
}
