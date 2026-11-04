import MapKit
import SwiftUI

/// Pick a point by moving the map under a fixed pin. Starts on `start`, or
/// the user's location.
struct LocationPicker: View {
    var start: CLLocationCoordinate2D?
    let done: (CLLocationCoordinate2D) -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(\.palette) private var palette
    @State private var camera: MapCameraPosition
    @State private var center: CLLocationCoordinate2D?
    @State private var moving = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(start: CLLocationCoordinate2D?, done: @escaping (CLLocationCoordinate2D) -> Void) {
        self.start = start
        self.done = done
        _camera = State(initialValue: start.map {
            .region(MKCoordinateRegion(center: $0, latitudinalMeters: 800, longitudinalMeters: 800))
        } ?? .userLocation(fallback: .region(MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 19.4757, longitude: -71.3418),
            latitudinalMeters: 3000, longitudinalMeters: 3000
        ))))
        _center = State(initialValue: start)
    }

    var body: some View {
        NavigationStack {
            Map(position: $camera) { UserAnnotation() }
                .mapStyle(.standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll))
                .mapControls { MapUserLocationButton() }
                .tint(palette.locate)
                .onMapCameraChange(frequency: .continuous) { center = $0.region.center; moving = true }
                .onMapCameraChange(frequency: .onEnd) { _ in moving = false }
                .overlay {
                    // The pin's tip marks the centre of the map; it lifts
                    // while the map moves and drops back when it settles.
                    DropPin(lifted: moving)
                        .animation(reduceMotion ? nil : .snappy(duration: 0.2), value: moving)
                        .allowsHitTesting(false)
                        .accessibilityHidden(true)
                }
                .safeAreaInset(edge: .bottom) {
                    Button {
                        if let center { done(center) }
                        dismiss()
                    } label: {
                        Text(L10n.Picker.confirm).font(.headline).frame(maxWidth: .infinity, minHeight: 52)
                    }
                    .buttonStyle(RutaProminentStyle())
                    .disabled(center == nil)
                    .padding(.horizontal, 20)
                    .padding(.bottom, 8)
                }
                .navigationTitle(L10n.Picker.title)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button(L10n.Common.cancel) { dismiss() }
                    }
                }
        }
    }
}

/// Apple Maps' marked-location pin: a red head with a white dot on a short
/// stem, and its shadow on the ground at the exact point.
private struct DropPin: View {
    let lifted: Bool

    var body: some View {
        ZStack(alignment: .bottom) {
            Ellipse()
                .fill(.black.opacity(lifted ? 0.18 : 0.3))
                .frame(width: lifted ? 14 : 10, height: 4)
            VStack(spacing: 0) {
                Circle()
                    .fill(Color(.systemRed).gradient)
                    .frame(width: 30, height: 30)
                    .overlay { Circle().fill(.white).frame(width: 10, height: 10) }
                    .overlay { Circle().strokeBorder(.white, lineWidth: 2) }
                    .shadow(color: .black.opacity(0.25), radius: 3, y: 2)
                Capsule()
                    .fill(Color(.systemGray))
                    .frame(width: 3, height: 16)
            }
            .offset(y: lifted ? -14 : -2)
        }
        // Lift the drawing so the shadow, not the pin's middle, sits on the centre.
        .offset(y: -23)
    }
}
