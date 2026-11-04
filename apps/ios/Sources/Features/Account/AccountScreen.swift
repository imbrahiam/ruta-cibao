import Observation
import RutaKit
import SwiftUI

@Observable
final class AccountModel {
    private(set) var state: AccountUiState
    @ObservationIgnored private let scope: ScreenScope
    @ObservationIgnored let viewModel: AccountViewModel

    init(graph: AppGraph) {
        scope = ScreenScope(graph: graph)
        viewModel = scope.account()
        state = viewModel.state.value
    }

    func observe() async {
        for await next in viewModel.state { state = next }
    }

    isolated deinit { scope.close() }
}

private enum AccountRoute: Hashable { case profile, saved, passport, notifications, privacy, about, deletion, gestion, offline, consultation(String) }

struct AccountScreen: View {
    @Environment(\.graph) private var graph
    @State private var model: AccountModel?
    @State private var path = Self.initialPath

    /// Debug-only: `SIMCTL_CHILD_RUTA_DEBUG_TAB=gestion` opens Cuenta with Gestión pushed.
    private static var initialPath: [AccountRoute] {
        #if DEBUG
        if ProcessInfo.processInfo.environment["RUTA_DEBUG_COMPOSE"] == "offline" { return [.offline] }
        return ProcessInfo.processInfo.environment["RUTA_DEBUG_TAB"] == "gestion" ? [.gestion] : []
        #else
        []
        #endif
    }

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if let model {
                    if model.state.signedIn {
                        SignedInAccount(model: model)
                    } else {
                        SignedOutAccount()
                    }
                } else {
                    Color.clear
                }
            }
            .tabBarClearance()
            .navigationTitle(L10n.Account.title)
            .toolbarVisibility(.hidden, for: .navigationBar)
            .accessibilityElement(children: .contain)
            .accessibilityLabel(L10n.Account.title)
            .navigationDestination(for: AccountRoute.self) { route in
                if let model { destination(route, model).tabBarClearance() }
            }
        }
        .task {
            guard let graph else { return }
            let model = self.model ?? AccountModel(graph: graph)
            self.model = model
            await model.observe()
        }
    }

    @ViewBuilder private func destination(_ route: AccountRoute, _ model: AccountModel) -> some View {
        Group {
            switch route {
            case .profile: ProfileEditor(model: model)
            case .saved: SavedPlaces(items: model.state.saved)
            case .passport: PassportStamps(passport: model.state.passport)
            case .notifications: NotificationSettingsView(model: model)
            case .privacy: PrivacyView()
            case .about: AboutView()
            case .deletion: DeletionView(model: model)
            case .gestion: GestionScreen(openConsultation: { path.append(.consultation($0)) })
            case .consultation(let slug): ConsultationDetailScreen(slug: slug)
            case .offline: OfflineScreen()
            }
        }
        .toolbarVisibility(.visible, for: .navigationBar)
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Signed out

private struct SignedOutAccount: View {
    @Environment(\.palette) private var palette
    @State private var signingIn = false

    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            BrandMark(size: 80)
            VStack(spacing: 10) {
                Text(L10n.Account.signedOutTitle)
                    .font(.system(size: 28, weight: .bold))
                    .tracking(-0.4)
                Text(L10n.Account.signedOutBody)
                    .foregroundStyle(palette.textSecondary)
            }
            .multilineTextAlignment(.center)
            Spacer()
            NavigationLink(value: AccountRoute.offline) { Text(L10n.Offline.rowTitle) }
            Button { signingIn = true } label: {
                Text(L10n.Account.signIn).font(.headline).frame(maxWidth: .infinity, minHeight: 52)
            }
            .buttonStyle(RutaProminentStyle())
        }
        .padding(24)
        .fullScreenCover(isPresented: $signingIn) { SignInScreen() }
    }
}

// MARK: - Signed in

