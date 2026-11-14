import MapKit
import PhotosUI
import RutaKit
import SwiftUI

/// A form on paper: a title bar, scrolling fields, and one ink pill pinned to the bottom.
struct FormScreen<Content: View>: View {
    let title: String
    let submit: String
    var sending = false
    var enabled = true
    let close: () -> Void
    let send: () -> Void
    @ViewBuilder let content: Content

    var body: some View {
        VStack(spacing: 0) {
            SheetBar(title: title, close: close)
            ScrollView {
                VStack(alignment: .leading, spacing: 14) { content }
                    .padding(.horizontal, Metrics.gutter)
                    .padding(.top, 8)
                    .padding(.bottom, 24)
                    .readable()
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            Button(action: send) {
                HStack(spacing: 10) {
                    if sending { ProgressView().tint(.onInk) }
                    Text(submit)
                }
            }
            .buttonStyle(.ink)
            .disabled(!enabled || sending)
            .padding(.horizontal, Metrics.gutter)
            .padding(.vertical, 10)
            .readable()
            .background(Color.paper)
        }
        .paperBackground()
    }
}

/// A small caption above a group of controls.
struct FormLabel: View {
    let text: String
    var problem = false
    var body: some View {
        Text(text).type(.label, problem ? .danger : .ink).padding(.top, 10)
    }
}

/// Wrapping chips for a short list of options (categories, municipalities).
struct ChoiceFlow<Item: Hashable>: View {
    let items: [Item]
    let selected: Item?
    let title: (Item) -> String
    var symbol: (Item) -> String? = { _ in nil }
    let pick: (Item) -> Void

    var body: some View {
        FlowLayout(spacing: 8) {
            ForEach(items, id: \.self) { item in
                Chip(title: title(item), symbol: symbol(item), selected: item == selected) { pick(item) }
            }
        }
    }
}

/// One row that opens the system menu: for lists too long to lay out as chips.
struct MenuField<Item: Hashable>: View {
    let placeholder: String
    let items: [Item]
    let selected: Item?
    let title: (Item) -> String
    var symbol: (Item) -> String? = { _ in nil }
    var problem = false
    let pick: (Item) -> Void

    var body: some View {
        Menu {
            Picker(placeholder, selection: Binding(get: { selected }, set: { if let value = $0 { pick(value) } })) {
                ForEach(items, id: \.self) { item in
                    if let symbol = symbol(item) { Label(title(item), systemImage: symbol).tag(Optional(item)) } else { Text(title(item)).tag(Optional(item)) }
                }
            }
        } label: {
            HStack(spacing: 10) {
                if let selected, let symbol = symbol(selected) { Image(systemName: symbol).font(.system(size: 16)).foregroundStyle(Color.ink) }
                Text(selected.map(title) ?? placeholder).type(.body, selected == nil ? .ink3 : .ink)
                Spacer(minLength: 8)
                Image(systemName: "chevron.up.chevron.down").font(.system(size: 12, weight: .medium)).foregroundStyle(Color.ink3)
            }
            .padding(.horizontal, 16)
            .frame(minHeight: 52)
            .background(Color.card, in: RoundedRectangle(cornerRadius: Metrics.radiusField, style: .continuous))
            .overlay { RoundedRectangle(cornerRadius: Metrics.radiusField, style: .continuous).strokeBorder(Color.line, lineWidth: 1) }
            .overlay { RoundedRectangle(cornerRadius: Metrics.radiusField, style: .continuous).strokeBorder(Color.danger, lineWidth: problem ? 1.5 : 0) }
            .contentShape(Rectangle())
        }
        .accessibilityLabel(placeholder)
        .accessibilityValue(selected.map(title) ?? "")
        .sensoryFeedback(.selection, trigger: selected)
    }
}

struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        arrange(width: proposal.width ?? .infinity, subviews: subviews).size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        for (index, point) in arrange(width: bounds.width, subviews: subviews).points.enumerated() {
            subviews[index].place(at: CGPoint(x: bounds.minX + point.x, y: bounds.minY + point.y), proposal: .unspecified)
        }
    }

    private func arrange(width: CGFloat, subviews: Subviews) -> (size: CGSize, points: [CGPoint]) {
        var points: [CGPoint] = []
        var x: CGFloat = 0, y: CGFloat = 0, row: CGFloat = 0, widest: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > width, x > 0 { x = 0; y += row + spacing; row = 0 }
            points.append(CGPoint(x: x, y: y))
            x += size.width + spacing
            row = max(row, size.height)
            widest = max(widest, x - spacing)
        }
        return (CGSize(width: widest, height: y + row), points)
    }
}

