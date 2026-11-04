import ARKit
import CoreLocation
import RealityKit
import RutaKit
import SwiftUI

/// Camera mode: the places around you, floating in the camera where they
/// really are (compass bearing), each a card in the app's style that always
/// faces you. Tap a card to go back to the map with that place open.
struct CameraMode: View {
    let places: [MapPlace]
    let pick: (MapPlace) -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(\.palette) private var palette
    @State private var locator = OneShotLocation()

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            if !ARWorldTrackingConfiguration.isSupported {
                notice(L10n.Map.arUnsupported, symbol: "camera.metering.unknown")
            } else if locator.denied {
                notice(L10n.Map.arNoLocation, symbol: "location.slash")
            } else if let here = locator.location {
                let near = Self.nearby(places, from: here)
                if near.isEmpty {
                    notice(L10n.Map.arNothingNear, symbol: "mappin.slash")
                } else {
                    PlacesARView(places: near, origin: here) { place in
                        dismiss()
                        pick(place)
                    }
                    .ignoresSafeArea()
                }
            } else {
                ProgressView().controlSize(.large).tint(.white)
            }
        }
        .overlay(alignment: .top) {
            HStack(alignment: .center) {
                SheetCloseButton()
                Spacer()
            }
            .padding(.horizontal, 12)
        }
        .overlay(alignment: .bottom) {
            if ARWorldTrackingConfiguration.isSupported, locator.location != nil {
                Label(L10n.Map.arHint, systemImage: "iphone.gen3.radiowaves.left.and.right")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16)
                    .frame(height: 40)
                    .background(Color.black.opacity(0.45), in: Capsule())
                    .padding(.bottom, 24)
            }
        }
        // This view only; `.preferredColorScheme` would recolour the window.
        .environment(\.colorScheme, .dark)
        .task { locator.start() }
    }

    private func notice(_ text: String, symbol: String) -> some View {
        VStack(spacing: 14) {
            Image(systemName: symbol).font(.system(size: 40, weight: .regular)).foregroundStyle(.white.opacity(0.8))
            Text(text).font(.headline).foregroundStyle(.white).multilineTextAlignment(.center)
        }
        .padding(32)
    }

    /// The closest places within 2 km, at most 12, so the view stays readable.
    static func nearby(_ places: [MapPlace], from here: CLLocation) -> [(place: MapPlace, meters: Double)] {
        places
            .map { ($0, here.distance(from: CLLocation(latitude: $0.latitude, longitude: $0.longitude))) }
            .filter { $0.1 <= 2000 }
            .sorted { $0.1 < $1.1 }
            .prefix(12)
            .map { (place: $0.0, meters: $0.1) }
    }
}

// MARK: - AR

