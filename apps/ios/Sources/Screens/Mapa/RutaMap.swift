import GoogleMaps
import SwiftUI

/// A mark on the map: its place, its name, its glyph and the tone of its kind.
struct MapPin: Equatable {
    let key: String
    let latitude: Double
    let longitude: Double
    let title: String
    let symbol: String
    let tone: PinTone
    /// A road notice: drawn as its traffic sign instead of a balloon.
    var sign: TrafficSignKind?
    /// What picking it selects, when that is another pin's key (a closure's end markers pick
    /// the notice itself).
    var selects: String?
    /// A quieter marker, as at either end of a closed stretch.
    var small = false
}

/// A stroke on the map: a reported stretch, an eco route, the way you were given.
struct MapLine: Equatable {
    let id: String
    let path: [GeoPoint]
    let color: String
    let width: Double
    /// Gaps along the line (a road closure's white dashes), in points.
    var dash: [Double] = []
    /// A white edge under the line so it reads over any street.
    var casing = false
    /// Drawn as a barrier: a dark edge, white, and red stripes across it.
    var stripes = false
}

struct GeoPoint: Hashable {
    let latitude: Double
    let longitude: Double

    init(_ coordinate: CLLocationCoordinate2D) {
        latitude = coordinate.latitude
        longitude = coordinate.longitude
    }

    var coordinate: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: latitude, longitude: longitude) }
}

/// Where the screen wants the map to look. A new `id` is a new request; the map stays where the
/// person left it otherwise.
struct CameraRequest: Equatable {
    enum Move: Equatable {
        case region(center: GeoPoint, latitudeSpan: Double, longitudeSpan: Double)
        /// Turn-by-turn: low over the road, facing the way you are going.
        case follow(center: GeoPoint, distance: Double, heading: Double)
        case user
    }

    var id = 0
    var move: Move
    var animated = false
}

/// What the map shows, in degrees.
struct Viewport: Equatable {
    let west: Double, south: Double, east: Double, north: Double
    var latitudeSpan: Double { north - south }
}

/// The province's map on the Google Maps SDK, the same engine as Android, restyled so the
/// base stays quiet and neutral: no points of interest of Google's, only the app's own places,
/// reports and routes.
struct RutaMap: UIViewRepresentable {
    var pins: [MapPin]
    var lines: [MapLine]
    var selected: String?
    var camera: CameraRequest
    /// The app's header over the map: Google's marks and the centring stay clear of them.
    var topInset: CGFloat = 0
    var bottomInset: CGFloat = 0
    var onPick: (String?) -> Void
    var onMove: (Viewport) -> Void
    var onFollowing: (Bool) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> GMSMapView {
        let options = GMSMapViewOptions()
        options.camera = context.coordinator.position(for: camera, in: nil) ?? GMSCameraPosition(latitude: 19.4772, longitude: -71.3414, zoom: 14.5)
        let map = GMSMapView(options: options)
        map.delegate = context.coordinator
        map.mapStyle = try? GMSMapStyle(jsonString: MapLook.light)
        map.isMyLocationEnabled = true
        map.isBuildingsEnabled = false
        map.isIndoorEnabled = false
        map.settings.tiltGestures = false
        map.settings.compassButton = true
        map.padding = UIEdgeInsets(top: topInset, left: 0, bottom: bottomInset, right: 0)
        context.coordinator.draw(on: map)
        return map
    }

    func updateUIView(_ map: GMSMapView, context: Context) {
        let coordinator = context.coordinator
        let before = coordinator.parent
        coordinator.parent = self
        let padding = UIEdgeInsets(top: topInset, left: 0, bottom: bottomInset, right: 0)
        if map.padding != padding { map.padding = padding }
        if before.pins != pins || before.selected != selected { coordinator.draw(on: map) }
        if before.lines != lines { coordinator.stroke(on: map) }
        if before.camera.id != camera.id { coordinator.apply(camera, to: map) }
    }

    final class Coordinator: NSObject, GMSMapViewDelegate {
        var parent: RutaMap
        private var markers: [String: GMSMarker] = [:]
        private var faces: [String: String] = [:]
        private var strokes: [GMSPolyline] = []
        /// The pins whose names fit on screen without touching another pin or name.
        private var named: Set<String> = []
        private var following = false

        init(_ parent: RutaMap) { self.parent = parent }

        // MARK: Pins

        func draw(on map: GMSMapView) {
            name(on: map)
            let wanted = Set(parent.pins.map(\.key))
            for (key, marker) in markers where !wanted.contains(key) {
                marker.map = nil
                markers[key] = nil
                faces[key] = nil
            }
            for pin in parent.pins {
                let chosen = pin.key == parent.selected
                let title = named.contains(pin.key) ? pin.title : nil
                let face = "\(pin.tone.rawValue)|\(pin.symbol)|\(chosen)|\(title ?? "")"
                let marker = markers[pin.key] ?? {
                    let marker = GMSMarker(position: CLLocationCoordinate2D(latitude: pin.latitude, longitude: pin.longitude))
                    marker.userData = pin.key
                    marker.map = map
                    markers[pin.key] = marker
                    return marker
                }()
                marker.zIndex = chosen ? 1 : 0
                marker.accessibilityLabel = pin.title
                guard faces[pin.key] != face, let drawn = PinImage.render(tone: pin.tone, symbol: pin.symbol, large: chosen, title: title) else { continue }
                faces[pin.key] = face
                marker.icon = drawn.image
                marker.groundAnchor = CGPoint(x: 0.5, y: drawn.tip)
            }
        }