// MARK: - Photos

/// Attached photos as a row of rounded tiles, with library and camera buttons until the limit.
struct PhotoTray: View {
    let images: [Data]
    let max: Int
    let add: (Data) -> Void
    let remove: (Int) -> Void
    @State private var picked: [PhotosPickerItem] = []
    @State private var camera = false

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 10) {
                ForEach(Array(images.enumerated()), id: \.offset) { index, data in thumb(index, data) }
                if images.count < max {
                    PhotosPicker(selection: $picked, maxSelectionCount: max - images.count, matching: .images) {
                        PhotoTile(symbol: "photo.on.rectangle", title: L10n.Contribute.Photos.libraryShort)
                    }
                    if UIImagePickerController.isSourceTypeAvailable(.camera) {
                        Button { camera = true } label: { PhotoTile(symbol: "camera", title: L10n.Contribute.Photos.camera) }
                    }
                }
            }
        }
        .scrollIndicators(.hidden)
        .buttonStyle(Pressable())
        .onChange(of: picked) { _, items in
            guard !items.isEmpty else { return }
            picked = []
            Task {
                for item in items {
                    if let data = try? await item.loadTransferable(type: Data.self), let image = UIImage(data: data), let jpeg = PhotoTray.jpeg(image) {
                        withAnimation(Motion.settle) { add(jpeg) }
                    }
                }
            }
        }
        .fullScreenCover(isPresented: $camera) {
            CameraCapture { image in if let image, let jpeg = PhotoTray.jpeg(image) { add(jpeg) } }.ignoresSafeArea()
        }
    }

    @ViewBuilder private func thumb(_ index: Int, _ data: Data) -> some View {
        if let image = UIImage(data: data) {
            Image(uiImage: image).resizable().scaledToFill()
                .frame(width: 84, height: 84)
                .clipShape(RoundedRectangle(cornerRadius: Metrics.radiusField, style: .continuous))
                .overlay(alignment: .topTrailing) {
                    Button { withAnimation(Motion.settle) { remove(index) } } label: {
                        Image(systemName: "xmark").font(.system(size: 10, weight: .bold)).foregroundStyle(Color.onInk)
                            .frame(width: 22, height: 22).background(Color.action, in: Circle())
                            .frame(width: 36, height: 36, alignment: .topTrailing)
                            .padding(5)
                    }
                    .accessibilityLabel(L10n.Contribute.Photos.remove(n: index + 1))
                }
                .accessibilityLabel(L10n.Contribute.Photos.photoLabel(n: index + 1))
                .transition(.scale(scale: 0.8).combined(with: .opacity))
        }
    }

    /// At most 1600 px on the long side, as JPEG: what the server accepts without a slow upload.
    static func jpeg(_ image: UIImage) -> Data? {
        let longest = Swift.max(image.size.width, image.size.height)
        let scale = Swift.min(1, 1600 / longest)
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
            .jpegData(compressionQuality: 0.8)
    }
}

private struct PhotoTile: View {
    let symbol: String
    let title: String

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: symbol).font(.system(size: 19, weight: .light))
            Text(title).font(.system(size: 11.5, weight: .medium))
        }
        .foregroundStyle(Color.ink2)
        .frame(width: 84, height: 84)
        .background(Color.card, in: RoundedRectangle(cornerRadius: Metrics.radiusField, style: .continuous))
            .overlay { RoundedRectangle(cornerRadius: Metrics.radiusField, style: .continuous).strokeBorder(Color.line, lineWidth: 1) }
    }
}

private struct CameraCapture: UIViewControllerRepresentable {
    let done: (UIImage?) -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ controller: UIImagePickerController, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator(done: done) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let done: (UIImage?) -> Void
        init(done: @escaping (UIImage?) -> Void) { self.done = done }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            done(info[.originalImage] as? UIImage)
            picker.dismiss(animated: true)
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            done(nil)
            picker.dismiss(animated: true)
        }
    }
}

// MARK: - Location

/// The chosen point as a still map with a "change" pill, or a dashed invitation to choose one.
struct LocationField: View {
    let latitude: Double?
    let longitude: Double?
    var required = false
    var title: String = L10n.Consultations.addLocation
    let pick: (CLLocationCoordinate2D) -> Void
    @State private var picking = false

