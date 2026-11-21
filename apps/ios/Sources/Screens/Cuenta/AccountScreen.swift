import RutaKit
import SwiftUI

enum AccountRoute: Hashable {
    case settings, profile, saved, passport, notifications, privacy, about, deletion, gestion, offline, consultation(String)
}

struct AccountDestination: View {
    let model: Screen<AccountViewModel, AccountUiState>
    let route: AccountRoute
    let close: () -> Void
    let openConsultation: (String) -> Void

    var body: some View {
        switch route {
        case .settings: AccountScreen(model: model)
        case .profile: ProfilePage(model: model)
        case .saved: SavedPage(items: model.state.saved, leave: close)
        case .passport: PassportPage(passport: model.state.passport, leave: close)
        case .notifications: NotificationsPage(model: model)
        case .privacy: PrivacyPage()
        case .about: AboutPage()
        case .deletion: DeletionPage(model: model)
        case .gestion: GestionScreen(openConsultation: openConsultation)
        case .offline: OfflinePage()
        case .consultation(let slug): ConsultationDetailScreen(slug: slug)
        }
    }
}

private struct AccountScreen: View {
    let model: Screen<AccountViewModel, AccountUiState>
    @State private var signingIn = false
    @State private var showingProfile = false

    var body: some View {
        root(model)
            .fullScreenCover(isPresented: $signingIn, onDismiss: { model.vm.refresh() }) { SignInScreen() }
            .sheet(isPresented: $showingProfile) {
                OwnProfileSheet(model: model)
                    .presentationCornerRadius(Metrics.radiusPanel)
            }
            .navigationTitle(L10n.Account.title)
            .navigationBarTitleDisplayMode(.large)
            .paperBackground()
            .onAppear { model.vm.refresh() }
    }

    private func root(_ model: Screen<AccountViewModel, AccountUiState>) -> some View {
        let state = model.state
        return ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if state.signedIn {
                    RowGroup {
                        Button { showingProfile = true } label: {
                            RowLabel(symbol: "person.crop.circle", title: L10n.Account.profile, value: state.me?.displayName)
                        }
                        .buttonStyle(RowPress())
                        link(.profile, "person.text.rectangle", L10n.Account.editProfile, divider: false)
                    }
                    .rise(0)

                    RowGroup {
                        link(.saved, "bookmark", L10n.Account.saved, value: "\(state.saved.count)")
                        link(.passport, "book.closed", L10n.Account.passport, value: "\(state.passport?.total ?? 0)", divider: false)
                    }
                    .rise(1)

                    if let pending = state.staffPending {
                        RowGroup { link(.gestion, "checklist", L10n.Gestion.title, badge: Int(truncating: pending), divider: false) }.rise(2)
                    }
                } else {
                    VStack(alignment: .leading, spacing: 14) {
                        Mark(size: 44)
                        Text(L10n.Account.signedOutTitle).type(.title)
                        Text(L10n.Account.signedOutBody).type(.body, .ink2)
                        Button(L10n.Account.signIn) { signingIn = true }.buttonStyle(.ink).padding(.top, 4)
                    }
                    .padding(.vertical, 8)
                    .rise(0)
                }

                RowGroup {
                    if state.signedIn { link(.notifications, "bell", L10n.NotificationSettings.title) }
                    link(.offline, "arrow.down.circle", L10n.Offline.rowTitle, divider: false)
                }
                .rise(3)

                RowGroup {
                    link(.privacy, "hand.raised", L10n.Account.privacy)
                    link(.about, "info.circle", L10n.Account.aboutApp, divider: false)
                }
                .rise(4)

                if state.signedIn {
                    Button(L10n.Account.signOut) { model.vm.signOut() }.buttonStyle(.quiet).padding(.top, 8).rise(5)
                    NavigationLink(value: AccountRoute.deletion) {
                        Text(L10n.AccountDeletion.rowTitle).type(.callout, .danger).frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .rise(5)
                }
            }
            .padding(.horizontal, Metrics.gutter)
            .padding(.top, 18)
            .padding(.bottom, 28)
            .readable()
        }
        .refreshable { model.vm.refresh() }
    }

    private func link(_ route: AccountRoute, _ symbol: String, _ title: String, value: String? = nil, badge: Int? = nil, divider: Bool = true) -> some View {
        NavigationLink(value: route) { RowLabel(symbol: symbol, title: title, value: value, badge: badge, divider: divider) }
            .buttonStyle(RowPress())
    }
}