private struct SignedInAccount: View {
    let model: AccountModel
    @Environment(\.palette) private var palette
    @Environment(\.colorScheme) private var scheme
    @Environment(\.graph) private var graph
    @State private var confirmingSignOut = false

    private var state: AccountUiState { model.state }
    private var staffPending: Int? { state.staffPending.map { Int(truncating: $0) } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                NavigationLink(value: AccountRoute.profile) { header }
                    .padding(.top, 12)
                    .buttonStyle(.plain)
                    .padding(.horizontal, AccountMetrics.inset)

                Text(L10n.Account.yours)
                    .font(.headline)
                    .accessibilityAddTraits(.isHeader)
                    .padding(.horizontal, AccountMetrics.inset)
                    .padding(.top, 28)
                    .padding(.bottom, 12)
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 12) { shortcuts }
                    VStack(spacing: 12) { shortcuts }
                }
                .padding(.horizontal, AccountMetrics.inset)
                .padding(.bottom, staffPending == nil ? 20 : 4)
                if let pending = staffPending {
                    NavigationLink(value: AccountRoute.gestion) {
                        SettingsRow(symbol: "checklist", title: L10n.Gestion.title, count: pending)
                    }
                    .buttonStyle(.plain)
                    .accessibilityValue(L10n.Gestion.pending(count: pending))
                    GroupDivider()
                }
                link(.notifications, "bell.fill", L10n.NotificationSettings.title, badge: .red)
                link(.offline, "arrow.down.circle.fill", L10n.Offline.rowTitle, badge: .green)
                GroupDivider()
                link(.privacy, "hand.raised.fill", L10n.Account.privacy, badge: .blue)
                link(.about, "info", L10n.Account.aboutApp, badge: .gray)
                GroupDivider()
                Button { confirmingSignOut = true } label: {
                    SettingsRow(symbol: "rectangle.portrait.and.arrow.right", title: L10n.Account.signOut, chevron: false)
                }
                .buttonStyle(.plain)
                link(.deletion, "trash", L10n.AccountDeletion.rowTitle, tint: palette.dangerInk)
            }
            .padding(.bottom, 16)
        }
        .refreshable { model.viewModel.refresh() }
        .confirmationDialog(L10n.Account.signOut, isPresented: $confirmingSignOut, titleVisibility: .hidden) {
            Button(L10n.Account.signOut, role: .destructive) {
                // Unbind this phone's push token while the session still exists.
                Task {
                    _ = try? await graph?.push.unregister()
                    model.viewModel.signOut()
                }
            }
            Button(L10n.Common.cancel, role: .cancel) {}
        }
    }

    private func link(_ route: AccountRoute, _ symbol: String, _ title: String, tint: Color? = nil, badge: Color? = nil) -> some View {
        NavigationLink(value: route) {
            SettingsRow(symbol: symbol, title: title, tint: tint, badge: badge)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder private var shortcuts: some View {
        shortcut(.saved, symbol: "bookmark.fill", title: L10n.Account.saved, count: state.saved.count)
        shortcut(.passport, symbol: "seal.fill", title: L10n.Account.passport, count: Int(state.passport?.total ?? 0))
    }

    private func shortcut(_ route: AccountRoute, symbol: String, title: String, count: Int) -> some View {
        NavigationLink(value: route) {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Image(systemName: symbol)
                        .foregroundStyle(RutaHighlight.color)
                        .accessibilityHidden(true)
                    Spacer(minLength: 8)
                    Text(verbatim: "\(count)")
                        .monospacedDigit()
                        .foregroundStyle(palette.textSecondary)
                }
                .font(.title3.weight(.semibold))
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(16)
            .frame(minWidth: 140, maxWidth: .infinity, alignment: .leading)
            .background(palette.raised(scheme), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .contentShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
    }

    private var header: some View {
        HStack(spacing: 16) {
            AuthorAvatar(name: state.me?.displayName ?? "", image: state.me?.image, size: 64)
            VStack(alignment: .leading, spacing: 4) {
                Text(state.me?.displayName ?? " ")
                    .font(.title3.weight(.bold))
                    .redacted(reason: state.me == nil ? .placeholder : [])
                if state.me?.residencyVerified == true, let place = state.municipalityName {
                    Label(L10n.Account.resident(place: place), systemImage: "checkmark.seal.fill")
                        .font(.footnote)
                        .foregroundStyle(palette.textSecondary)
                        .labelStyle(TrailingIconLabelStyle(tint: RutaBrand.iris))
                }
                Text(L10n.Account.profile)
                    .font(.subheadline)
                    .foregroundStyle(palette.textSecondary)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(palette.textTertiary)
                .accessibilityHidden(true)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(palette.raised(scheme), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .contentShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }


}

private struct TrailingIconLabelStyle: LabelStyle {
    let tint: Color
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 4) {
            configuration.title
            configuration.icon.foregroundStyle(tint).font(.footnote)
        }
    }
}

// MARK: - Profile

private struct ProfileEditor: View {
    let model: AccountModel
    @Environment(\.palette) private var palette
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var municipality: String?
    @State private var loaded = false

    private var tooShort: Bool { name.trimmingCharacters(in: .whitespaces).count < 2 }

    var body: some View {
        Form {
            Section {
                TextField(L10n.Profile.name, text: $name)
                    .textContentType(.name)
                    .font(.body.weight(.semibold))
            } header: {
                Text(L10n.Profile.name)
            } footer: {
                Text(tooShort && !name.isEmpty ? L10n.Profile.nameError : L10n.Profile.nameHelper)
                    .foregroundStyle(tooShort && !name.isEmpty ? palette.dangerInk : palette.textTertiary)
            }
            Section {
                Picker(L10n.Profile.municipality, selection: $municipality) {
                    Text(verbatim: "—").tag(String?.none)
                    ForEach(model.state.municipalities, id: \.id) { m in Text(m.name).tag(Optional(m.id)) }
                }
            } footer: {
                Text(L10n.Profile.municipalityHelper)
            }
        }
        .navigationTitle(L10n.Profile.title)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button(L10n.Common.save) { model.viewModel.saveProfile(displayName: name, municipalityId: municipality) }
                    .disabled(tooShort || model.state.savingProfile)
            }
        }
        .onAppear {
            guard !loaded else { return }
            loaded = true
            name = model.state.me?.displayName ?? ""
            municipality = model.state.me?.municipalityId
        }
        .onChange(of: model.state.profileSaved) { _, saved in
            if saved {
                model.viewModel.profileSavedHandled()
                dismiss()
            }
        }
        .sensoryFeedback(.success, trigger: model.state.profileSaved)
    }
}

// MARK: - Saved and passport

private struct SavedPlaces: View {
    let items: [PlacesSavedItem]
    @Environment(\.palette) private var palette
    @Environment(DeepLinks.self) private var links

    var body: some View {
        List(items, id: \.id) { place in
            Button { links.pending = .place(slug: place.slug) } label: {
                HStack(spacing: 12) {
                    CategoryPinBadge(icon: place.icon, hex: place.color, size: 36)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(place.name).font(PostMetrics.name)
                        Text("\(place.categoryName) · \(place.municipalityName)").font(PostMetrics.text).foregroundStyle(palette.textTertiary)
                    }
                    Spacer(minLength: 8)
                    Image(systemName: "chevron.right")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(palette.textTertiary)
                        .accessibilityHidden(true)
                }
                .padding(.vertical, 6)
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .overlay {
            if items.isEmpty {
                EmptyState(art: .colmado, title: L10n.Explore.savedEmpty, message: L10n.Explore.savedEmptyBody)
            }
        }
        .navigationTitle(L10n.Account.saved)
    }
}

private struct PassportStamps: View {
    let passport: PassportListOutput?
    @Environment(\.palette) private var palette

    var body: some View {
        let items = passport?.items ?? []
        List(items, id: \.id) { stamp in
            HStack(spacing: 12) {
                Image(systemName: "seal.fill").font(.title3).foregroundStyle(.purple).accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(stamp.place?.name ?? L10n.Account.passportRemoved).font(PostMetrics.name)
                    Text(stamp.stampedAt.date, format: .dateTime.day().month(.wide).year())
                        .font(PostMetrics.text).foregroundStyle(palette.textTertiary)
                }
            }
        }
        .overlay {
            if items.isEmpty {
                EmptyState(symbol: "seal", title: L10n.Account.passportEmpty, message: L10n.Account.passportEmptyBody)
            }
        }
        .navigationTitle(L10n.Account.passport)
    }
}

// MARK: - Notifications

private struct NotificationSettingsView: View {
    let model: AccountModel

    var body: some View {
        let p = model.state.preferences
        Form {
            if let p {
                Section {
                    Toggle(isOn: Binding(get: { p.caseUpdatesEnabled }, set: { model.viewModel.setPreferences(caseUpdates: $0, traffic: p.trafficEnabled, email: p.emailEnabled) })) {
                        labeled(L10n.NotificationSettings.caseUpdates, L10n.NotificationSettings.caseHint)
                    }
                    Toggle(isOn: Binding(get: { p.trafficEnabled }, set: { model.viewModel.setPreferences(caseUpdates: p.caseUpdatesEnabled, traffic: $0, email: p.emailEnabled) })) {
                        labeled(L10n.NotificationSettings.traffic, L10n.NotificationSettings.trafficHint)
                    }
                    Toggle(isOn: Binding(get: { p.emailEnabled }, set: { model.viewModel.setPreferences(caseUpdates: p.caseUpdatesEnabled, traffic: p.trafficEnabled, email: $0) })) {
                        labeled(L10n.NotificationSettings.email, L10n.NotificationSettings.emailHint)
                    }
                } footer: {
                    Text(L10n.NotificationSettings.intro)
                }
            } else {
                ProgressView()
            }
        }
        .navigationTitle(L10n.NotificationSettings.title)
    }

    private func labeled(_ title: String, _ hint: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
            Text(hint).font(.footnote).foregroundStyle(.secondary)
        }
    }
}

