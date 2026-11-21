import Contacts
import MessageUI
import SwiftUI

/// One person from the address book, as far as inviting needs: never sent anywhere.
struct InviteContact: Identifiable, Hashable, Sendable {
    struct Number: Hashable, Sendable {
        let label: String?
        let value: String
    }

    let id: String
    let name: String
    let numbers: [Number]
    let photo: Data?
}

/// Phone numbers as people here write them: 809-555-0123 for any North American number
/// (Dominican ones included), anything else as it came.
enum PhoneFormat {
    static func display(_ raw: String) -> String {
        let digits = raw.filter(\.isNumber)
        var local: Substring?
        if digits.count == 10 {
            local = Substring(digits)
        } else if digits.count == 11, digits.hasPrefix("1") {
            local = digits.dropFirst()
        }
        // Every North American number (Dominican ones included) reads the same way: 809-555-0123.
        if let local {
            return "\(local.prefix(3))-\(local.dropFirst(3).prefix(3))-\(local.suffix(4))"
        }
        return raw.trimmingCharacters(in: .whitespaces)
    }
}

/// Pick who to invite, as a step of the invite flow. The address book is read on this phone and
/// stays here; "Invitar por SMS" opens Messages with a personal link you can still read and edit,
/// and the row confirms once it was sent. Atrás returns to the invite; the X leaves the flow.
struct ContactsInviteView: View {
    let message: String
    let shareURL: URL
    let back: () -> Void
    let close: () -> Void

    private enum Access { case unknown, granted, denied }

    @State private var access: Access = .unknown
    @State private var contacts: [InviteContact] = []
    @State private var loaded = false
    @State private var query = ""
    @State private var invited: Set<String> = []
    @State private var composing: Composition?
    @State private var sharing: InviteContact?
    @State private var choosing: InviteContact?
    @Environment(\.openURL) private var openURL

    private struct Composition: Identifiable {
        let contact: InviteContact
        let number: String
        var id: String { contact.id + number }
    }

    private var canText: Bool { MFMessageComposeViewController.canSendText() }

