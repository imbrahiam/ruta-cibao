import MapKit
import SwiftUI

/// The province's map on MapKit, with the same interface as `RutaMap` so the two engines can
/// be compared on the same screen. Pins are the system's markers in each kind's tone; MapKit
/// thins them and sets their names itself.
struct AppleMap: View {
    var pins: [MapPin]
    var lines: [MapLine]
    var selected: String?
    var camera: CameraRequest
    var topInset: CGFloat = 0
    var bottomInset: CGFloat = 0
    /// Tilted, with terrain and buildings in relief.
    var threeD = false
    /// While navigating: you are drawn as this little model instead of the blue dot.
    var traveller: RouteNavigator.Mode?
    var onPick: (String?) -> Void
    var onMove: (Viewport) -> Void
    var onFollowing: (Bool) -> Void

    @State private var position: MapCameraPosition = .automatic
    @State private var placed = false
    @State private var visibleCamera: MapCamera?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        MapReader { proxy in
            map
                .simultaneousGesture(SpatialTapGesture(coordinateSpace: .global).onEnded { tap in
                    guard let key = trafficLine(at: tap.location, using: proxy) else { return }
                    onPick(key)
                })
        }
    }

    private func trafficLine(at point: CGPoint, using proxy: MapProxy) -> String? {
        for pin in pins {
            let coordinate = CLLocationCoordinate2D(latitude: pin.latitude, longitude: pin.longitude)
            if let anchor = proxy.convert(coordinate, to: .global) {
                let lift: CGFloat = pin.sign != nil ? MapMarkerBadgeMetrics.height : 24
                if abs(point.x - anchor.x) < 19 && point.y > anchor.y - lift && point.y < anchor.y + 8 {
                    return nil
                }
            }
        }
        var closest: (key: String, distance: CGFloat)?
        for line in lines where line.id.hasPrefix("t") {
            let points = line.path.map { proxy.convert($0.coordinate, to: .global) }
            for (start, end) in zip(points, points.dropFirst()) {
                guard let start, let end else { continue }
                let dx = end.x - start.x, dy = end.y - start.y
                let length = dx * dx + dy * dy
                guard length > 0 else { continue }
                let fraction = min(max(((point.x - start.x) * dx + (point.y - start.y) * dy) / length, 0), 1)
                let distance = hypot(point.x - start.x - fraction * dx, point.y - start.y - fraction * dy)
                if distance <= max(16, line.width / 2 + 8), distance < (closest?.distance ?? .infinity) {
                    closest = (line.id, distance)
                }
            }
        }
        return closest?.key
    }

    private var map: some View {
        Map(position: $position, selection: Binding(get: { selected }, set: { key in
            // MapKit clears its marker selection when the camera moves off an endpoint.
            // The incident detail stays open until the user dismisses it or picks another item.
            if key == nil, selected?.hasPrefix("t") == true { return }
            onPick(key.flatMap { value in pins.first(where: { $0.key == value })?.selects ?? value })
        })) {
            // Lines first, so markers and signs sit on top of them.
            ForEach(lines, id: \.id) { line in
                let path = line.path.map(\.coordinate)
                if let stripe = line.stripeMetres {
                    // A barrier on the road: a thin dark edge, white, and red bars across it,
                    // each bar its own solid stroke so it keeps its size when the map tilts.
                    let width = line.width + 3
                    MapPolyline(coordinates: path)
                        .stroke(Color.solid(0x2B2B2E).opacity(0.7), style: StrokeStyle(lineWidth: width + 3, lineCap: .butt, lineJoin: .round))
                    MapPolyline(coordinates: path)
                        .stroke(Color.white, style: StrokeStyle(lineWidth: width, lineCap: .butt, lineJoin: .round))
                    ForEach(Array(TrailPath(path).alternate(every: stripe).enumerated()), id: \.offset) { _, bar in
                        MapPolyline(coordinates: bar)
                            .stroke(Color(hex: line.color) ?? .danger, style: StrokeStyle(lineWidth: width, lineCap: .butt, lineJoin: .round))
                    }
                } else if let wave = line.waveMetres {
                    // Water over the road: it spreads past the kerb in a pale band, runs deep
                    // down the middle, and a white wave rides along it so it never reads as a
                    // plain blue line or as one of the routes.
                    let tone = Color(hex: line.color) ?? .blue
                    MapPolyline(coordinates: path)
                        .stroke(tone.opacity(0.28), style: StrokeStyle(lineWidth: line.width + 12, lineCap: .round, lineJoin: .round))
                    MapPolyline(coordinates: path)
                        .stroke(Color.white, style: StrokeStyle(lineWidth: line.width + 4, lineCap: .round, lineJoin: .round))
                    MapPolyline(coordinates: path)
                        .stroke(tone, style: StrokeStyle(lineWidth: line.width + 1, lineCap: .round, lineJoin: .round))
                    MapPolyline(coordinates: TrailPath(path).wave(amplitude: wave * 0.18, wavelength: wave))
                        .stroke(Color.white.opacity(0.95), style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                } else {
                    if line.casing {
                        MapPolyline(coordinates: path)
                            .stroke(Color.white, style: StrokeStyle(lineWidth: line.width + 4, lineCap: .round, lineJoin: .round))
                    }
                    MapPolyline(coordinates: path)
                        .stroke(Color(hex: line.color) ?? .ink, style: StrokeStyle(lineWidth: line.width, lineCap: .round, lineJoin: .round))
                    if !line.dash.isEmpty {
                        MapPolyline(coordinates: path)
                            .stroke(Color.white.opacity(0.9), style: StrokeStyle(lineWidth: max(line.width * 0.34, 1.5), lineCap: .butt, dash: line.dash.map { CGFloat($0) }))
                    }
                }
            }
            ForEach(pins, id: \.key) { pin in
                let coordinate = CLLocationCoordinate2D(latitude: pin.latitude, longitude: pin.longitude)
                if let sign = pin.sign {
                    let picks = pin.selects ?? pin.key
                    // The marker's point stands on the road.
                    Annotation(pin.title, coordinate: coordinate, anchor: .bottom) {
                        let aside = selected != nil && selected != picks
                        TrafficMarker(kind: sign, selected: selected == pin.key)
                            .opacity(aside ? 0.45 : 1)
                    }
                    .annotationTitles(.hidden)
                    .tag(pin.key)
                } else {
                    Marker(pin.title, systemImage: pin.symbol, coordinate: coordinate)
                        // With one in hand, the others step back so it reads first.
                        .tint(pin.tone.color.markerTint.opacity(selected == nil || selected == pin.key || pin.prominent ? 1 : 0.45))
                        .tag(pin.key)
                }
            }
            // One user annotation whose content changes: swapping the system's dot for a custom
            // one inside the map's content did not take, so the dot is drawn here too.
            UserAnnotation(anchor: .center) { _ in
                if let traveller { VehiclePuck(mode: traveller) } else { LocationDot() }
            }
        }
        .mapStyle(.standard(elevation: threeD ? .realistic : .flat, emphasis: .muted, pointsOfInterest: .excludingAll))
        // Where you are reads in the system's blue, as in every map app, never as a black pin.
        .tint(.blue)
        .mapControls { MapCompass() }
        // The header covers the map's top edge: its compass, its legal line and its
        // centring stay clear of them.
        .safeAreaPadding(.top, topInset)
        .safeAreaPadding(.bottom, bottomInset)
        .onMapCameraChange(frequency: .onEnd) { context in
            visibleCamera = context.camera
            let box = context.region
            onMove(Viewport(
                west: box.center.longitude - box.span.longitudeDelta / 2, south: box.center.latitude - box.span.latitudeDelta / 2,
                east: box.center.longitude + box.span.longitudeDelta / 2, north: box.center.latitude + box.span.latitudeDelta / 2
            ))
            onFollowing(position.followsUserLocation)
        }
        .onChange(of: threeD) { _, enabled in
            guard var camera = visibleCamera ?? position.camera else { return }
            camera.pitch = enabled ? 55 : 0
            withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.6)) {
                position = .camera(camera)
            }
        }
        .onChange(of: camera.id, initial: true) { _, _ in
            let next = target(camera.move)
            guard camera.animated, placed else { position = next; placed = true; return }
            // Move on the next pass, outside the update that also opens the sheet and redraws
            // the pins: inside it MapKit dropped the animation and cut straight to the place.
            Task { @MainActor in
                withAnimation(.easeInOut(duration: 0.6)) { position = next }
            }
        }
    }

    private func target(_ move: CameraRequest.Move) -> MapCameraPosition {
        switch move {
        case .region(let center, let latitudeSpan, let longitudeSpan):
            // In 3D the same view, seen at a slant from a little further back.
            threeD
                ? .camera(MapCamera(centerCoordinate: center.coordinate, distance: max(latitudeSpan, longitudeSpan) * 111_000 * 1.9, heading: 0, pitch: 55))
                : .region(MKCoordinateRegion(center: center.coordinate, span: MKCoordinateSpan(latitudeDelta: latitudeSpan, longitudeDelta: longitudeSpan)))
        case .follow(let center, let distance, let heading):
            .camera(MapCamera(centerCoordinate: center.coordinate, distance: distance, heading: heading, pitch: 50))
        case .user:
            .userLocation(fallback: position)
        }
    }
}

/// Where you are when not travelling: the system's blue dot with its white ring.
private struct LocationDot: View {
    var body: some View {
        Circle().fill(Color.blue)
            .frame(width: 16, height: 16)
            .padding(3)
            .background(Circle().fill(Color.white))
            .shadow(color: .black.opacity(0.25), radius: 3, y: 1)
            .accessibilityHidden(true)
    }
}