private struct OwnProfileSheet: View {
    let model: Screen<AccountViewModel, AccountUiState>
    @Environment(\.dismiss) private var dismiss
    @State private var sheet: ReputationSheet?
    @State private var editing = false

    var body: some View {
        let state = model.state
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    ProfileHero(
                        name: state.me?.displayName,
                        image: state.me?.image,
                        place: state.municipalityName,
                        residencyVerified: state.me?.residencyVerified == true,
                        reputation: state.reputation,
                        editProfile: { editing = true },
                        explainResident: { sheet = .resident }
                    )
                    if let reputation = state.reputation {
                        RankCard(reputation: reputation) { sheet = .ranks }
                        BadgesCard(reputation: reputation) { sheet = .badge($0) }
                        RewardsSection(reputation: reputation, invite: { sheet = .invite }, enterCode: { sheet = .redeem })
                    }
                }
                .padding(.horizontal, Metrics.gutter)
                .padding(.vertical, 16)
                .readable()
            }
            .navigationTitle(L10n.Account.profile)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(L10n.Common.close, systemImage: "xmark") { dismiss() }
                        .labelStyle(.iconOnly)
                }
            }
            .navigationDestination(isPresented: $editing) { ProfilePage(model: model) }
            .sheet(item: $sheet, onDismiss: { model.vm.redeemReset(); model.vm.refresh() }) { shown in
                reputationSheet(shown, model)
            }
            .paperBackground()
        }
    }

    @ViewBuilder
    private func reputationSheet(_ shown: ReputationSheet, _ model: Screen<AccountViewModel, AccountUiState>) -> some View {
        if let reputation = model.state.reputation {
            switch shown {
            case .ranks: RankSheet(reputation: reputation) { sheet = nil }
            case .badge(let badge): BadgeSheet(badge: badge) { sheet = nil }
            case .invite: InviteFlow(reputation: reputation) { sheet = nil }
            case .resident: ResidentSheet(place: model.state.municipalityName) { sheet = nil }
            case .redeem:
                RedeemSheet(
                    state: model.state.redeem,
                    submit: { model.vm.redeemInvite(raw: $0) },
                    reset: { model.vm.redeemReset() },
                    close: { sheet = nil }
                )
            }
        }
    }
}

struct PublicProfileButton<Label: View>: View {
    let name: String?
    let image: String?
    @ViewBuilder var label: () -> Label
    @State private var showing = false

    var body: some View {
        if let name, !name.isEmpty {
            Button { showing = true } label: { label() }
                .buttonStyle(.plain)
                .accessibilityLabel(name)
                .accessibilityHint(L10n.Account.profile)
                .sheet(isPresented: $showing) { PublicProfileSheet(name: name, image: image) }
        } else {
            label()
        }
    }
}

private struct PublicProfileSheet: View {
    let name: String
    let image: String?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 12) {
            SheetBar(title: L10n.Account.profile) { dismiss() }
            ProfileHero(name: name, image: image, place: nil, residencyVerified: false, reputation: nil, explainResident: {})
                .padding(.horizontal, Metrics.gutter)
        }
        .padding(.bottom, 20)
        .frame(maxHeight: .infinity, alignment: .top)
        .paperBackground()
        .presentationDetents([.medium, .large])
        .presentationCornerRadius(Metrics.radiusPanel)
    }
}

// MARK: - Profile

private struct ProfilePage: View {
    let model: Screen<AccountViewModel, AccountUiState>
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var municipality: String?
    @State private var loaded = false

    private var tooShort: Bool { name.trimmingCharacters(in: .whitespaces).count < 2 }
    private var changed: Bool { name != (model.state.me?.displayName ?? "") || municipality != model.state.me?.municipalityId }