// MARK: - Privacy and about

/// Privacy as a short, plain page: a shield, one line of intent, then each
/// kind of data as an icon, a title and a sentence or two.
private struct PrivacyView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                PageHeader(symbol: "hand.raised.fill", title: L10n.Privacy.title, lede: L10n.Privacy.lede)
                VStack(alignment: .leading, spacing: 24) {
                    InfoItem(symbol: "phone", title: L10n.Privacy.Account.title, text: L10n.Privacy.Account.body)
                    InfoItem(symbol: "location", title: L10n.Privacy.Location.title, text: L10n.Privacy.Location.body)
                    InfoItem(symbol: "text.bubble", title: L10n.Privacy.Contributions.title, text: L10n.Privacy.Contributions.body)
                    InfoItem(symbol: "photo", title: L10n.Privacy.Photos.title, text: L10n.Privacy.Photos.body)
                    InfoItem(symbol: "bell", title: L10n.Privacy.Notifications.title, text: L10n.Privacy.Notifications.body)
                    InfoItem(symbol: "lock", title: L10n.Privacy.Device.title, text: L10n.Privacy.Device.body)
                    InfoItem(symbol: "server.rack", title: L10n.Privacy.Providers.title, text: L10n.Privacy.Providers.bodyNative)
                }
            }
            .padding(.horizontal, AccountMetrics.inset)
            .padding(.top, 8)
            .padding(.bottom, 32)
        }
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct AboutView: View {
    var body: some View {
        let info = Bundle.main.infoDictionary
        ScrollView {
            VStack(spacing: 28) {
                VStack(spacing: 14) {
                    BrandMark(size: 72)
                    Text(L10n.About.tagline)
                        .font(.body)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.top, 24)

                VStack(spacing: 0) {
                    InfoRow(title: L10n.About.title, value: L10n.About.version(
                        version: info?["CFBundleShortVersionString"] as? String ?? "",
                        build: info?["CFBundleVersion"] as? String ?? ""
                    ))
                    Divider()
                    InfoRow(title: L10n.About.maps, value: L10n.About.mapsCreditNative)
                }

                Text(L10n.About.contest)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, AccountMetrics.inset)
            .padding(.bottom, 32)
        }
        .navigationTitle(L10n.About.title)
        .navigationBarTitleDisplayMode(.inline)
    }
}

