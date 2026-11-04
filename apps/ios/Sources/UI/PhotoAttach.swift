import PhotosUI
import SwiftUI
import UIKit

/// Photos for a contribution: take one with the camera (when there is one)
/// or pick from the library, both with the system's own UI. Thumbnails sit
/// in a row with a remove control. Each image is downscaled to a JPEG before
/// it's handed on, so uploads stay small on a mobile connection.
struct PhotoAttach: View {
    let max: Int
    let add: (Data) -> Void
    let remove: (Int) -> Void

    @Environment(\.palette) private var palette
    @State private var thumbs: [UIImage] = []
    @State private var library: [PhotosPickerItem] = []
    @State private var camera = false

    private var hasCamera: Bool { UIImagePickerController.isSourceTypeAvailable(.camera) }
    private var room: Int { Swift.max(0, max - thumbs.count) }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if !thumbs.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Array(thumbs.enumerated()), id: \.offset) { index, image in
                            Image(uiImage: image)
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: 92, height: 92)
                                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                .overlay(alignment: .topTrailing) {
                                    Button {
                                        thumbs.remove(at: index)
                                        remove(index)
                                    } label: {
                                        Image(systemName: "xmark")
                                            .font(.system(size: 11, weight: .bold))
                                            .frame(width: 24, height: 24)
                                            .background(.ultraThinMaterial, in: Circle())
                                            .frame(width: 44, height: 44)
                                            .contentShape(Rectangle())
                                    }
                                    .buttonStyle(.plain)
                                    .offset(x: 10, y: -10)
                                    .accessibilityLabel(L10n.Contribute.Photos.remove(n: index + 1))
                                }
                        }
                    }
                    .padding(.top, 4)
                }
                .scrollClipDisabled()
            }

            if room > 0 {
                HStack(spacing: 10) {
                    if hasCamera {
                        Button { camera = true } label: {
                            Label(L10n.Contribute.Photos.camera, systemImage: "camera")
                                .font(.subheadline.weight(.semibold))
                                .lineLimit(1)
                                .frame(maxWidth: .infinity, minHeight: 48)
                        }
                        .buttonStyle(.glass)
                    }
                    PhotosPicker(selection: $library, maxSelectionCount: room, matching: .images, photoLibrary: .shared()) {
                        Label(L10n.Contribute.Photos.libraryShort, systemImage: "photo.on.rectangle")
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity, minHeight: 48)
                    }
                    .buttonStyle(.glass)
                    .accessibilityLabel(L10n.Contribute.Photos.library)
                }
            }
        }
        .onChange(of: library) { _, items in
            guard !items.isEmpty else { return }
            library = []
            Task {
                for item in items {
                    guard let data = try? await item.loadTransferable(type: Data.self),
                          let image = UIImage(data: data) else { continue }
                    take(image)
                }
            }
        }
        .fullScreenCover(isPresented: $camera) {
            CameraPicker { take($0) }.ignoresSafeArea()
        }
    }

    private func take(_ image: UIImage) {
        guard thumbs.count < max, let jpeg = Self.jpeg(image) else { return }
        thumbs.append(image)
        add(jpeg)
    }

    /// Longest side 2048 px, JPEG at 0.8: sharp enough to moderate, about
    /// half a megabyte.
    static func jpeg(_ image: UIImage) -> Data? {
        let longest = Swift.max(image.size.width, image.size.height)
        let scale = Swift.min(1, 2048 / Swift.max(longest, 1))
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let resized = UIGraphicsImageRenderer(size: size, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
        return resized.jpegData(compressionQuality: 0.8)
    }
}

/// The system camera, for one photo.
private struct CameraPicker: UIViewControllerRepresentable {
    let done: (UIImage) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ controller: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker
        init(_ parent: CameraPicker) { self.parent = parent }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let image = info[.originalImage] as? UIImage { parent.done(image) }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { parent.dismiss() }
    }
}
