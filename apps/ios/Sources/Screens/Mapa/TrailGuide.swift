import CoreLocation
import SwiftUI

/// Walking an eco route stop by stop: where you are on the trail, the next stop and how far it
/// is, and a nudge when you stray from the marked path. The trail is walked as drawn, so no
/// directions service is involved.
@MainActor @Observable
final class TrailGuide: NSObject, CLLocationManagerDelegate {
    private(set) var route: EcoRoute?
    private(set) var stops: [TrailStop] = []
    /// Metres walked along the trail, as projected from the last position.
    private(set) var along: CLLocationDistance = 0
    private(set) var offTrail = false
    /// Whether you have reached the trail yet. Until then the next stop is its start.
    private(set) var started = false
    private(set) var location: CLLocation?
    private(set) var course: CLLocationDirection = 0
    var active: Bool { route != nil }

    @ObservationIgnored private let manager = CLLocationManager()
    @ObservationIgnored private var path = TrailPath([])

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.activityType = .fitness
        manager.distanceFilter = 5
    }

    var length: CLLocationDistance { path.length }
    var remaining: CLLocationDistance { max(path.length - along, 0) }
    var arrived: Bool { active && remaining < 25 }
    /// Stops already reached (the start counts once you are on the way).
    var reached: Int { started ? stops.filter { $0.along <= along + 20 }.count : 0 }
    var next: TrailStop? { started ? stops.first { $0.along > along + 20 } : stops.first }
    var toNext: CLLocationDistance {
        guard started else { return toStart }
        return max((next?.along ?? path.length) - along, 0)
    }
    /// Straight-line metres from where you are to the trail's start.
    var toStart: CLLocationDistance {
        guard let location, let first = path.points.first else { return 0 }
        return TrailPath.metres(location.coordinate, first)
    }

    static func bearing(from a: CLLocationCoordinate2D, to b: CLLocationCoordinate2D) -> CLLocationDirection {
        let lat1 = a.latitude * .pi / 180, lat2 = b.latitude * .pi / 180, dLon = (b.longitude - a.longitude) * .pi / 180
        let y = sin(dLon) * cos(lat2), x = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dLon)
        return (atan2(y, x) * 180 / .pi + 360).truncatingRemainder(dividingBy: 360)
    }

    func start(_ route: EcoRoute, stops: [TrailStop]) {
        self.route = route
        self.stops = stops
        path = TrailPath(route.coordinates)
        along = 0
        offTrail = false
        started = false
        if manager.authorizationStatus == .notDetermined { manager.requestWhenInUseAuthorization() }
        manager.startUpdatingLocation()
        manager.startUpdatingHeading()
    }

    func stop() {
        manager.stopUpdatingLocation()
        manager.stopUpdatingHeading()
        route = nil
        stops = []
        path = TrailPath([])
        along = 0
        offTrail = false
        started = false
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let last = locations.last else { return }
        Task { @MainActor in self.update(last) }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
        let heading = newHeading.trueHeading >= 0 ? newHeading.trueHeading : newHeading.magneticHeading
        Task { @MainActor in if self.location?.course ?? -1 < 0 { self.course = heading } }
    }

    private func update(_ here: CLLocation) {
        // Without a course from the fix (standing still, or a fix that jumped), the way you moved
        // since the last one is the heading.
        if here.course >= 0 {
            course = here.course
        } else if let last = location, here.distance(from: last) > 3 {
            course = Self.bearing(from: last.coordinate, to: here.coordinate)
        }
        location = here
        let point = path.project(here.coordinate)
        if !started, point.offset <= 60 { started = true }
        guard started else { return }
        // Never walk backwards on the trail because of a noisy fix.
        along = max(along, point.along)
        offTrail = point.offset > 60
    }
}

/// The trail's stops as a timeline: a numbered disc for each, joined by a line, with how far
/// into the walk it comes. Reached stops are filled; the next one is ringed.
struct StopTimeline: View {
    let stops: [TrailStop]
    var reached = 0
    var open: ((TrailStop) -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(stops.enumerated()), id: \.element.id) { index, stop in
                let done = index < reached
                let isNext = index == reached
                let opens = open != nil && stop.placeId != nil
                Button { if opens { open?(stop) } } label: {
                    HStack(alignment: .top, spacing: 14) {
                        VStack(spacing: 0) {
                            ZStack {
                                Circle().fill(done || stop.kind != .place ? PinTone.trail.color : Color.paper).frame(width: 30, height: 30)
                                Circle().strokeBorder(PinTone.trail.color, lineWidth: isNext ? 2.5 : 1.5).frame(width: 30, height: 30)
                                if stop.kind == .place {
                                    Text("\(index)").font(.system(size: 13, weight: .semibold).monospacedDigit()).foregroundStyle(done ? Color.onInk : PinTone.trail.color)
                                } else {
                                    Image(systemName: stop.symbol).font(.system(size: 12, weight: .semibold)).foregroundStyle(Color.onInk)
                                }
                            }
                            if index < stops.count - 1 {
                                Rectangle().fill(done ? PinTone.trail.color : Color.paper3).frame(width: 2).frame(minHeight: 26, maxHeight: .infinity)
                            }
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            Text(stop.name).type(.bodyStrong).lineLimit(2).multilineTextAlignment(.leading)
                            // The start is where the distances count from: it needs no line of its own.
                            if stop.kind != .start {
                                Text(L10n.Routes.fromStart(distance: TripText.distance(stop.along))).type(.callout, .ink3)
                            } else if stop.name != L10n.Routes.start {
                                Text(L10n.Routes.start).type(.callout, .ink3)
                            }
                        }
                        .padding(.top, 4)
                        .padding(.bottom, index < stops.count - 1 ? 14 : 0)
                        Spacer(minLength: 0)
                        if opens {
                            Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Color.ink3)
                                .padding(.top, 8)
                        }
                    }
                    .contentShape(Rectangle())
                }
                // Ends that open nothing stay at full strength, never greyed like a disabled row.
                .buttonStyle(.plain)
                .allowsHitTesting(opens)
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(isNext ? .isSelected : [])
            }
        }
    }
}

