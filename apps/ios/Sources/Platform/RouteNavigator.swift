import ActivityKit
import OSLog
import AVFoundation
import CoreLocation
import MapKit
import SwiftUI

/// Where a route goes: a place or a trail's start.
struct Destination: Equatable {
    let name: String
    let coordinate: CLLocationCoordinate2D

    static func == (a: Destination, b: Destination) -> Bool {
        a.name == b.name && a.coordinate.latitude == b.coordinate.latitude && a.coordinate.longitude == b.coordinate.longitude
    }
}

/// Turn-by-turn inside the app, on MapKit's directions: plan from where you
/// are, preview the line, then follow it step by step. Each new step is
/// spoken; leaving the route for long enough plans it again from there.
@MainActor @Observable
final class RouteNavigator: NSObject, CLLocationManagerDelegate {
    enum Mode: Hashable { case drive, walk }
    enum Phase: Equatable { case idle, loading, preview, navigating, arrived, failed(String) }

    private(set) var phase: Phase = .idle
    private(set) var route: MKRoute?
    private(set) var destination: Destination?
    private(set) var stepIndex = 0
    private(set) var toNextStep: CLLocationDistance = 0
    private(set) var remainingMeters: CLLocationDistance = 0
    private(set) var remainingSeconds: TimeInterval = 0
    private(set) var location: CLLocation?
    private(set) var course: CLLocationDirection = 0
    var mode: Mode = .drive