    var body: some View {
        Page(title: L10n.Profile.title) {
            Field(placeholder: L10n.Profile.name, text: $name).textContentType(.name)
            Text(tooShort && !name.isEmpty ? L10n.Profile.nameError : L10n.Profile.nameHelper)
                .type(.caption, tooShort && !name.isEmpty ? .danger : .ink3)

            FormLabel(text: L10n.Profile.municipality)
            ChoiceFlow(items: model.state.municipalities.map(\.id), selected: municipality, title: { id in model.state.municipalities.first { $0.id == id }?.name ?? "" }) {
                municipality = municipality == $0 ? nil : $0
            }
            Text(L10n.Profile.municipalityHelper).type(.caption, .ink3)

            if model.state.error != nil {
                Label(L10n.Common.errorTitle, systemImage: "exclamationmark.circle").type(.callout, .danger)
            }
            Button { model.vm.saveProfile(displayName: name, municipalityId: municipality) } label: {
                HStack(spacing: 10) { if model.state.savingProfile { ProgressView().tint(.onInk) }; Text(L10n.Common.save) }
            }
            .buttonStyle(.ink)
            .disabled(tooShort || !changed || model.state.savingProfile)
            .padding(.top, 10)
        }
        .onAppear {
            guard !loaded else { return }
            loaded = true
            name = model.state.me?.displayName ?? ""
            municipality = model.state.me?.municipalityId
        }
        .onChange(of: model.state.profileSaved) { _, saved in
            if saved { model.vm.profileSavedHandled(); dismiss() }
        }
        .sensoryFeedback(.success, trigger: model.state.profileSaved)
    }
}

// MARK: - Saved and passport

private struct SavedPage: View {
    let items: [PlacesSavedItem]
    /// Closes the account sheet when a row sends you to the map.
    let leave: () -> Void
    @Environment(DeepLinks.self) private var links
    @Environment(AppChrome.self) private var chrome

    var body: some View {
        Page(title: L10n.Account.saved) {
            if items.isEmpty {
                StateView(symbol: "bookmark", title: L10n.Explore.savedEmpty, message: L10n.Explore.savedEmptyBody, actionTitle: L10n.Explore.savedExplore) { chrome.tab = .map; leave() }
                    .frame(height: 360)
            } else {
                RowGroup {
                    ForEach(Array(items.enumerated()), id: \.element.id) { index, place in
                        Button { links.open("/lugares/\(place.slug)"); if links.pending == nil { links.pending = .place(slug: place.slug) }; chrome.tab = .map; leave() } label: {
                            HStack(spacing: 14) {
                                GlyphDisc(icon: place.icon, tint: .neutral)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(place.name).type(.bodyStrong)
                                    Text("\(place.categoryName) · \(place.municipalityName)").type(.callout, .ink3)
                                }
                                Spacer(minLength: 0)
                                Image(systemName: "arrow.up.right").font(.system(size: 12, weight: .medium)).foregroundStyle(Color.ink3)
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 12)
                        }
                        .buttonStyle(RowPress())
                        if index < items.count - 1 { Hairline(inset: 70) }
                    }
                }
            }
        }
    }
}

private struct PassportPage: View {
    let passport: PassportListOutput?
    let leave: () -> Void
    @Environment(AppChrome.self) private var chrome

    var body: some View {
        let items = passport?.items ?? []
        Page(title: L10n.Account.passport) {
            if items.isEmpty {
                StateView(symbol: "book.closed", title: L10n.Account.passportEmpty, message: L10n.Account.passportEmptyBody, actionTitle: L10n.Explore.savedExplore) { chrome.tab = .map; leave() }
                    .frame(height: 360)
            } else {
                Text(L10n.Account.passportLede(count: items.count)).type(.body, .ink2)
                RowGroup {
                    ForEach(Array(items.enumerated()), id: \.offset) { index, stamp in
                        HStack(spacing: 14) {
                            GlyphDisc(symbol: "mappin", tint: stamp.place.map { .solid(PinTone.of(hex: $0.categoryColor).color) } ?? .neutral)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(stamp.place?.name ?? L10n.Account.passportRemoved).type(.bodyStrong)
                                Text([stamp.place?.municipalityName, stamp.stampedAt.date.formatted(.dateTime.day().month(.abbreviated).year())].compactMap { $0 }.joined(separator: " · ")).type(.callout, .ink3)
                            }
                            Spacer(minLength: 0)
                            Image(systemName: "checkmark.seal").font(.system(size: 17, weight: .light)).foregroundStyle(Color.brand)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        if index < items.count - 1 { Hairline(inset: 70) }
                    }
                }
            }
        }
    }
}