private struct PlacesARView: UIViewRepresentable {
    let places: [(place: MapPlace, meters: Double)]
    let origin: CLLocation
    let pick: (MapPlace) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(pick: pick) }

    func makeUIView(context: Context) -> ARView {
        let view = ARView(frame: .zero, cameraMode: .ar, automaticallyConfigureSession: false)
        let config = ARWorldTrackingConfiguration()
        // x east, -z north: bearings from the compass land where they belong.
        config.worldAlignment = .gravityAndHeading
        view.session.run(config)
        view.renderOptions.insert(.disableMotionBlur)

        let anchor = AnchorEntity(world: .zero)
        view.scene.addAnchor(anchor)
        for (index, item) in places.enumerated() {
            let entity = Self.card(for: item.place, meters: item.meters)
            entity.position = Self.position(of: item.place, from: origin, rank: index)
            entity.name = item.place.id
            anchor.addChild(entity)
            context.coordinator.places[item.place.id] = item.place
        }
        view.addGestureRecognizer(UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.tap(_:))))
        context.coordinator.view = view
        return view
    }

    func updateUIView(_ view: ARView, context: Context) {}

    static func dismantleUIView(_ view: ARView, coordinator: Coordinator) {
        view.session.pause()
    }

    /// Bearing is exact; distance is compressed to 8–40 m so far places stay
    /// visible and near ones don't fill the screen. Ranks stagger the height.
    static func position(of place: MapPlace, from here: CLLocation, rank: Int) -> SIMD3<Float> {
        let lat = here.coordinate.latitude * .pi / 180
        let east = (place.longitude - here.coordinate.longitude) * 111_320 * cos(lat)
        let north = (place.latitude - here.coordinate.latitude) * 110_540
        let meters = max(1, (east * east + north * north).squareRoot())
        let shown = 8 + 32 * min(1, meters / 2000)
        let k = shown / meters
        return SIMD3(Float(east * k), Float(0.4 + Double(rank % 3) * 0.9), Float(-north * k))
    }

    /// The card: the app's own view rendered to a texture on a rounded plane.
    @MainActor static func card(for place: MapPlace, meters: Double) -> Entity {
        let renderer = ImageRenderer(content: ARCard(place: place, meters: meters))
        renderer.scale = 3
        let entity = Entity()
        guard let image = renderer.cgImage,
              let texture = try? TextureResource(image: image, options: .init(semantic: .color)) else { return entity }
        let width: Float = 2.2
        let height = width * Float(image.height) / Float(image.width)
        var material = UnlitMaterial()
        material.color = .init(tint: .white, texture: .init(texture))
        material.blending = .transparent(opacity: .init(floatLiteral: 1.0))
        let plane = ModelEntity(mesh: .generatePlane(width: width, height: height, cornerRadius: height / 2), materials: [material])
        plane.generateCollisionShapes(recursive: false)
        plane.name = place.id
        entity.addChild(plane)
        entity.components.set(BillboardComponent())
        return entity
    }

    final class Coordinator: NSObject {
        let pick: (MapPlace) -> Void
        var places: [String: MapPlace] = [:]
        weak var view: ARView?

        init(pick: @escaping (MapPlace) -> Void) { self.pick = pick }

        @MainActor @objc func tap(_ gesture: UITapGestureRecognizer) {
            guard let view, let hit = view.entity(at: gesture.location(in: view)) else { return }
            var node: Entity? = hit
            while let current = node, places[current.name] == nil { node = current.parent }
            if let id = node?.name, let place = places[id] { pick(place) }
        }
    }
}

/// What a place looks like in the camera: the map pin's colour and glyph,
/// the name, how far. White pill, so it reads over any scene.
private struct ARCard: View {
    let place: MapPlace
    let meters: Double

    var body: some View {
        let style = CategoryGlyph.style(place.icon, hex: place.color)
        HStack(spacing: 10) {
            Circle()
                .fill(style.color)
                .frame(width: 40, height: 40)
                .overlay { Image(systemName: style.symbol).font(.system(size: 18, weight: .semibold)).foregroundStyle(.white) }
            VStack(alignment: .leading, spacing: 1) {
                Text(place.name).font(.system(size: 17, weight: .semibold)).foregroundStyle(.black).lineLimit(1)
                Text(Measurement(value: meters, unit: UnitLength.meters).formatted(.measurement(width: .abbreviated, usage: .road)))
                    .font(.system(size: 14, weight: .medium)).foregroundStyle(Color(white: 0.4))
            }
        }
        .padding(.leading, 6)
        .padding(.trailing, 18)
        .padding(.vertical, 6)
        .frame(maxWidth: 300, alignment: .leading)
        .background(.white, in: Capsule())
    }
}

/// One location fix for camera mode (the view doesn't follow you around).
@Observable
final class OneShotLocation: NSObject, CLLocationManagerDelegate {
    private(set) var location: CLLocation?
    private(set) var denied = false
    @ObservationIgnored private let manager = CLLocationManager()

    func start() {
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        switch manager.authorizationStatus {
        case .denied, .restricted: denied = true
        case .notDetermined: manager.requestWhenInUseAuthorization()
        default: manager.requestLocation()
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in
            denied = status == .denied || status == .restricted
            if status == .authorizedWhenInUse || status == .authorizedAlways { self.manager.requestLocation() }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let last = locations.last
        Task { @MainActor in location = last }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {}
}