        /// Google has no collision handling for an app's own markers, so the names are placed
        /// here: the pin in hand first, then the rest in order, each only where it is free.
        private func name(on map: GMSMapView) {
            guard map.bounds.width > 1 else { named = []; return }
            let points = Dictionary(parent.pins.map { ($0.key, map.projection.point(for: CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude))) }, uniquingKeysWith: { first, _ in first })
            var taken = points.values.map { CGRect(x: $0.x - 18, y: $0.y - 42, width: 36, height: 44) }
            var shown: Set<String> = []
            for pin in parent.pins.sorted(by: { a, b in a.key == parent.selected && b.key != parent.selected }) {
                guard let point = points[pin.key], map.bounds.contains(point) else { continue }
                let size = PinImage.nameSize(pin.title)
                let box = CGRect(x: point.x - size.width / 2 - 4, y: point.y + 2, width: size.width + 8, height: size.height + 4)
                guard !taken.contains(where: { $0.intersects(box) }) else { continue }
                taken.append(box)
                shown.insert(pin.key)
            }
            named = shown
        }

        func stroke(on map: GMSMapView) {
            strokes.forEach { $0.map = nil }
            strokes = parent.lines.map { line in
                let path = GMSMutablePath()
                line.path.forEach { path.add($0.coordinate) }
                let stroke = GMSPolyline(path: path)
                stroke.strokeColor = UIColor(Color(hex: line.color) ?? .ink)
                stroke.strokeWidth = line.width
                stroke.map = map
                return stroke
            }
        }

        // MARK: Camera

        /// A region as a centre and a zoom that fits it, worked out from the span so it does not
        /// depend on the map having been laid out yet.
        func position(for request: CameraRequest, in map: GMSMapView?) -> GMSCameraPosition? {
            switch request.move {
            case .region(let center, let latitudeSpan, let longitudeSpan):
                let size = map.map { CGSize(width: $0.bounds.width, height: $0.bounds.height - $0.padding.top - $0.padding.bottom) } ?? .zero
                let width = size.width > 1 ? size.width : 390, height = size.height > 1 ? size.height : 560
                let across = log2(360 * Double(width) / (256 * max(longitudeSpan, 0.0001)))
                let down = log2(360 * cos(center.latitude * .pi / 180) * Double(height) / (256 * max(latitudeSpan, 0.0001)))
                return GMSCameraPosition(target: center.coordinate, zoom: Float(min(across, down, 19)))
            case .follow(let center, let distance, let heading):
                return GMSCameraPosition(target: center.coordinate, zoom: distance > 500 ? 17 : 18.2, bearing: heading, viewingAngle: 50)
            case .user:
                return nil
            }
        }

        func apply(_ request: CameraRequest, to map: GMSMapView) {
            if case .user = request.move {
                guard let here = map.myLocation else { return }
                following = true
                parent.onFollowing(true)
                map.animate(to: GMSCameraPosition(target: here.coordinate, zoom: max(map.camera.zoom, 15.5)))
                return
            }
            guard let position = position(for: request, in: map) else { return }
            if request.animated { map.animate(to: position) } else { map.camera = position }
        }

        func mapView(_ mapView: GMSMapView, willMove gesture: Bool) {
            guard gesture, following else { return }
            following = false
            parent.onFollowing(false)
        }

        func mapView(_ mapView: GMSMapView, idleAt position: GMSCameraPosition) {
            let box = GMSCoordinateBounds(region: mapView.projection.visibleRegion())
            parent.onMove(Viewport(west: box.southWest.longitude, south: box.southWest.latitude, east: box.northEast.longitude, north: box.northEast.latitude))
            draw(on: mapView)
        }

        // MARK: Picking

        func mapView(_ mapView: GMSMapView, didTap marker: GMSMarker) -> Bool {
            parent.onPick(marker.userData as? String)
            return true
        }

        func mapView(_ mapView: GMSMapView, didTapAt coordinate: CLLocationCoordinate2D) {
            parent.onPick(nil)
        }
    }
}