// MARK: - Notifications

private struct NotificationsPage: View {
    let model: Screen<AccountViewModel, AccountUiState>

    var body: some View {
        Page(title: L10n.NotificationSettings.title) {
            if let p = model.state.preferences {
                RowGroup {
                    toggle(L10n.NotificationSettings.caseUpdates, L10n.NotificationSettings.caseHint, p.caseUpdatesEnabled) {
                        model.vm.setPreferences(caseUpdates: $0, traffic: p.trafficEnabled, email: p.emailEnabled)
                    }
                    Hairline(inset: 16)
                    toggle(L10n.NotificationSettings.traffic, L10n.NotificationSettings.trafficHint, p.trafficEnabled) {
                        model.vm.setPreferences(caseUpdates: p.caseUpdatesEnabled, traffic: $0, email: p.emailEnabled)
                    }
                    Hairline(inset: 16)
                    toggle(L10n.NotificationSettings.email, L10n.NotificationSettings.emailHint, p.emailEnabled) {
                        model.vm.setPreferences(caseUpdates: p.caseUpdatesEnabled, traffic: p.trafficEnabled, email: $0)
                    }
                }
                Button(L10n.NotificationSettings.openSettings) {
                    if let url = URL(string: UIApplication.openNotificationSettingsURLString) { UIApplication.shared.open(url) }
                }
                .buttonStyle(.pill(.outline, compact: true, fill: false))
                .padding(.top, 6)
            } else if model.state.loading {
                Skeleton {
                    RowGroup {
                        ForEach(0..<3) { index in
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    SkeletonLine(133)
                                    SkeletonLine(205, lineHeight: 16, barHeight: 10, relativeTo: .caption)
                                }
                                Spacer(minLength: 12)
                                Capsule().frame(width: 51, height: 31)
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 12)
                            if index < 2 { Hairline(inset: 16) }
                        }
                    }
                }
            } else {
                StateView(error: model.state.error ?? .unknown) { model.vm.refresh() }.frame(minHeight: 240)
            }
        }
    }

    private func toggle(_ title: String, _ hint: String, _ on: Bool, set: @escaping (Bool) -> Void) -> some View {
        Toggle(isOn: Binding(get: { on }, set: set)) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).type(.body)
                Text(hint).type(.caption, .ink3)
            }
        }
        .tint(.brand)
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .sensoryFeedback(.selection, trigger: on)
    }
}

// MARK: - Privacy and about

/// What the app keeps and why: one quiet row per kind of data with its short answer; the full
/// one opens in a sheet of its own.
private struct PrivacyPage: View {
    @State private var shown: PrivacyTopic?

    private var topics: [PrivacyTopic] {
        [
            PrivacyTopic(symbol: "person", title: L10n.Privacy.Account.title, summary: L10n.Privacy.Account.summary, body: L10n.Privacy.Account.body),
            PrivacyTopic(symbol: "location", title: L10n.Privacy.Location.title, summary: L10n.Privacy.Location.summary, body: L10n.Privacy.Location.body),
            PrivacyTopic(symbol: "rectangle.stack", title: L10n.Privacy.Contributions.title, summary: L10n.Privacy.Contributions.summary, body: L10n.Privacy.Contributions.body),
            PrivacyTopic(symbol: "camera", title: L10n.Privacy.Photos.title, summary: L10n.Privacy.Photos.summary, body: L10n.Privacy.Photos.body),
            PrivacyTopic(symbol: "bell", title: L10n.Privacy.Notifications.title, summary: L10n.Privacy.Notifications.summary, body: L10n.Privacy.Notifications.body),
            PrivacyTopic(symbol: "externaldrive", title: L10n.Privacy.Backups.title, summary: L10n.Privacy.Backups.summary, body: L10n.Privacy.Backups.body),
        ]
    }

