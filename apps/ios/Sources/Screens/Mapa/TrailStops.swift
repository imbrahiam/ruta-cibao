import CoreLocation
import MapKit
import RutaKit
import SwiftUI

/// A stop along an eco route: where it starts, the places it passes, and where it ends.
///
/// The API gives a route its path but no named stops, so the stops are the route's own start and
/// end plus the app's places that lie on the way (within `reach` of the path), in the order the
/// walk reaches them.
struct TrailStop: Identifiable, Equatable {
    enum Kind: Equatable { case start, place, end }

    let id: String
    let kind: Kind
    let name: String
    let coordinate: CLLocationCoordinate2D
    /// Metres along the path from the start.
    let along: CLLocationDistance
    var symbol: String = "mappin"
    var tint: Color = PinTone.trail.color
    var placeId: String?

    static func == (a: TrailStop, b: TrailStop) -> Bool { a.id == b.id && a.along == b.along }
}

enum TrailStops {
    /// How far off the path a place may stand and still count as a stop.
    static let reach: CLLocationDistance = 160

    static func of(_ route: EcoRoute, places: [MapPlace]) -> [TrailStop] {
        let path = route.coordinates
        guard let first = path.first, let last = path.last, path.count > 1 else { return [] }
        let total = TrailPath(path).length
        var stops = [TrailStop(id: "start-" + route.id, kind: .start, name: L10n.Routes.start, coordinate: first, along: 0, symbol: "flag.fill")]
        let line = TrailPath(path)
        let onTheWay = places.compactMap { place -> TrailStop? in
            let point = line.project(place.coordinate)
            guard point.offset <= reach, point.along > 40, point.along < total - 40 else { return nil }
            return TrailStop(id: "place-" + place.id, kind: .place, name: place.name, coordinate: place.coordinate, along: point.along,
                             symbol: Glyph.symbol(place.icon, filled: true), tint: place.tint, placeId: place.id)
        }
        stops += onTheWay.sorted { $0.along < $1.along }
        stops.append(TrailStop(id: "end-" + route.id, kind: .end, name: L10n.Routes.end, coordinate: last, along: total, symbol: "flag.checkered"))
        return stops
    }
}

/// A walking path as segments, for distances along it and the nearest point to a position.
struct TrailPath {
    let points: [CLLocationCoordinate2D]
    /// Cumulative metres at each point.
    let cumulative: [CLLocationDistance]

    init(_ points: [CLLocationCoordinate2D]) {
        self.points = points
        var sums: [CLLocationDistance] = [0]
        for index in points.indices.dropFirst() {
            sums.append(sums[index - 1] + Self.metres(points[index - 1], points[index]))
        }
        cumulative = sums
    }

    var length: CLLocationDistance { cumulative.last ?? 0 }

    /// Where `point` falls on the path: metres from the start, and how far off the path it is.
    func project(_ point: CLLocationCoordinate2D) -> (along: CLLocationDistance, offset: CLLocationDistance) {
        guard points.count > 1 else { return (0, points.first.map { Self.metres($0, point) } ?? .infinity) }
        var best: (along: CLLocationDistance, offset: CLLocationDistance) = (0, .infinity)
        // Flat-earth projection is plenty over a few kilometres.
        let scale = cos(point.latitude * .pi / 180) * 111_320
        for index in points.indices.dropLast() {
            let a = points[index], b = points[index + 1]
            let ax = (a.longitude - point.longitude) * scale, ay = (a.latitude - point.latitude) * 110_540
            let bx = (b.longitude - point.longitude) * scale, by = (b.latitude - point.latitude) * 110_540
            let dx = bx - ax, dy = by - ay
            let lengthSquared = dx * dx + dy * dy
            let t = lengthSquared > 0 ? min(max(-(ax * dx + ay * dy) / lengthSquared, 0), 1) : 0
            let px = ax + t * dx, py = ay + t * dy
            let offset = (px * px + py * py).squareRoot()
            if offset < best.offset {
                best = (cumulative[index] + t * (cumulative[index + 1] - cumulative[index]), offset)
            }
        }
        return best
    }

