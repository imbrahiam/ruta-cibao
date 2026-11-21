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

    var body: some View {
        Map(position: $position, selection: Binding(get: { selected }, set: { onPick($0) })) {
            // Lines first, so markers and signs sit on top of them.
            ForEach(lines, id: \.id) { line in
                let path = line.path.map(\.coordinate)
                if line.stripes {
                    // A barrier on the road: a thin dark edge, white, and red bars across it.
                    MapPolyline(coordinates: path)
                        .stroke(Color.solid(0x2B2B2E).opacity(0.85), style: StrokeStyle(lineWidth: line.width + 3, lineCap: .butt, lineJoin: .round))
                    MapPolyline(coordinates: path)
                        .stroke(Color.white, style: StrokeStyle(lineWidth: line.width, lineCap: .butt, lineJoin: .round))
                    MapPolyline(coordinates: path)
                        .stroke(Color(hex: line.color) ?? .danger, style: StrokeStyle(lineWidth: line.width, lineCap: .butt, lineJoin: .round, dash: [line.width * 1.3, line.width * 1.3]))
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
                        TrafficMarker(kind: sign, selected: selected == pin.key, small: pin.small)
                            .opacity(selected == nil || selected == picks ? 1 : 0.5)
                    }
                    .annotationTitles(.hidden)
                    .tag(picks)
                } else {
                    Marker(pin.title, systemImage: pin.symbol, coordinate: coordinate)
                        // With one in hand, the others step back so it reads first.
                        .tint(selected == nil || selected == pin.key ? pin.tone.color : pin.tone.color.opacity(0.45))
                        .tag(pin.key)
                }
            }
            if let traveller {
                UserAnnotation(anchor: .center) { _ in VehiclePuck(mode: traveller) }
            } else {
                UserAnnotation()
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
            let box = context.region
            onMove(Viewport(
                west: box.center.longitude - box.span.longitudeDelta / 2, south: box.center.latitude - box.span.latitudeDelta / 2,
                east: box.center.longitude + box.span.longitudeDelta / 2, north: box.center.latitude + box.span.latitudeDelta / 2
            ))
            onFollowing(position.followsUserLocation)
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