    private var shown: [InviteContact] {
        let needle = query.trimmingCharacters(in: .whitespaces).folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
        guard !needle.isEmpty else { return contacts }
        return contacts.filter { $0.name.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current).contains(needle) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            switch access {
            case .unknown: loadingList
            case .denied: denied
            case .granted: list
            }
        }
        .frame(maxHeight: .infinity, alignment: .top)
        .paperBackground()
        .navigationTitle(L10n.Reputation.inviteContacts)
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden()
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button(action: back) {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left").font(.system(size: 15, weight: .semibold))
                        Text(L10n.Common.back)
                    }
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button(action: close) { Image(systemName: "xmark") }.accessibilityLabel(L10n.Common.close)
            }
        }
        .task { await start() }
        .sheet(item: $composing) { item in
            MessageComposer(recipient: item.number, body: message) { sent in
                if sent { withAnimation(Motion.quick) { _ = invited.insert(item.contact.id) } }
                composing = nil
            }
            .ignoresSafeArea()
        }
        .sheet(item: $sharing) { contact in
            ActivitySheet(items: [message]) { done in
                if done { withAnimation(Motion.quick) { _ = invited.insert(contact.id) } }
                sharing = nil
            }
            .presentationDetents([.medium, .large])
        }
        .confirmationDialog(L10n.Reputation.chooseNumber, isPresented: Binding(get: { choosing != nil }, set: { if !$0 { choosing = nil } }), titleVisibility: .visible, presenting: choosing) { contact in
            ForEach(contact.numbers, id: \.self) { number in
                Button([number.label, PhoneFormat.display(number.value)].compactMap { $0 }.joined(separator: ": ")) {
                    composing = Composition(contact: contact, number: number.value)
                }
            }
        }
    }

    private var loadingList: some View {
        Skeleton {
            VStack(alignment: .leading, spacing: 8) {
                RoundedRectangle(cornerRadius: Metrics.radiusField).frame(height: 52)
                SkeletonLine(208, lineHeight: 16, barHeight: 10, relativeTo: .caption)
                loadingRows
            }
            .padding(.horizontal, Metrics.gutter)
            .padding(.top, 8)
        }
    }

    private var loadingRows: some View {
        VStack(spacing: 0) {
            ForEach(0..<5) { _ in
                HStack(spacing: 12) {
                    Circle().frame(width: 40, height: 40)
                    VStack(alignment: .leading, spacing: 2) {
                        SkeletonLine(136)
                        SkeletonLine(96, lineHeight: 17, barHeight: 10, relativeTo: .callout)
                    }
                    Spacer(minLength: 0)
                    Capsule().frame(width: 89, height: 30)
                }
                .frame(minHeight: 44)
                .padding(.vertical, 6)
            }
        }
    }

    private var list: some View {
        VStack(alignment: .leading, spacing: 8) {
            Field(placeholder: L10n.Reputation.searchContacts, text: $query, symbol: "magnifyingglass")
                .padding(.horizontal, Metrics.gutter)
                .padding(.top, 8)
            Label(L10n.Reputation.contactsPrivate, systemImage: "lock").type(.caption, .ink3).padding(.horizontal, Metrics.gutter)

            if !loaded {
                Skeleton { loadingRows.padding(.horizontal, Metrics.gutter).padding(.top, 4) }
            } else if contacts.isEmpty {
                // Nobody to pick: the link still works, so it is the way forward.
                VStack(spacing: 14) {
                    Image(systemName: "person.crop.circle").font(.system(size: 30, weight: .light)).foregroundStyle(Color.ink3)
                    Text(L10n.Reputation.contactsEmpty).type(.heading)
                    ShareLink(item: shareURL, message: Text(message)) { Label(L10n.Reputation.shareLink, systemImage: "square.and.arrow.up") }
                        .buttonStyle(.pill(.outline, compact: true, fill: false))
                }
                .frame(maxWidth: .infinity, minHeight: 260)
            } else if !shown.isEmpty {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(shown) { contact in row(contact) }
                    }
                    .padding(.top, 4)
                    .padding(.bottom, 24)
                }
                .scrollDismissesKeyboard(.immediately)
            } else {
                Text(L10n.Reputation.noMatches).type(.body, .ink3).padding(Metrics.gutter)
            }
        }
    }

    private func row(_ contact: InviteContact) -> some View {
        let done = invited.contains(contact.id)
        let first = contact.numbers.first?.value ?? ""
        return HStack(spacing: 12) {
            ContactFace(contact: contact)
            // The action and the number keep their whole width; a long name gives way instead.
            VStack(alignment: .leading, spacing: 2) {
                // The name reads first; the number is there to tell two Marías apart.
                Text(contact.name).type(.bodyStrong).lineLimit(1).truncationMode(.tail)
                HStack(spacing: 6) {
                    Text(PhoneFormat.display(first)).font(.system(size: 14).monospacedDigit()).foregroundStyle(Color.ink3).lineLimit(1).fixedSize()
                    if contact.numbers.count > 1 {
                        Text("+\(contact.numbers.count - 1)").font(.system(size: 11.5, weight: .semibold)).foregroundStyle(Color.ink3).fixedSize()
                            .padding(.horizontal, 6).frame(height: 18).background(Color.paper2, in: Capsule())
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Button {
                if !canText { sharing = contact } else if contact.numbers.count > 1 { choosing = contact } else { composing = Composition(contact: contact, number: first) }
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: done ? "checkmark" : "message.fill").font(.system(size: 11, weight: .bold))
                    Text(done ? L10n.Reputation.invited : (canText ? L10n.Reputation.inviteBySms : L10n.Reputation.prepareMessage))
                }
                .font(.system(size: 13, weight: .semibold))
                .lineLimit(1)
                .fixedSize()
                .foregroundStyle(done ? Color.ink2 : Color.brandDeep)
                .padding(.horizontal, 11)
                .frame(height: 30)
                .background(done ? Color.paper2 : Color.brandSoft, in: Capsule())
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(Pressable())
            .layoutPriority(1)
            .accessibilityLabel(done ? "\(contact.name), \(L10n.Reputation.invited)" : "\(canText ? L10n.Reputation.inviteBySms : L10n.Reputation.prepareMessage), \(contact.name)")
        }
        .padding(.horizontal, Metrics.gutter)
        .padding(.vertical, 6)
    }

    private var denied: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(L10n.Reputation.contactsDeniedTitle).type(.title).padding(.top, 24)
            Text(L10n.Reputation.contactsDeniedBody).type(.body, .ink2)
            Button(L10n.Reputation.openSettings) {
                if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
            }
            .buttonStyle(.ink)
            .padding(.top, 8)
            ShareLink(item: shareURL, message: Text(message)) { Label(L10n.Reputation.shareLink, systemImage: "square.and.arrow.up") }
                .buttonStyle(.pill(.outline))
        }
        .padding(.horizontal, Metrics.gutter)
    }

    private func start() async {
        guard access == .unknown else { return }
        let store = CNContactStore()
        switch CNContactStore.authorizationStatus(for: .contacts) {
        case .authorized, .limited:
            access = .granted
        case .notDetermined:
            let granted = (try? await store.requestAccess(for: .contacts)) ?? false
            access = granted ? .granted : .denied
        default:
            access = .denied
        }
        guard access == .granted else { return }
        contacts = await Task.detached(priority: .userInitiated) { Self.read(store) }.value
        loaded = true
    }

    private nonisolated static func read(_ store: CNContactStore) -> [InviteContact] {
        let keys = [
            CNContactGivenNameKey, CNContactFamilyNameKey, CNContactOrganizationNameKey, CNContactPhoneNumbersKey,
            CNContactThumbnailImageDataKey,
        ] as [CNKeyDescriptor]
        let request = CNContactFetchRequest(keysToFetch: keys)
        request.sortOrder = .givenName
        var people: [InviteContact] = []
        try? store.enumerateContacts(with: request) { contact, _ in
            let numbers = contact.phoneNumbers.map { labelled in
                InviteContact.Number(label: labelled.label.map { CNLabeledValue<CNPhoneNumber>.localizedString(forLabel: $0) }, value: labelled.value.stringValue)
            }
            guard !numbers.isEmpty else { return }
            let name = [contact.givenName, contact.familyName].filter { !$0.isEmpty }.joined(separator: " ")
            let shown = name.isEmpty ? contact.organizationName : name
            guard !shown.isEmpty else { return }
            people.append(InviteContact(id: contact.identifier, name: shown, numbers: numbers, photo: contact.thumbnailImageData))
        }
        return people
    }
}