    static func metres(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> CLLocationDistance {
        CLLocation(latitude: a.latitude, longitude: a.longitude).distance(from: CLLocation(latitude: b.latitude, longitude: b.longitude))
    }
}

/// A route's service by its name (the list reaches Swift as Kotlin enum objects).
enum RouteService {
    static func label(_ name: String) -> String {
        switch name.lowercased() {
        case "water": L10n.Routes.Service.water
        case "food": L10n.Routes.Service.food
        case "lodging": L10n.Routes.Service.lodging
        case "guide": L10n.Routes.Service.guide
        case "parking": L10n.Routes.Service.parking
        default: L10n.Routes.Service.restrooms
        }
    }

    static func symbol(_ name: String) -> String {
        switch name.lowercased() {
        case "water": "drop"
        case "food": "fork.knife"
        case "lodging": "bed.double"
        case "guide": "person.badge.shield.checkmark"
        case "parking": "parkingsign"
        default: "toilet"
        }
    }
}

/// An eco route on its own page: the whole trail on a map with its numbered stops, the facts,
/// every stop in order, and the walk's start.
struct RoutePage: View {
    let route: EcoRoute
    let stops: [TrailStop]
    let startTrail: () -> Void
    let openPlace: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                TrailMap(route: route, stops: stops)
                    .frame(height: 260)
                    .clipShape(RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
                VStack(alignment: .leading, spacing: 4) {
                    Text(route.name).type(.title)
                    Text("\(route.categoryName) · \(route.municipalityName)").type(.callout, .ink3)
                }
                Button { dismiss(); startTrail() } label: { Label(L10n.Routes.startTrail, systemImage: "figure.hiking") }
                    .buttonStyle(.ink)
                HStack {
                    Text(L10n.Routes.stops).type(.heading)
                    Spacer()
                    Text(L10n.Routes.stopsCount(count: max(stops.count - 2, 0))).type(.callout, .ink3)
                }
                .padding(.top, 4)
                StopTimeline(stops: stops, open: { stop in if let id = stop.placeId { dismiss(); openPlace(id) } })
            }
            .padding(.horizontal, Metrics.gutter)
            .padding(.top, 8)
            .padding(.bottom, 28)
            .readable()
        }
        .safeAreaInset(edge: .top, spacing: 0) { SheetBar(title: L10n.Routes.seeRoute) { dismiss() } }
        .paperBackground()
        .presentationCornerRadius(Metrics.radiusPanel)
    }
}

/// A still map of a whole trail: its line in the trail green, a numbered disc for each stop.
struct TrailMap: View {
    let route: EcoRoute
    let stops: [TrailStop]

    var body: some View {
        Map(initialPosition: .rect(Self.rect(route.coordinates)), interactionModes: [.pan, .zoom]) {
            MapPolyline(coordinates: route.coordinates)
                .stroke(PinTone.trail.color, style: StrokeStyle(lineWidth: 5, lineCap: .round, lineJoin: .round))
            ForEach(Array(stops.enumerated()), id: \.element.id) { index, stop in
                Annotation(stop.name, coordinate: stop.coordinate, anchor: .center) {
                    StopDisc(index: index, stop: stop)
                }
                .annotationTitles(.hidden)
            }
        }
        .mapStyle(.standard(elevation: .realistic, emphasis: .muted, pointsOfInterest: .excludingAll))
        .tint(.blue)
    }

    static func rect(_ points: [CLLocationCoordinate2D]) -> MKMapRect {
        let rect = points.map { MKMapRect(origin: MKMapPoint($0), size: MKMapSize(width: 0, height: 0)) }.reduce(MKMapRect.null) { $0.union($1) }
        return rect.insetBy(dx: -rect.width * 0.18 - 300, dy: -rect.height * 0.18 - 300)
    }
}

/// A stop on a map: the trail's green disc with its number, or a flag at either end.
struct StopDisc: View {
    let index: Int
    let stop: TrailStop

    var body: some View {
        ZStack {
            Circle().fill(stop.kind == .place ? Color.paper : PinTone.trail.color)
            Circle().strokeBorder(stop.kind == .place ? PinTone.trail.color : Color.paper, lineWidth: 2.5)
            if stop.kind == .place {
                Text("\(index)").font(.system(size: 12, weight: .bold).monospacedDigit()).foregroundStyle(PinTone.trail.color)
            } else {
                Image(systemName: stop.symbol).font(.system(size: 11, weight: .bold)).foregroundStyle(Color.onInk)
            }
        }
        .frame(width: 26, height: 26)
        .shadow(color: .black.opacity(0.2), radius: 2, y: 1)
        .accessibilityLabel(stop.name)
    }
}
