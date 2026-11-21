import MapKit
import SwiftUI

/// Before leaving: how long, how far, by car or on foot, and one button to go.
struct RoutePreview: View {
    let navigator: RouteNavigator
    /// Reported closures, each as its stretch of road. Directions don't know about them, so a
    /// route that runs along one says so.
    var closures: [[CLLocationCoordinate2D]] = []
    @Environment(\.openURL) private var openURL

    /// No starting point: the fix is in Settings, and the travel modes mean nothing yet.
    private var needsLocation: Bool {
        if case .failed(let message) = navigator.phase { return message == L10n.Directions.locationError || message == L10n.Directions.permissionBody }
        return false
    }

    /// Whether the route runs along a closed stretch for more than a crossing: two of its points
    /// within a few metres of the closure's line.
    private var crossesClosure: Bool {
        guard let route = navigator.route, !closures.isEmpty else { return false }
        let points = route.polyline.points()
        let path = (0..<route.polyline.pointCount).map { points[$0].coordinate }
        return closures.contains { closure in
            let line = TrailPath(closure)
            return path.filter { line.project($0).offset < 15 }.count >= 2
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    switch navigator.phase {
                    case .failed(let message):
                        if needsLocation {
                            Text(L10n.Directions.locationErrorTitle).type(.heading)
                            Text(L10n.Directions.locationErrorBody).type(.callout, .ink3).fixedSize(horizontal: false, vertical: true)
                        } else {
                            Text(message).type(.body).fixedSize(horizontal: false, vertical: true)
                        }
                    case .loading:
                        Text(L10n.Directions.loading).type(.heading)
                    default:
                        if let route = navigator.route {
                            Text(TripText.duration(route.expectedTravelTime)).type(.display).contentTransition(.numericText())
                            Text("\(TripText.distance(route.distance)) · \(navigator.destination?.name ?? "")").type(.callout, .ink3).lineLimit(1)
                        }
                    }
                }
                Spacer(minLength: 8)
                IconButton(symbol: "xmark", label: L10n.Directions.close, glass: true) { navigator.stop() }
            }

            if crossesClosure {
                HStack(spacing: 10) {
                    TrafficSign(kind: .closed, size: 24)
                    Text(L10n.Directions.crossesClosure).type(.callout, .ink2).fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, 12).padding(.vertical, 10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(TrafficSignKind.closed.wash.opacity(0.45), in: RoundedRectangle(cornerRadius: Metrics.radiusField, style: .continuous))
                .accessibilityElement(children: .combine)
            }

            if needsLocation {
                Button(L10n.Directions.openSettings) {
                    if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                }
                .buttonStyle(.ink)
            } else {
            HStack(spacing: 8) {
                // How you travel: the route and the little model on the map follow it.
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        mode(.drive, L10n.Map.Vehicle.car, "car.fill")
                        mode(.moto, L10n.Map.Vehicle.motorcycle, "motorcycle.fill")
                        mode(.walk, L10n.Map.Vehicle.walk, "figure.walk")
                        mode(.bike, L10n.Map.Vehicle.bicycle, "bicycle")
                    }
                }
                .scrollIndicators(.hidden)
                .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
                .edgeFade(12)
                IconButton(symbol: "arrow.up.forward.app", label: L10n.Directions.openMaps) { navigator.openInMaps() }
            }
            }

            if navigator.phase == .loading {
                LoadingDots().frame(height: 52)
            } else if navigator.phase == .preview {
                Button { navigator.start() } label: { Label(L10n.Directions.start, systemImage: "location.north.fill") }.buttonStyle(.ink)
            }
        }
        .padding(18)
        .floating(in: RoundedRectangle(cornerRadius: Metrics.radiusPanel, style: .continuous))
        .padding(.horizontal, 12)
        .padding(.bottom, 8)
        .frame(maxWidth: 480)
        .sensoryFeedback(.selection, trigger: navigator.mode)
    }

    private func mode(_ mode: RouteNavigator.Mode, _ title: String, _ symbol: String) -> some View {
        Chip(title: title, symbol: symbol, selected: navigator.mode == mode) {
            guard navigator.mode != mode, let destination = navigator.destination else { return }
            Task { await navigator.plan(to: destination, mode: mode) }
        }
    }
}

/// On the way: the next turn in large type above, what is left and a way to stop below.
struct Guidance: View {
    let navigator: RouteNavigator

    var body: some View {
        VStack {
            if let step = navigator.currentStep, navigator.phase == .navigating {
                HStack(spacing: 16) {
                    Image(systemName: TripText.symbol(for: step.instructions)).font(.system(size: 30, weight: .medium))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(TripText.distance(navigator.toNextStep)).font(.system(size: 28, weight: .medium)).tracking(-0.6).contentTransition(.numericText())
                        Text(step.instructions).font(.system(size: 16, weight: .regular)).opacity(0.8).lineLimit(2)
                    }
                    Spacer(minLength: 0)
                }
                .foregroundStyle(Color.onInk)
                .padding(18)
                .background(Color.action, in: RoundedRectangle(cornerRadius: Metrics.radiusPanel, style: .continuous))
                .shadow(color: .black.opacity(0.18), radius: 14, y: 6)
                .padding(.horizontal, 12)
                .accessibilityElement(children: .combine)
                .transition(.move(edge: .top).combined(with: .opacity))
            }
            Spacer()
            HStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(navigator.phase == .arrived ? L10n.Directions.arrivedTitle : TripText.duration(navigator.remainingSeconds)).type(.title).contentTransition(.numericText())
                    if navigator.phase == .navigating {
                        Text("\(TripText.distance(navigator.remainingMeters)) · \(TripText.arrival(navigator.remainingSeconds))").type(.callout, .ink3)
                    }
                }
                Spacer()
                Button(L10n.Directions.end) { navigator.stop() }.buttonStyle(.pill(.danger, compact: true, fill: false))
            }
            .padding(18)
            .floating(in: RoundedRectangle(cornerRadius: Metrics.radiusPanel, style: .continuous))
            .padding(.horizontal, 12)
            .padding(.bottom, 8)
        }
        .frame(maxWidth: 520)
        .animation(Motion.settle, value: navigator.stepIndex)
        .sensoryFeedback(.success, trigger: navigator.phase == .arrived)
    }
}
