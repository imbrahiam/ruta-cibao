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
    var onPick: (String?) -> Void
    var onMove: (Viewport) -> Void
    var onFollowing: (Bool) -> Void

    @State private var position: MapCameraPosition = .automatic
    @State private var placed = false

    var body: some View {
        Map(position: $position, selection: Binding(get: { selected }, set: { onPick($0) })) {
            ForEach(pins, id: \.key) { pin in
                Marker(pin.title, systemImage: pin.symbol, coordinate: CLLocationCoordinate2D(latitude: pin.latitude, longitude: pin.longitude))
                    // With one in hand, the others step back so it reads first.
                    .tint(selected == nil || selected == pin.key ? pin.tone.color : pin.tone.color.opacity(0.45))
                    .tag(pin.key)
            }
            ForEach(lines, id: \.id) { line in
                MapPolyline(coordinates: line.path.map(\.coordinate))
                    .stroke(Color(hex: line.color) ?? .ink, style: StrokeStyle(lineWidth: line.width, lineCap: .round, lineJoin: .round))
            }
            UserAnnotation()
        }
        .mapStyle(.standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll))
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
            .region(MKCoordinateRegion(center: center.coordinate, span: MKCoordinateSpan(latitudeDelta: latitudeSpan, longitudeDelta: longitudeSpan)))
        case .follow(let center, let distance, let heading):
            .camera(MapCamera(centerCoordinate: center.coordinate, distance: distance, heading: heading, pitch: 50))
        case .user:
            .userLocation(fallback: position)
        }
    }
}