/// A contact's photo when the address book has one; soft initials otherwise, so the name and
/// not the circle is what reads first.
private struct ContactFace: View {
    let contact: InviteContact

    var body: some View {
        Group {
            if let data = contact.photo, let image = UIImage(data: data) {
                Image(uiImage: image).resizable().scaledToFill()
            } else {
                let tone = PersonTone.of(contact.name)
                Text(PersonAvatar.initials(of: contact.name))
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(tone.ink)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(tone.fill)
            }
        }
        .frame(width: 40, height: 40)
        .clipShape(Circle())
        .accessibilityHidden(true)
    }
}

/// Messages, prefilled with the invite. Says whether it was sent.
struct MessageComposer: UIViewControllerRepresentable {
    let recipient: String
    let body: String
    let finished: (Bool) -> Void

    func makeUIViewController(context: Context) -> MFMessageComposeViewController {
        let controller = MFMessageComposeViewController()
        controller.recipients = [recipient]
        controller.body = body
        controller.messageComposeDelegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ controller: MFMessageComposeViewController, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator(finished: finished) }

    final class Coordinator: NSObject, MFMessageComposeViewControllerDelegate {
        let finished: (Bool) -> Void
        init(finished: @escaping (Bool) -> Void) { self.finished = finished }
        func messageComposeViewController(_ controller: MFMessageComposeViewController, didFinishWith result: MessageComposeResult) {
            finished(result == .sent)
        }
    }
}

/// The system share sheet, for phones that cannot send texts (iPad, the Simulator).
struct ActivitySheet: UIViewControllerRepresentable {
    let items: [Any]
    let finished: (Bool) -> Void

    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
        controller.completionWithItemsHandler = { _, completed, _, _ in finished(completed) }
        return controller
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