    var body: some View {
        Page(title: L10n.Privacy.title) {
            Text(L10n.Privacy.lede).type(.title).fixedSize(horizontal: false, vertical: true).padding(.bottom, 6)
            RowGroup {
                ForEach(Array(topics.enumerated()), id: \.offset) { index, topic in
                    Button { shown = topic } label: {
                        VStack(spacing: 0) {
                            HStack(alignment: .center, spacing: 14) {
                                Image(systemName: topic.symbol).font(.system(size: 17, weight: .light)).foregroundStyle(Color.ink).frame(width: 24)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(topic.title).type(.bodyStrong)
                                    Text(topic.summary).type(.callout, .ink3).multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                                }
                                Spacer(minLength: 8)
                                Image(systemName: "chevron.right").font(.system(size: 12, weight: .medium)).foregroundStyle(Color.ink4)
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 13)
                            if index < topics.count - 1 { Hairline(inset: 54) }
                        }
                    }
                    .buttonStyle(RowPress())
                    .accessibilityHint(L10n.Privacy.showDetailsHint)
                    .rise(index)
                }
            }
        }
        .sheet(item: $shown) { topic in
            VStack(alignment: .leading, spacing: 16) {
                SheetBar(title: L10n.Privacy.detailsTitle) { shown = nil }.padding(.horizontal, -16)
                HStack(spacing: 12) {
                    GlyphDisc(symbol: topic.symbol, size: 44)
                    Text(topic.title).type(.title)
                }
                Text(topic.body).type(.body).lineSpacing(4).fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, Metrics.gutter)
            .paperBackground()
            .presentationDetents([.medium, .large])
            .presentationCornerRadius(Metrics.radiusPanel)
        }
    }
}

private struct PrivacyTopic: Identifiable {
    let symbol: String
    let title: String
    let summary: String
    let body: String
    var id: String { title }
}

private struct AboutPage: View {
    @Environment(\.openURL) private var openURL
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var settled = false

    private var name: String { Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String ?? "" }
    private var version: String {
        let info = Bundle.main.infoDictionary
        return L10n.About.version(version: info?["CFBundleShortVersionString"] as? String ?? "", build: info?["CFBundleVersion"] as? String ?? "")
    }

    var body: some View {
        Page(title: L10n.About.title) {
            // The mark, the name, and what the app is for: nothing else competes with them.
            VStack(spacing: 0) {
                Mark(size: 92)
                    .scaleEffect(settled || reduceMotion ? 1 : 0.82)
                    .opacity(settled ? 1 : 0)
                Text(name).font(.system(size: 30, weight: .bold)).tracking(-0.8).foregroundStyle(Color.ink).padding(.top, 22).rise(1)
                Text(L10n.About.tagline).type(.body, .ink2).multilineTextAlignment(.center).lineSpacing(3).padding(.top, 8).padding(.horizontal, 12).rise(2)
                Text(version)
                    .font(.system(size: 12.5, weight: .medium).monospacedDigit())
                    .foregroundStyle(Color.ink3)
                    .padding(.horizontal, 12)
                    .frame(height: 28)
                    .background(Color.paper2, in: Capsule())
                    .padding(.top, 18)
                    .rise(3)
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 20)
            .padding(.bottom, 26)
            .accessibilityElement(children: .combine)

            // The three towns it covers, in the landing's accents.
            HStack(spacing: 8) {
                town(L10n.About.Town.sabaneta, .brand)
                town(L10n.About.Town.moncion, .brand)
                town(L10n.About.Town.almacigos, .brand)
            }
            .rise(4)

            RowGroup {
                Button { open("https://rutacibao.app") } label: { RowLabel(symbol: "globe", title: "rutacibao.app", divider: true) }.buttonStyle(RowPress())
                Button { open("https://rutacibao.app/privacy") } label: { RowLabel(symbol: "hand.raised", title: L10n.Account.privacy) }.buttonStyle(RowPress())
                RowLabel(symbol: "map", title: L10n.About.maps, value: "Apple", chevron: false, divider: false)
            }
            .padding(.top, 12)
            .rise(5)

            HStack(spacing: 10) {
                Image(systemName: "trophy").font(.system(size: 15, weight: .light)).foregroundStyle(Color.ink3)
                Text(L10n.About.contest).type(.caption, .ink3)
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 14)
        }
        .onAppear { withAnimation(.spring(duration: 0.6, bounce: 0.3)) { settled = true } }
    }