    @ObservationIgnored private let manager = CLLocationManager()
    @ObservationIgnored private let voice = AVSpeechSynthesizer()
    @ObservationIgnored private var offRouteCount = 0
    @ObservationIgnored private var activity: Activity<NavigationAttributes>?
    @ObservationIgnored private var lastActivityPush = Date.distantPast
    @ObservationIgnored private var replanning = false

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        manager.activityType = .otherNavigation
    }

    /// The steps that say something (MapKit's first step is often blank).
    var steps: [MKRoute.Step] { route?.steps.filter { !$0.instructions.isEmpty } ?? [] }
    var currentStep: MKRoute.Step? { steps.indices.contains(stepIndex) ? steps[stepIndex] : nil }

    func plan(to destination: Destination, mode: Mode? = nil) async {
        if let mode { self.mode = mode }
        self.destination = destination
        if phase != .navigating { phase = .loading }
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .denied, .restricted:
            phase = .failed(L10n.Directions.permissionBody)
            return
        default:
            break
        }
        manager.startUpdatingLocation()
        guard let here = await currentLocation() else {
            phase = .failed(L10n.Directions.locationError)
            return
        }
        let request = MKDirections.Request()
        request.source = MKMapItem(location: here, address: nil)
        request.destination = MKMapItem(location: CLLocation(latitude: destination.coordinate.latitude, longitude: destination.coordinate.longitude), address: nil)
        request.transportType = self.mode == .drive ? .automobile : .walking
        do {
            let response = try await MKDirections(request: request).calculate()
            guard let best = response.routes.first else { phase = .failed(L10n.Directions.noRoute); return }
            route = best
            stepIndex = 0
            remainingMeters = best.distance
            remainingSeconds = best.expectedTravelTime
            if phase != .navigating { phase = .preview; manager.stopUpdatingLocation() }
        } catch {
            phase = .failed(L10n.Directions.unavailable)
        }
    }

    func start() {
        guard route != nil else { return }
        phase = .navigating
        offRouteCount = 0
        // Keep guiding with the screen locked (blue pill in the status bar).
        manager.allowsBackgroundLocationUpdates = true
        manager.pausesLocationUpdatesAutomatically = false
        manager.showsBackgroundLocationIndicator = true
        manager.startUpdatingLocation()
        manager.startUpdatingHeading()
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .voicePrompt, options: [.duckOthers, .interruptSpokenAudioAndMixWithOthers])
        speakCurrent()
        startActivity()
    }

    func stop() {
        endActivity(arrived: false)
        manager.allowsBackgroundLocationUpdates = false
        manager.stopUpdatingLocation()
        manager.stopUpdatingHeading()
        voice.stopSpeaking(at: .immediate)
        phase = .idle
        route = nil
        destination = nil
    }

    func openInMaps() {
        guard let destination else { return }
        let item = MKMapItem(location: CLLocation(latitude: destination.coordinate.latitude, longitude: destination.coordinate.longitude), address: nil)
        item.name = destination.name
        item.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: mode == .drive ? MKLaunchOptionsDirectionsModeDriving : MKLaunchOptionsDirectionsModeWalking])
    }

    // MARK: Location

    private var waiters: [CheckedContinuation<CLLocation?, Never>] = []

    private func currentLocation() async -> CLLocation? {
        if let recent = manager.location, recent.timestamp.timeIntervalSinceNow > -30 { return recent }
        return await withCheckedContinuation { continuation in
            waiters.append(continuation)
            manager.requestLocation()
            Task {
                try? await Task.sleep(for: .seconds(8))
                self.resolveWaiters(with: self.manager.location)
            }
        }
    }

    private func resolveWaiters(with location: CLLocation?) {
        let pending = waiters
        waiters = []
        pending.forEach { $0.resume(returning: location) }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let last = locations.last else { return }
        Task { @MainActor in self.update(with: last) }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in self.resolveWaiters(with: nil) }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in
            if status == .authorizedWhenInUse || status == .authorizedAlways { self.manager.requestLocation() }
            if status == .denied || status == .restricted { self.resolveWaiters(with: nil) }
        }
    }

    private func update(with here: CLLocation) {
        location = here
        resolveWaiters(with: here)
        if here.course >= 0 { course = here.course }
        guard phase == .navigating, let route else { return }

        // Progress along the current step: done when we reach its end.
        if let step = currentStep {
            let end = step.polyline.coordinate(at: step.polyline.pointCount - 1)
            toNextStep = here.distance(from: CLLocation(latitude: end.latitude, longitude: end.longitude))
            if toNextStep < (mode == .drive ? 30 : 12) {
                stepIndex += 1
                if currentStep == nil { arrive(); return }
                speakCurrent()
                updateActivity(force: true)
            }
        }
        let later = steps.dropFirst(stepIndex + 1).reduce(0) { $0 + $1.distance }
        remainingMeters = toNextStep + later
        remainingSeconds = route.distance > 0 ? route.expectedTravelTime * remainingMeters / route.distance : 0
        updateActivity()

        // Off the line for a few fixes: plan again from here.
        if route.polyline.distance(to: here.coordinate) > 70 {
            offRouteCount += 1
            if offRouteCount >= 3, !replanning, let destination {
                replanning = true
                offRouteCount = 0
                Task {
                    await plan(to: destination)
                    replanning = false
                    speakCurrent()
                }
            }
        } else {
            offRouteCount = 0
        }
    }

    private func arrive() {
        phase = .arrived
        endActivity(arrived: true)
        manager.allowsBackgroundLocationUpdates = false
        manager.stopUpdatingLocation()
        manager.stopUpdatingHeading()
        speak(L10n.Directions.arrivedTitle)
    }

    // MARK: Live Activity

    private var activityState: NavigationAttributes.ContentState {
        let instruction = currentStep?.instructions ?? L10n.Directions.stepFallback
        return NavigationAttributes.ContentState(
            symbol: TripText.symbol(for: instruction),
            stepDistance: TripText.distance(toNextStep),
            instruction: instruction,
            remaining: "\(TripText.duration(remainingSeconds)) · \(TripText.distance(remainingMeters))",
            arrival: phase == .arrived ? L10n.Directions.arrivedTitle : TripText.arrival(remainingSeconds),
            arrived: phase == .arrived
        )
    }

    private func startActivity() {
        guard activity == nil, let destination else { return }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            Self.log.info("live activity: disabled in Settings")
            return
        }
        do {
            activity = try Activity.request(
                attributes: NavigationAttributes(destination: destination.name, walking: mode == .walk),
                content: ActivityContent(state: activityState, staleDate: Date().addingTimeInterval(120))
            )
            Self.log.info("live activity: started")
        } catch {
            Self.log.error("live activity: request failed \(String(describing: error), privacy: .public)")
        }
    }

    private static let log = Logger(subsystem: "do.rutacibao.app", category: "navigation")

    /// A new step always pushes; otherwise at most every 5 s (ActivityKit's budget).
    private func updateActivity(force: Bool = false) {
        guard let activity, force || Date().timeIntervalSince(lastActivityPush) > 5 else { return }
        lastActivityPush = Date()
        let content = ActivityContent(state: activityState, staleDate: Date().addingTimeInterval(120))
        // ActivityKit's `Activity` isn't marked Sendable, but updating it from any task is supported.
        nonisolated(unsafe) let live = activity
        Task { await live.update(content) }
    }

    /// Arrived: "Llegaste" stays two minutes; ended by hand: gone at once.
    private func endActivity(arrived: Bool) {
        guard let activity else { return }
        self.activity = nil
        let content = ActivityContent(state: activityState, staleDate: nil)
        nonisolated(unsafe) let live = activity
        let policy: ActivityUIDismissalPolicy = arrived ? .after(Date().addingTimeInterval(120)) : .immediate
        Task { await live.end(content, dismissalPolicy: policy) }
    }

    private func speakCurrent() {
        guard let step = currentStep else { return }
        speak(step.instructions)
    }

    private func speak(_ text: String) {
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: "es-DO") ?? AVSpeechSynthesisVoice(language: "es-MX")
        voice.stopSpeaking(at: .word)
        voice.speak(utterance)
    }
}