/// The basemap's look: light greys, white streets, soft water, nothing of Google's own to tap.
private enum MapLook {
    static let light = """
    [
    {"elementType":"geometry","stylers":[{"color":"#F1F2F2"}]},
    {"elementType":"labels.icon","stylers":[{"visibility":"off"}]},
    {"elementType":"labels.text.fill","stylers":[{"color":"#6B6F6D"}]},
    {"elementType":"labels.text.stroke","stylers":[{"color":"#FFFFFF"}]},
    {"featureType":"poi","stylers":[{"visibility":"off"}]},
    {"featureType":"transit","stylers":[{"visibility":"off"}]},
    {"featureType":"administrative","elementType":"geometry.stroke","stylers":[{"color":"#C9CCCB"}]},
    {"featureType":"administrative.land_parcel","stylers":[{"visibility":"off"}]},
    {"featureType":"administrative.locality","elementType":"labels.text.fill","stylers":[{"color":"#2B2E2D"}]},
    {"featureType":"landscape.natural","elementType":"geometry","stylers":[{"color":"#ECEEED"}]},
    {"featureType":"poi.park","elementType":"geometry","stylers":[{"visibility":"on"},{"color":"#E2E8E3"}]},
    {"featureType":"road","elementType":"geometry.fill","stylers":[{"color":"#FFFFFF"}]},
    {"featureType":"road","elementType":"geometry.stroke","stylers":[{"color":"#E1E3E2"}]},
    {"featureType":"road.highway","elementType":"geometry.fill","stylers":[{"color":"#FFFFFF"}]},
    {"featureType":"road.highway","elementType":"geometry.stroke","stylers":[{"color":"#D5D8D7"}]},
    {"featureType":"road.local","elementType":"labels.text.fill","stylers":[{"color":"#8A8E8C"}]},
    {"featureType":"water","elementType":"geometry","stylers":[{"color":"#D3DEE4"}]},
    {"featureType":"water","elementType":"labels.text.fill","stylers":[{"color":"#7C929C"}]}
    ]
    """
}

/// A pin as the map draws it: the kind's colour on a white disc with a short tail, its glyph in
/// white. The one in hand is larger.
private struct PinImage: View {
    let tone: PinTone
    let symbol: String
    let large: Bool

    var body: some View {
        let size: CGFloat = large ? 50 : 34
        VStack(spacing: -size * 0.1) {
            ZStack {
                Circle().fill(.white)
                Circle().fill(tone.color).padding(large ? 3 : 2.5)
                Image(systemName: symbol).font(.system(size: size * 0.42, weight: .semibold)).foregroundStyle(.white)
            }
            .frame(width: size, height: size)
            .zIndex(1)
            Tail().fill(.white).frame(width: size * 0.34, height: size * 0.22)
        }
        .shadow(color: .black.opacity(0.24), radius: 3, y: 1.5)
        .padding(.horizontal, 6)
        .padding(.top, 5)
    }

    private nonisolated struct Tail: Shape {
        nonisolated func path(in rect: CGRect) -> Path {
            var path = Path()
            path.move(to: CGPoint(x: rect.minX, y: rect.minY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
            path.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
            path.closeSubpath()
            return path
        }
    }

    private static let nameFont = UIFont.systemFont(ofSize: 11.5, weight: .semibold)
    private static let nameWidth: CGFloat = 104

    /// The room a name takes under its pin, wrapped to two lines at most.
    static func nameSize(_ title: String) -> CGSize {
        let box = (title as NSString).boundingRect(
            with: CGSize(width: nameWidth, height: nameFont.lineHeight * 2 + 1), options: [.usesLineFragmentOrigin, .truncatesLastVisibleLine],
            attributes: [.font: nameFont], context: nil
        )
        return CGSize(width: ceil(box.width), height: ceil(box.height))
    }

    /// The pin as a bitmap, with its name under it when there is room for one, and where its
    /// tip falls from top to bottom so the map can anchor it there.
    static func render(tone: PinTone, symbol: String, large: Bool, title: String?) -> (image: UIImage, tip: CGFloat)? {
        let renderer = ImageRenderer(content: PinImage(tone: tone, symbol: symbol, large: large))
        renderer.scale = 3
        guard let pin = renderer.uiImage else { return nil }
        guard let title else { return (pin, 1) }

        let name = nameSize(title)
        let size = CGSize(width: max(pin.size.width, name.width + 6), height: pin.size.height + 3 + name.height + 2)
        let style = NSMutableParagraphStyle()
        style.alignment = .center
        style.lineBreakMode = .byTruncatingTail
        let frame = CGRect(x: (size.width - name.width) / 2, y: pin.size.height + 3, width: name.width, height: name.height)
        let image = UIGraphicsImageRenderer(size: size).image { _ in
            pin.draw(at: CGPoint(x: (size.width - pin.size.width) / 2, y: 0))
            // A white outline first, the ink over it, so the name reads on any street.
            (title as NSString).draw(with: frame, options: [.usesLineFragmentOrigin, .truncatesLastVisibleLine], attributes: [
                .font: nameFont, .paragraphStyle: style, .strokeColor: UIColor.white, .strokeWidth: 28, .foregroundColor: UIColor.white,
            ], context: nil)
            (title as NSString).draw(with: frame, options: [.usesLineFragmentOrigin, .truncatesLastVisibleLine], attributes: [
                .font: nameFont, .paragraphStyle: style, .foregroundColor: UIColor(Color.ink),
            ], context: nil)
        }
        return (image, pin.size.height / size.height)
    }
}