    private func open(_ address: String) { if let url = URL(string: address) { openURL(url) } }

    private func town(_ name: String, _ tint: Tint) -> some View {
        VStack(spacing: 8) {
            TeardropPin(height: 22, color: .brand)
            // A fixed two-line slot, so every pin stands at the same height.
            Text(name).font(.system(size: 13, weight: .medium)).foregroundStyle(Color.ink).lineLimit(2).multilineTextAlignment(.center).minimumScaleFactor(0.85)
                .frame(height: 34, alignment: .top)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 16)
        .padding(.bottom, 10)
        .padding(.horizontal, 6)
        // Grey tiles: the green stays on the pins, the one thing that is the brand's here.
        .background(Color.paper2, in: RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
    }
}

// MARK: - Deletion

private struct DeletionPage: View {
    let model: Screen<AccountViewModel, AccountUiState>
    @State private var typed = ""

    private var word: String { L10n.AccountDeletion.confirmWord }
    private var working: Bool { model.state.deletion == .working }

    var body: some View {
        Page(title: L10n.AccountDeletion.title) {
            Text(L10n.AccountDeletion.lede).type(.body, .ink2)

            FormLabel(text: L10n.AccountDeletion.deletedTitle)
            RowGroup {
                line("person.crop.circle.badge.xmark", L10n.AccountDeletion.deletedAccount)
                Hairline(inset: 54)
                line("trash", L10n.AccountDeletion.deletedContributions)
                Hairline(inset: 54)
                line("iphone", L10n.AccountDeletion.deletedDevice)
            }

            FormLabel(text: L10n.AccountDeletion.keptTitle)
            Text(L10n.AccountDeletion.keptResponses).type(.callout, .ink3)
            Text(L10n.AccountDeletion.keptAudit).type(.callout, .ink3)

            Field(placeholder: L10n.AccountDeletion.confirmLabel(word: word), text: $typed)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
                .padding(.top, 10)
            Text(model.state.deletion == .needsRecentSignIn ? L10n.AccountDeletion.reauthNoticeBody : L10n.AccountDeletion.confirmHelper)
                .type(.caption, model.state.deletion == .needsRecentSignIn || model.state.deletion == .failed ? .danger : .ink3)

            Button { model.vm.requestDeletion() } label: {
                HStack(spacing: 10) { if working { ProgressView() }; Text(L10n.AccountDeletion.submitAction) }
            }
            .buttonStyle(.pill(.danger))
            .disabled(typed.trimmingCharacters(in: .whitespaces).uppercased() != word.uppercased() || working)
        }
    }

    private func line(_ symbol: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: symbol).font(.system(size: 17, weight: .light)).foregroundStyle(Color.ink).frame(width: 24)
            Text(text).type(.callout, .ink2)
            Spacer(minLength: 0)
        }
        .padding(16)
    }
}

extension PlacesSavedItem: @retroactive Identifiable {}

/// The reputation sheets, one at a time. Moving from the invite to the contacts replaces one
/// sheet with the next instead of stacking them.
enum ReputationSheet: Identifiable, Hashable {
    case ranks, invite, redeem, resident
    case badge(BadgeProgress)

    var id: String {
        switch self {
        case .ranks: "ranks"
        case .invite: "invite"
        case .resident: "resident"
        case .redeem: "redeem"
        case .badge(let badge): "badge-\(badge.id.name)"
        }
    }
}