    var body: some View {
        Button { picking = true } label: {
            if let latitude, let longitude {
                PlaceCard(latitude: latitude, longitude: longitude, height: 200)
                    .overlay(alignment: .topLeading) {
                        Label(L10n.Consultations.changeLocation, systemImage: "mappin")
                            .type(.label)
                            .padding(.horizontal, 12)
                            .frame(height: 34)
                            .glassEffect(.regular, in: Capsule())
                            .padding(10)
                    }
            } else {
                HStack(spacing: 10) {
                    Image(systemName: "mappin.and.ellipse").font(.system(size: 17, weight: .light))
                    Text(title).type(.body)
                    Spacer()
                    if !required { Text(L10n.Common.optional).type(.caption, .ink3) }
                    Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Color.ink4)
                }
                .foregroundStyle(Color.ink)
                .padding(.horizontal, 16)
                .frame(height: 54)
                .background(Color.card, in: RoundedRectangle(cornerRadius: Metrics.radiusField, style: .continuous))
                .overlay { RoundedRectangle(cornerRadius: Metrics.radiusField, style: .continuous).strokeBorder(Color.line, lineWidth: 1) }
            }
        }
        .buttonStyle(Pressable(scale: 0.99))
        .sheet(isPresented: $picking) {
            LocationPicker(start: latitude.flatMap { lat in longitude.map { CLLocationCoordinate2D(latitude: lat, longitude: $0) } }) {
                pick($0)
                picking = false
            }
        }
    }
}

/// Move the map under a fixed pin, then confirm.
struct LocationPicker: View {
    let start: CLLocationCoordinate2D?
    let done: (CLLocationCoordinate2D) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var camera: MapCameraPosition = .automatic
    @State private var center: CLLocationCoordinate2D?
    @State private var moving = false

    /// Sabaneta's centre: where the map opens when the phone has no position to offer.
    private static let home = CLLocationCoordinate2D(latitude: 19.4772, longitude: -71.3414)

    var body: some View {
        ZStack {
            Map(position: $camera)
                .mapStyle(.standard(pointsOfInterest: .excludingAll))
                .onMapCameraChange(frequency: .continuous) { context in
                    center = context.region.center
                    moving = true
                }
                .onMapCameraChange(frequency: .onEnd) { _ in moving = false }
                .ignoresSafeArea()

            // The pin lifts while the map moves and lands when it stops.
            TeardropPin(height: 48)
                .offset(y: moving ? -36 : -24)
                .background { Ellipse().fill(.black.opacity(moving ? 0.12 : 0.22)).frame(width: moving ? 20 : 12, height: moving ? 7 : 5).blur(radius: 1.5) }
                .animation(Motion.settle, value: moving)
                .allowsHitTesting(false)
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            HStack {
                IconButton(symbol: "xmark", label: L10n.Common.cancel, floating: true) { dismiss() }
                Spacer()
                IconButton(symbol: "location", label: L10n.Picker.locate, floating: true) {
                    Task { if let here = await CurrentLocation.once() { withAnimation { camera = region(here) } } }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 10)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            Button(L10n.Picker.confirm) { done(center ?? start ?? Self.home) }
                .buttonStyle(.ink)
                .padding(.horizontal, Metrics.gutter)
                .padding(.bottom, 10)
                .readable()
        }
        .task {
            if let start { camera = region(start) }
            else if let here = await CurrentLocation.once(timeout: .seconds(2)) { camera = region(here) }
            else { camera = region(Self.home, meters: 3000) }
        }
        .sensoryFeedback(.impact(weight: .light), trigger: moving) { _, now in !now }
    }

    private func region(_ point: CLLocationCoordinate2D, meters: Double = 600) -> MapCameraPosition {
        .region(MKCoordinateRegion(center: point, latitudinalMeters: meters, longitudinalMeters: meters))
    }
}

/// A submitted form's last word: the mark draws in, one line, done.
struct SentView: View {
    let title: String
    var message: String?
    let done: () -> Void
    @State private var shown = false

    var body: some View {
        VStack(spacing: 18) {
            Spacer()
            Image(systemName: "checkmark")
                .font(.system(size: 30, weight: .medium))
                .foregroundStyle(Color.onInk)
                .frame(width: 76, height: 76)
                .background(Color.action, in: Circle())
                .scaleEffect(shown ? 1 : 0.6)
                .opacity(shown ? 1 : 0)
            VStack(spacing: 8) {
                Text(title).type(.title).multilineTextAlignment(.center)
                if let message { Text(message).type(.body, .ink2).multilineTextAlignment(.center) }
            }
            .rise(1)
            Spacer()
            Button(L10n.Common.done, action: done).buttonStyle(.ink).rise(2)
        }
        .padding(Metrics.gutter)
        .readable(480)
        .paperBackground()
        .onAppear { withAnimation(.spring(duration: 0.5, bounce: 0.35)) { shown = true } }
        .sensoryFeedback(.success, trigger: shown)
    }
}