enum AccountMetrics {
    /// Airbnb's menu gutter: wider than the feed's, so the rows breathe.
    static let inset: CGFloat = 24
}

/// A page's opening: an icon in a soft disc, a large title, one line.
private struct PageHeader: View {
    let symbol: String
    let title: String
    let lede: String
    @Environment(\.palette) private var palette
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 26, weight: .medium))
                .foregroundStyle(.primary)
                .frame(width: 56, height: 56)
                .background(palette.raised(scheme), in: Circle())
                .accessibilityHidden(true)
            Text(title)
                .font(.largeTitle.weight(.bold))
                .accessibilityAddTraits(.isHeader)
            Text(lede)
                .font(.body)
                .foregroundStyle(.secondary)
        }
    }
}

private struct InfoItem: View {
    let symbol: String
    let title: String
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            Image(systemName: symbol)
                .font(.system(size: 20, weight: .regular))
                .frame(width: 28, height: 24)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.headline)
                Text(text)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

private struct InfoRow: View {
    let title: String
    let value: String

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
            Spacer(minLength: 16)
            Text(value).foregroundStyle(.secondary).multilineTextAlignment(.trailing)
        }
        .font(.subheadline)
        .frame(minHeight: 52)
    }
}

// MARK: - Deletion

private struct DeletionView: View {
    let model: AccountModel
    @Environment(\.palette) private var palette
    @State private var typed = ""