private extension MKPolyline {
    func coordinate(at index: Int) -> CLLocationCoordinate2D {
        var c = CLLocationCoordinate2D()
        getCoordinates(&c, range: NSRange(location: max(0, index), length: 1))
        return c
    }

    /// Rough distance from a point to the line: nearest vertex (dense enough
    /// for MapKit's route polylines to tell "on it" from "a street away").
    func distance(to point: CLLocationCoordinate2D) -> CLLocationDistance {
        let here = CLLocation(latitude: point.latitude, longitude: point.longitude)
        var best = CLLocationDistance.greatestFiniteMagnitude
        let stride = max(1, pointCount / 400)
        for i in Swift.stride(from: 0, to: pointCount, by: stride) {
            let c = coordinate(at: i)
            best = min(best, here.distance(from: CLLocation(latitude: c.latitude, longitude: c.longitude)))
        }
        return best
    }
}

// MARK: - Formatting

enum TripText {
    static func duration(_ seconds: TimeInterval) -> String {
        let minutes = max(1, Int((seconds / 60).rounded()))
        if minutes < 60 { return L10n.Directions.durationMinutes(minutes: String(minutes)) }
        return L10n.Directions.durationHours(hours: String(minutes / 60), minutes: String(minutes % 60))
    }

    static func distance(_ meters: CLLocationDistance) -> String {
        if meters < 1000 { return L10n.Directions.distanceMeters(distance: String(Int((meters / 10).rounded() * 10))) }
        return L10n.Directions.distanceKilometers(distance: (meters / 1000).formatted(.number.precision(.fractionLength(1))))
    }

    static func arrival(_ seconds: TimeInterval) -> String {
        L10n.Directions.arrival(time: Date.now.addingTimeInterval(seconds).formatted(date: .omitted, time: .shortened))
    }

    /// A maneuver glyph from the instruction's words (MapKit doesn't expose the maneuver).
    static func symbol(for instruction: String) -> String {
        let text = instruction.lowercased()
        if text.contains("rotonda") || text.contains("roundabout") { return "arrow.triangle.turn.up.right.circle" }
        if text.contains("izquierda") || text.contains("left") { return "arrow.turn.up.left" }
        if text.contains("derecha") || text.contains("right") { return "arrow.turn.up.right" }
        if text.contains("destino") || text.contains("llega") || text.contains("arrive") { return "mappin.and.ellipse" }
        return "arrow.up"
    }
}

// MARK: - Chrome

/// The route before you go: time, distance, how to travel, and Start.