/// On the trail: the next stop in large type above, the walk's progress and a way to stop below.
struct TrailGuidance: View {
    let guide: TrailGuide
    /// Directions to the trail's start, offered while it is too far to walk to.
    var directions: (() -> Void)?

    var body: some View {
        VStack {
            HStack(spacing: 14) {
                Image(systemName: guide.arrived ? "flag.checkered" : (guide.next?.symbol ?? "figure.hiking"))
                    .font(.system(size: 24, weight: .medium))
                    .frame(width: 48, height: 48)
                    .background(Color.onInk.opacity(0.16), in: Circle())
                VStack(alignment: .leading, spacing: 2) {
                    if guide.arrived {
                        Text(L10n.Routes.arrived).font(.system(size: 20, weight: .semibold))
                    } else {
                        Text(guide.started ? L10n.Routes.nextStop : L10n.Routes.headToStart).font(.system(size: 13, weight: .medium)).opacity(0.8)
                        Text(guide.next?.name ?? L10n.Routes.end).font(.system(size: 20, weight: .semibold)).lineLimit(1)
                        Text(TripText.distance(guide.toNext)).font(.system(size: 15)).opacity(0.85).contentTransition(.numericText())
                    }
                }
                Spacer(minLength: 0)
                // Kilometres from the trail: the way there is a drive, not part of the walk.
                if !guide.started, guide.toStart > 1000, let directions {
                    Button(action: directions) {
                        Text(L10n.Map.directions).font(.system(size: 15, weight: .semibold)).foregroundStyle(PinTone.trail.color)
                            .padding(.horizontal, 14).frame(height: 36)
                            .background(Color.paper, in: Capsule())
                    }
                    .buttonStyle(Pressable())
                    .fixedSize()
                }
            }
            .foregroundStyle(Color.onInk)
            .padding(18)
            .background(PinTone.trail.color, in: RoundedRectangle(cornerRadius: Metrics.radiusPanel, style: .continuous))
            .shadow(color: .black.opacity(0.18), radius: 14, y: 6)
            .padding(.horizontal, 12)
            .accessibilityElement(children: .combine)

            if guide.offTrail, !guide.arrived {
                Label(L10n.Routes.offTrail, systemImage: "exclamationmark.triangle.fill")
                    .type(.callout)
                    .padding(.horizontal, 14).padding(.vertical, 10)
                    .floating(in: Capsule())
                    .padding(.top, 6)
                    .transition(.opacity)
            }

            Spacer()

            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(L10n.Routes.toGo(distance: TripText.distance(guide.remaining))).type(.heading).contentTransition(.numericText())
                        Text(L10n.Routes.progress(done: max(guide.reached - 1, 0), total: max(guide.stops.count - 1, 0))).type(.callout, .ink3)
                    }
                    Spacer()
                    Button(L10n.Routes.finish) { guide.stop() }.buttonStyle(.pill(.danger, compact: true))
                }
                // Progress as the trail's own colour filling a bar, with a tick for each stop.
                GeometryReader { box in
                    let fraction = guide.length > 0 ? min(guide.along / guide.length, 1) : 0
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.paper3)
                        Capsule().fill(PinTone.trail.color).frame(width: max(box.size.width * fraction, 6))
                        ForEach(guide.stops) { stop in
                            Circle().fill(stop.along <= guide.along ? Color.onInk : PinTone.trail.color)
                                .frame(width: 4, height: 4)
                                .offset(x: guide.length > 0 ? box.size.width * stop.along / guide.length - 2 : 0)
                        }
                    }
                }
                .frame(height: 6)
                .accessibilityHidden(true)
            }
            .padding(18)
            .floating(in: RoundedRectangle(cornerRadius: Metrics.radiusPanel, style: .continuous))
            .padding(.horizontal, 12)
            .padding(.bottom, 8)
        }
        .animation(Motion.quick, value: guide.offTrail)
    }
}
