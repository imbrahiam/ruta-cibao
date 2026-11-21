import RutaKit
import SwiftUI
import UIKit

struct PhoneField: View {
    let placeholder: String
    @Binding var text: String
    @State private var focused = false

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: Metrics.radiusField, style: .continuous)
        FormattedPhoneTextField(placeholder: placeholder, text: $text, focused: $focused)
            .padding(.horizontal, 16)
            .frame(height: 52)
            .background(focused ? Color.paper : Color.paper2, in: shape)
            .overlay { if focused { shape.strokeBorder(Color.action, lineWidth: 1.5) } }
    }
}

private struct FormattedPhoneTextField: UIViewRepresentable {
    let placeholder: String
    @Binding var text: String
    @Binding var focused: Bool

    func makeUIView(context: Context) -> UITextField {
        let field = UITextField()
        field.delegate = context.coordinator
        field.keyboardType = .phonePad
        field.textContentType = .telephoneNumber
        field.font = .preferredFont(forTextStyle: .body)
        field.adjustsFontForContentSizeCategory = true
        field.textColor = UIColor(Color.ink)
        field.tintColor = UIColor(Color.action)
        field.attributedPlaceholder = NSAttributedString(string: placeholder, attributes: [.foregroundColor: UIColor(Color.ink3)])
        field.accessibilityLabel = placeholder
        field.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        return field
    }

    func updateUIView(_ field: UITextField, context: Context) {
        context.coordinator.parent = self
        if field.text != text { field.text = text }
    }

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    final class Coordinator: NSObject, UITextFieldDelegate {
        var parent: FormattedPhoneTextField

        init(parent: FormattedPhoneTextField) { self.parent = parent }

        func textFieldDidBeginEditing(_ textField: UITextField) { parent.focused = true }
        func textFieldDidEndEditing(_ textField: UITextField) { parent.focused = false }

        func textField(_ field: UITextField, shouldChangeCharactersIn range: NSRange, replacementString replacement: String) -> Bool {
            let previous = field.text ?? ""
            guard let selection = Range(range, in: previous) else { return false }
            let input = previous.replacingCharacters(in: selection, with: replacement)
            var deletion: Phone.Deletion?
            if replacement.isEmpty, range.length > 0, let selected = field.selectedTextRange, selected.isEmpty {
                let cursor = field.offset(from: field.beginningOfDocument, to: selected.start)
                deletion = range.location < cursor ? .backward : .forward
            }
            let next = Phone.shared.editInput(
                previous: previous, input: input,
                caret: Int32(range.location + replacement.utf16.count), deletion: deletion
            )
            field.text = next.value
            if let cursor = field.position(from: field.beginningOfDocument, offset: Int(next.caret)) {
                field.selectedTextRange = field.textRange(from: cursor, to: cursor)
            }
            parent.text = next.value
            return false
        }
    }
}