    private var word: String { L10n.AccountDeletion.confirmWord }

    var body: some View {
        Form {
            Section { Text(L10n.AccountDeletion.lede) }
            Section(L10n.AccountDeletion.deletedTitle) {
                Label(L10n.AccountDeletion.deletedAccount, systemImage: "person.crop.circle.badge.xmark")
                Label(L10n.AccountDeletion.deletedContributions, systemImage: "trash")
                Label(L10n.AccountDeletion.deletedDevice, systemImage: "iphone")
            }
            .font(.subheadline)
            Section(L10n.AccountDeletion.keptTitle) {
                Text(L10n.AccountDeletion.keptResponses)
                Text(L10n.AccountDeletion.keptAudit)
            }
            .font(.subheadline)
            .foregroundStyle(palette.textSecondary)

            Section {
                TextField(L10n.AccountDeletion.confirmLabel(word: word), text: $typed)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                Button(role: .destructive) {
                    model.viewModel.requestDeletion()
                } label: {
                    if model.state.deletion == .working { ProgressView() } else { Text(L10n.AccountDeletion.submitAction) }
                }
                .disabled(typed.trimmingCharacters(in: .whitespaces).uppercased() != word.uppercased() || model.state.deletion == .working)
            } footer: {
                switch model.state.deletion {
                case .needsRecentSignIn: Text(L10n.AccountDeletion.reauthNoticeBody).foregroundStyle(palette.dangerInk)
                case .failed: Text(L10n.Common.errorBody).foregroundStyle(palette.dangerInk)
                default: Text(L10n.AccountDeletion.confirmHelper)
                }
            }
        }
        .navigationTitle(L10n.AccountDeletion.title)
    }
}
