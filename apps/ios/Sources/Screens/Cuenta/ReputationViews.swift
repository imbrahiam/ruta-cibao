import RutaKit
import SwiftUI

// MARK: - Ranks: a personality each

/// Each rank has its own emblem and colour, so the level never borrows the verification's
/// check: a house for the neighbour, binoculars for the explorer, a compass for the guide and
/// a crown for the legend.
extension RankId {
    var title: String {
        switch self {
        case .vecino: L10n.Reputation.Rank.vecino
        case .explorador: L10n.Reputation.Rank.explorador
        case .guia: L10n.Reputation.Rank.guia
        case .leyenda: L10n.Reputation.Rank.leyenda
        }
    }

    var line: String {
        switch self {
        case .vecino: L10n.Reputation.RankLine.vecino
        case .explorador: L10n.Reputation.RankLine.explorador
        case .guia: L10n.Reputation.RankLine.guia
        case .leyenda: L10n.Reputation.RankLine.leyenda
        }
    }

    var symbol: String {
        switch self {
        case .vecino: "house.fill"
        case .explorador: "binoculars.fill"
        case .guia: "safari.fill"
        case .leyenda: "crown.fill"
        }
    }

    var tint: Color {
        switch self {
        case .vecino: Color.solid(0xC0623A)
        case .explorador: Color.solid(0xA9740F)
        case .guia: Color.brand
        case .leyenda: Color.solid(0x6A4A9E)
        }
    }
}

/// A rank's emblem: its symbol on its colour, with a white ring when it sits on something.
struct RankEmblem: View {
    let rank: RankId
    var size: CGFloat = 40
    var reached = true
    var ring = false

    var body: some View {
        Image(systemName: rank.symbol)
            .font(.system(size: size * 0.44, weight: .semibold))
            .foregroundStyle(reached ? Color.onInk : Color.ink4)
            .frame(width: size, height: size)
            .background(reached ? rank.tint : Color.paper, in: Circle())
            .overlay { if !reached { Circle().strokeBorder(Color.ink4.opacity(0.6), lineWidth: 1.5) } }
            .overlay { if ring { Circle().strokeBorder(Color.paper, lineWidth: size * 0.09) } }
            .accessibilityHidden(true)
    }
}

// MARK: - Badges: names and glyphs

extension BadgeId {
    var title: String {
        switch self {
        case .firstContribution: L10n.Reputation.Badge.FirstContribution.title
        case .traveller: L10n.Reputation.Badge.Traveller.title
        case .threeTowns: L10n.Reputation.Badge.ThreeTowns.title
        case .watchful: L10n.Reputation.Badge.Watchful.title
        case .civicVoice: L10n.Reputation.Badge.CivicVoice.title
        case .roadWatch: L10n.Reputation.Badge.RoadWatch.title
        case .host: L10n.Reputation.Badge.Host.title
        }
    }

    var how: String {
        switch self {
        case .firstContribution: L10n.Reputation.Badge.FirstContribution.how
        case .traveller: L10n.Reputation.Badge.Traveller.how
        case .threeTowns: L10n.Reputation.Badge.ThreeTowns.how
        case .watchful: L10n.Reputation.Badge.Watchful.how
        case .civicVoice: L10n.Reputation.Badge.CivicVoice.how
        case .roadWatch: L10n.Reputation.Badge.RoadWatch.how
        case .host: L10n.Reputation.Badge.Host.how
        }
    }

    var symbol: String {
        switch self {
        case .firstContribution: "sparkles"
        case .traveller: "book.closed.fill"
        case .threeTowns: "map.fill"
        case .watchful: "eye.fill"
        case .civicVoice: "megaphone.fill"
        case .roadWatch: "road.lanes"
        case .host: "person.2.fill"
        }
    }
}

extension ContributionKind {
    var title: String {
        switch self {
        case .place: L10n.Reputation.Kind.place
        case .route: L10n.Reputation.Kind.route
        case .consultation: L10n.Reputation.Kind.consultation
        case .traffic: L10n.Reputation.Kind.traffic
        case .confirmation: L10n.Reputation.Kind.confirmation
        case .stamp: L10n.Reputation.Kind.stamp
        case .support: L10n.Reputation.Kind.support
        case .invite: L10n.Reputation.Kind.invite
        }
    }

    var symbol: String {
        switch self {
        case .place: "mappin.and.ellipse"
        case .route: "figure.hiking"
        case .consultation: "bubble.left.and.text.bubble.right"
        case .traffic: "exclamationmark.triangle"
        case .confirmation: "checkmark.circle"
        case .stamp: "book.closed"
        case .support: "hand.thumbsup"
        case .invite: "person.badge.plus"
        }
    }
}

// MARK: - People

/// Someone shown by face: their photo when they have one, their initials on a soft colour of
/// their own otherwise. A name is never shown alone when there is a face to go with it.
struct PersonAvatar: View {
    let name: String?
    var image: String?
    var size: CGFloat = 40

    var body: some View {
        Group {
            if let image, let url = URL(string: image) {
                AsyncImage(url: url) { phase in
                    if let picture = phase.image { picture.resizable().scaledToFill() } else { initials }
                }
            } else {
                initials
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .accessibilityHidden(true)
    }

    private var initials: some View {
        let tone = PersonTone.of(name ?? "")
        return Text(Self.initials(of: name))
            .font(.system(size: size * 0.38, weight: .semibold))
            .foregroundStyle(tone.ink)
            .frame(width: size, height: size)
            .background(tone.fill)
    }

    static func initials(of name: String?) -> String {
        let parts = (name ?? "").split(separator: " ").prefix(2).compactMap(\.first)
        return parts.isEmpty ? "·" : String(parts).uppercased()
    }
}

/// A steady, soft colour per name: a pale wash with the same hue for the letters.
enum PersonTone {
    case clay, sea, pine, sun, plum, teal

    static func of(_ name: String) -> PersonTone {
        let all: [PersonTone] = [.clay, .sea, .pine, .sun, .plum, .teal]
        return all[name.unicodeScalars.reduce(0) { $0 + Int($1.value) } % all.count]
    }

    var fill: Color {
        switch self {
        case .clay: Color.solid(0xF7E3D9)
        case .sea: Color.solid(0xDDE8F4)
        case .pine: Color.brandSoft
        case .sun: Color.solid(0xF6ECD2)
        case .plum: Color.solid(0xECE3F3)
        case .teal: Color.solid(0xDCEEEC)
        }
    }

    var ink: Color {
        switch self {
        case .clay: Color.solid(0xA44E2C)
        case .sea: Color.solid(0x2C5D8F)
        case .pine: Color.brandDeep
        case .sun: Color.solid(0x8A6410)
        case .plum: Color.solid(0x6A4A9E)
        case .teal: Color.solid(0x2D706A)
        }
    }
}

/// A few faces overlapping in a row: the people who joined.
struct FacePile: View {
    let people: [Person]
    var size: CGFloat = 26

    var body: some View {
        HStack(spacing: -size * 0.32) {
            ForEach(Array(people.prefix(4).enumerated()), id: \.offset) { index, person in
                PersonAvatar(name: person.name, image: person.image, size: size)
                    // The ring sits outside the face, so the one behind reads as a separate person.
                    .padding(2)
                    .background(Color.paper, in: Circle())
                    .zIndex(Double(10 - index))
            }
        }
        .accessibilityHidden(true)
    }
}

/// The invite's illustration: four neighbours, drawn in code, overlapping in a row.
struct FaceRow: View {
    var size: CGFloat = 52

    private let faces: [Color] = [
        Color(red: 0.85, green: 0.45, blue: 0.27),
        Color(red: 0.84, green: 0.68, blue: 0.29),
        Color.brand,
        Color(red: 0.33, green: 0.45, blue: 0.72),
    ]

    var body: some View {
        HStack(spacing: -size * 0.28) {
            ForEach(Array(faces.enumerated()), id: \.offset) { index, tone in
                Circle()
                    .fill(tone.gradient)
                    .frame(width: size, height: size)
                    .overlay {
                        Image(systemName: "face.smiling.inverse")
                            .font(.system(size: size * 0.58, weight: .regular))
                            .foregroundStyle(.white.opacity(0.92))
                    }
                    .overlay { Circle().strokeBorder(Color.paper, lineWidth: max(size * 0.06, 2)) }
                    .rotationEffect(.degrees(index.isMultiple(of: 2) ? -4 : 4))
                    .zIndex(Double(index))
            }
        }
        .accessibilityHidden(true)
    }
}

/// A small fact with its icon, in place of text strung together with dots.
struct MetaTag: View {
    let symbol: String
    let text: String
    var fill: Color = .paper

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: symbol).font(.system(size: 12, weight: .semibold)).foregroundStyle(Color.ink3)
            Text(text).font(.system(size: 13.5, weight: .medium)).foregroundStyle(Color.ink2)
        }
        .padding(.horizontal, 10)
        .frame(height: 28)
        .background(fill, in: Capsule())
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Seal

/// A scalloped seal: the badge shape, twelve soft bumps around a circle.
nonisolated struct Seal: Shape {
    var bumps = 12
    var depth: CGFloat = 0.075

    nonisolated func path(in rect: CGRect) -> Path {
        let center = CGPoint(x: rect.midX, y: rect.midY)
        let radius = min(rect.width, rect.height) / 2
        var path = Path()
        let steps = 240
        for step in 0...steps {
            let angle = Double(step) / Double(steps) * 2 * .pi
            let r = radius * (1 - depth + depth * CGFloat(cos(Double(bumps) * angle)))
            let point = CGPoint(x: center.x + r * CGFloat(cos(angle)), y: center.y + r * CGFloat(sin(angle)))
            step == 0 ? path.move(to: point) : path.addLine(to: point)
        }
        path.closeSubpath()
        return path
    }
}

/// A badge as a seal: green with a white glyph once earned, a quiet grey seal with its progress
/// ring until then. Earned or not is said in words for VoiceOver, never by colour alone.
struct BadgeSeal: View {
    let badge: BadgeProgress
    var size: CGFloat = 64

    var body: some View {
        ZStack {
            Seal().fill(badge.earned ? Color.brand : Color.paper3)
            if !badge.earned {
                Circle()
                    .trim(from: 0, to: CGFloat(badge.fraction))
                    .stroke(Color.brand, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .padding(size * 0.1)
            }
            Image(systemName: badge.id.symbol)
                .font(.system(size: size * 0.32, weight: .semibold))
                .foregroundStyle(badge.earned ? Color.onInk : Color.ink3)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

// MARK: - Profile hero

/// Who you are here: a sage band, your face with your rank's emblem pinned to it, your name with
/// the resident seal you can ask about, and your town and time here as tags.
struct ProfileHero: View {
    let name: String?
    var image: String?
    let place: String?
    let residencyVerified: Bool
    let reputation: Reputation?
    var editProfile: (() -> Void)?
    var changePhoto: (() -> Void)?
    var savingPhoto = false
    let explainResident: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            ZStack(alignment: .bottom) {
                band.frame(height: 84)
                Group {
                    if let changePhoto {
                        Button(action: changePhoto) {
                            avatar.overlay(alignment: .bottomLeading) {
                                Image(systemName: "camera.fill")
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundStyle(Color.ink)
                                    .frame(width: 26, height: 26)
                                    .background(Color.paper, in: Circle())
                            }
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(L10n.Profile.changePhoto)
                        .disabled(savingPhoto)
                    } else {
                        avatar
                    }
                }
                .offset(y: 46)
            }
            .overlay(alignment: .topTrailing) {
                if let editProfile {
                    Button(action: editProfile) {
                        Image(systemName: "pencil")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Color.ink)
                            .frame(width: 36, height: 36)
                            .background(Color.paper, in: Circle())
                            .frame(width: 44, height: 44)
                            .contentShape(Circle())
                    }
                    .buttonStyle(Pressable())
                    .accessibilityLabel(L10n.Reputation.editProfile)
                    .padding(8)
                }
            }
            .zIndex(1)

            VStack(spacing: 10) {
                HStack(spacing: 6) {
                    Text(name ?? " ").type(.title).multilineTextAlignment(.center)
                    if residencyVerified {
                        Button(action: explainResident) {
                            Image(systemName: "checkmark.seal.fill").font(.system(size: 17)).foregroundStyle(Color.brand)
                                .frame(width: 30, height: 30)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(Pressable())
                        .accessibilityLabel(L10n.Account.residentVerified)
                    }
                }
                HStack(spacing: 6) {
                    if let place { MetaTag(symbol: "mappin.and.ellipse", text: place) }
                    if let reputation {
                        MetaTag(symbol: "calendar", text: L10n.Reputation.memberSince(date: reputation.joinedAt.date.formatted(.dateTime.month(.abbreviated).year())))
                    }
                }
            }
            .padding(.top, 56)
            .padding(.horizontal, 16)
            .padding(.bottom, 20)
        }
        .background(Color.paper2)
        .clipShape(RoundedRectangle(cornerRadius: Metrics.radiusPanel, style: .continuous))
    }

    /// A sage band with a few pine contour lines: a nod to the map, nothing to read.
    private var band: some View {
        Color.brandSoft
            .overlay {
                Canvas { context, size in
                    for index in 0..<6 {
                        let y = size.height * (0.15 + CGFloat(index) * 0.17)
                        var line = Path()
                        line.move(to: CGPoint(x: -20, y: y))
                        line.addCurve(
                            to: CGPoint(x: size.width + 20, y: y - 14),
                            control1: CGPoint(x: size.width * 0.3, y: y - 26),
                            control2: CGPoint(x: size.width * 0.65, y: y + 22)
                        )
                        context.stroke(line, with: .color(Color.brand.opacity(0.16)), lineWidth: 1.2)
                    }
                }
            }
            .accessibilityHidden(true)
    }

    private var avatar: some View {
        PersonAvatar(name: name, image: image, size: 92)
            .padding(2)
            .background(Color.paper, in: Circle())
            .overlay {
                if savingPhoto { ProgressView().padding(10).background(Color.paper, in: Circle()) }
            }
            .overlay(alignment: .bottomTrailing) {
                if let rank = reputation?.rank {
                    RankEmblem(rank: rank, size: 32, ring: true)
                        .offset(x: 2, y: 2)
                        .accessibilityElement()
                        .accessibilityLabel(rank.title)
                }
            }
    }
}

// MARK: - Rank card

/// Where you stand: your rank with its emblem and its line, your points as the one big number,
/// the way to the next rank, and the four ranks with where each starts.
struct RankCard: View {
    let reputation: Reputation
    let knowMore: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shown = false

    var body: some View {
        let rank = reputation.rank
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 12) {
                RankEmblem(rank: rank, size: 44)
                VStack(alignment: .leading, spacing: 1) {
                    Text(L10n.Reputation.youAre(rank: rank.title)).type(.title)
                    Text(rank.line).type(.callout, .ink2)
                }
            }

            HStack(alignment: .lastTextBaseline) {
                HStack(alignment: .lastTextBaseline, spacing: 6) {
                    Text("\(reputation.points)").font(.system(size: 40, weight: .bold, design: .rounded)).monospacedDigit().foregroundStyle(Color.ink)
                    Text(L10n.Reputation.pointsLabel).type(.body, .ink2)
                }
                Spacer(minLength: 8)
                if let next = reputation.next {
                    HStack(spacing: 6) {
                        RankEmblem(rank: next, size: 22)
                        Text(L10n.Reputation.toNext(points: "\(reputation.pointsToGo)", rank: next.title))
                            .font(.system(size: 14, weight: .semibold)).foregroundStyle(next.tint)
                    }
                }
            }
            .accessibilityElement(children: .combine)

            VStack(alignment: .leading, spacing: 6) {
                GeometryReader { box in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.paper3)
                        Capsule().fill(rank.tint).frame(width: box.size.width * CGFloat(shown ? reputation.rankProgress : 0))
                    }
                }
                .frame(height: 8)
                Text(progressLabel).font(.system(size: 13, weight: .medium).monospacedDigit()).foregroundStyle(Color.ink2)
            }
            .accessibilityElement(children: .combine)

            RankLadder(reputation: reputation).padding(.top, 2)

            Button(action: knowMore) {
                HStack(spacing: 4) {
                    Text(L10n.Reputation.knowMore)
                    Image(systemName: "chevron.right").font(.system(size: 11, weight: .bold))
                }
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.brandDeep)
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(Pressable())
        }
        .padding(18)
        .background(Color.paper2, in: RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
        .onAppear { withAnimation(reduceMotion ? nil : .spring(duration: 0.9, bounce: 0.15).delay(0.15)) { shown = true } }
    }

    private var progressLabel: String {
        guard let next = reputation.next, let step = reputation.ranks.first(where: { $0.id == reputation.rank }), let max = step.max else {
            return L10n.Reputation.progressTop
        }
        return L10n.Reputation.progressTo(current: "\(Int(reputation.points) - Int(step.min))", target: "\(max.intValue - Int(step.min))", rank: next.title)
    }
}

/// The four ranks as a ladder: each one's emblem in its own colour once reached, and the points
/// it starts at.
struct RankLadder: View {
    let reputation: Reputation

    var body: some View {
        let index = Int(reputation.rankIndex)
        let count = reputation.ranks.count
        ZStack(alignment: .top) {
            // The rail between stops, behind the emblems: walked in ink, still to walk in grey.
            GeometryReader { box in
                let column = box.size.width / CGFloat(max(count, 1))
                let start = column / 2
                let end = box.size.width - column / 2
                let reached = start + (end - start) * CGFloat(index) / CGFloat(max(count - 1, 1))
                Capsule().fill(Color.paper3).frame(width: end - start, height: 3).offset(x: start, y: 15.5)
                Capsule().fill(Color.ink4).frame(width: max(reached - start, 0), height: 3).offset(x: start, y: 15.5)
            }
            .frame(height: 34)

            HStack(alignment: .top, spacing: 0) {
                ForEach(Array(reputation.ranks.enumerated()), id: \.offset) { i, step in
                    VStack(spacing: 6) {
                        RankEmblem(rank: step.id, size: i == index ? 34 : 28, reached: i <= index, ring: true)
                            .frame(height: 34)
                        Text(step.id.title).font(.system(size: 13, weight: i == index ? .semibold : .medium)).foregroundStyle(i == index ? Color.ink : Color.ink2)
                        Text(L10n.Reputation.rangeFrom(min: "\(step.min)")).font(.system(size: 11.5).monospacedDigit()).foregroundStyle(Color.ink3)
                    }
                    .frame(maxWidth: .infinity)
                    .accessibilityElement(children: .combine)
                }
            }
        }
    }
}

// MARK: - Badges

struct BadgesCard: View {
    let reputation: Reputation
    let open: (BadgeProgress) -> Void

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 8, alignment: .top), count: 4)

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .center) {
                Text(L10n.Reputation.badgesTitle).type(.heading)
                Spacer()
                Label(L10n.Reputation.badgesCount(earned: "\(reputation.earnedBadges)", total: reputation.badges.count), systemImage: "seal.fill")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.brandDeep)
                    .padding(.horizontal, 10)
                    .frame(height: 28)
                    .background(Color.brandSoft, in: Capsule())
            }
            LazyVGrid(columns: columns, spacing: 16) {
                ForEach(reputation.badges, id: \.id) { badge in
                    Button { open(badge) } label: {
                        VStack(spacing: 6) {
                            BadgeSeal(badge: badge, size: 58)
                            Text(badge.id.title)
                                .font(.system(size: 12, weight: badge.earned ? .semibold : .medium))
                                .foregroundStyle(badge.earned ? Color.ink : Color.ink2)
                                .multilineTextAlignment(.center)
                                .lineLimit(2)
                                .fixedSize(horizontal: false, vertical: true)
                            if !badge.earned {
                                Text("\(badge.current)/\(badge.target)").font(.system(size: 11, weight: .medium).monospacedDigit()).foregroundStyle(Color.ink3)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(Pressable())
                    .accessibilityLabel(badge.id.title)
                    .accessibilityValue(badge.earned ? L10n.Reputation.badgeEarned : L10n.Reputation.badgeProgress(current: "\(badge.current)", target: "\(badge.target)"))
                }
            }
        }
        .padding(18)
        .background(Color.paper2, in: RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
    }
}

// MARK: - Rewards

/// The reward and its state together: what inviting earns, whether the badge is already yours,
/// who joined, the way to invite, and who invited you (or where to enter their code).
struct RewardsSection: View {
    let reputation: Reputation
    let invite: () -> Void
    let enterCode: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(L10n.Reputation.rewardsTitle).type(.heading)

            HStack(spacing: 14) {
                FaceRow(size: 34)
                VStack(alignment: .leading, spacing: 2) {
                    Text(L10n.Reputation.inviteCard).type(.heading)
                    Text(L10n.Reputation.invitePoints).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(Color.brandDeep)
                }
            }

            HStack(spacing: 8) {
                Image(systemName: reputation.hostEarned ? "checkmark.seal.fill" : "seal")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(reputation.hostEarned ? Color.brand : Color.ink3)
                Text(reputation.hostEarned ? L10n.Reputation.hostEarned : L10n.Reputation.hostPending)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(reputation.hostEarned ? Color.brandDeep : Color.ink2)
            }
            .padding(.horizontal, 12)
            .frame(height: 34)
            .background(reputation.hostEarned ? Color.brandSoft : Color.paper2, in: Capsule())

            if !reputation.joinedPeople.isEmpty {
                HStack(spacing: 10) {
                    FacePile(people: reputation.joinedPeople)
                    Text(L10n.Reputation.joined(count: Int(reputation.joined))).type(.callout, .ink2)
                }
                .accessibilityElement(children: .combine)
            }

            Button(action: invite) { Label(L10n.Reputation.inviteAction, systemImage: "person.badge.plus") }
                .buttonStyle(.ink)

            Hairline().padding(.top, 2)

            if let inviter = reputation.invitedBy {
                HStack(spacing: 12) {
                    PersonAvatar(name: inviter.name, image: inviter.image, size: 36)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(L10n.Reputation.invitedBy).type(.caption, .ink3)
                        Text(inviter.name).type(.bodyStrong)
                    }
                    Spacer()
                }
                .accessibilityElement(children: .combine)
            } else {
                Button(action: enterCode) {
                    HStack(spacing: 12) {
                        Image(systemName: "ticket").font(.system(size: 16, weight: .regular)).foregroundStyle(Color.ink).frame(width: 36, height: 36).background(Color.paper2, in: Circle())
                        Text(L10n.Reputation.haveCode).type(.bodyStrong)
                        Spacer()
                        Image(systemName: "chevron.right").font(.system(size: 12, weight: .medium)).foregroundStyle(Color.ink4)
                    }
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
                }
                .buttonStyle(RowPress())
            }
        }
    }
}

// MARK: - Sheets

/// How the ranks work: each one with its emblem and where it starts, and what earns points with
/// your own count beside it.
struct RankSheet: View {
    let reputation: Reputation
    let close: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(L10n.Reputation.rankSheetBody).type(.body, .ink2)

                RowGroup {
                    ForEach(Array(reputation.ranks.enumerated()), id: \.offset) { index, step in
                        HStack(spacing: 12) {
                            RankEmblem(rank: step.id, size: 34, reached: index <= Int(reputation.rankIndex))
                            VStack(alignment: .leading, spacing: 1) {
                                Text(step.id.title).type(step.id == reputation.rank ? .bodyStrong : .body)
                                Text(step.id.line).type(.caption, .ink3)
                            }
                            Spacer()
                            Text(L10n.Reputation.rangeFrom(min: "\(step.min)")).font(.system(size: 14, weight: .medium).monospacedDigit()).foregroundStyle(Color.ink3)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 11)
                        .accessibilityElement(children: .combine)
                        if index < reputation.ranks.count - 1 { Hairline(inset: 62) }
                    }
                }

                RowGroup {
                    ForEach(Array(reputation.breakdown.enumerated()), id: \.offset) { index, line in
                        HStack(spacing: 12) {
                            Image(systemName: line.kind.symbol).font(.system(size: 16, weight: .light)).foregroundStyle(Color.ink).frame(width: 24)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(line.kind.title).type(.body)
                                Text(L10n.Reputation.yours(count: "\(line.count)")).type(.caption, .ink3)
                            }
                            Spacer()
                            Text(L10n.Reputation.pointsEach(points: "\(line.each)"))
                                .font(.system(size: 14, weight: .bold).monospacedDigit())
                                .foregroundStyle(Color.brandDeep)
                                .padding(.horizontal, 9)
                                .frame(height: 26)
                                .background(Color.brandSoft, in: Capsule())
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 11)
                        .accessibilityElement(children: .combine)
                        if index < reputation.breakdown.count - 1 { Hairline(inset: 52) }
                    }
                }
            }
            .padding(.horizontal, Metrics.gutter)
            .padding(.bottom, 24)
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            SheetBar(title: L10n.Reputation.rankSheetTitle, close: close).background(Color.paper)
        }
        .paperBackground()
        .presentationDetents([.medium, .large])
        .presentationCornerRadius(Metrics.radiusPanel)
    }
}

struct BadgeSheet: View {
    let badge: BadgeProgress
    let close: () -> Void
    @State private var settled = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(spacing: 14) {
            SheetBar(title: L10n.Reputation.badgesTitle, close: close)
            BadgeSeal(badge: badge, size: 108)
                .scaleEffect(settled || reduceMotion ? 1 : 0.8)
                .rotationEffect(.degrees(settled || reduceMotion || !badge.earned ? 0 : -12))
                .padding(.top, 6)
            Text(badge.id.title).type(.title)
            Text(badge.id.how).type(.body, .ink2).multilineTextAlignment(.center).padding(.horizontal, 24)
            if badge.earned {
                Label(L10n.Reputation.badgeEarned, systemImage: "checkmark.seal.fill")
                    .type(.label, .brandDeep)
                    .padding(.horizontal, 14).frame(height: 32)
                    .background(Color.brandSoft, in: Capsule())
            } else {
                VStack(spacing: 6) {
                    ProgressView(value: Double(badge.fraction)).tint(.brand).frame(width: 180)
                    Text(L10n.Reputation.badgeProgress(current: "\(badge.current)", target: "\(badge.target)")).font(.system(size: 14, weight: .medium).monospacedDigit()).foregroundStyle(Color.ink2)
                }
            }
            Spacer(minLength: 0)
        }
        .paperBackground()
        .presentationDetents([.height(400)])
        .presentationCornerRadius(Metrics.radiusPanel)
        .sensoryFeedback(.success, trigger: settled && badge.earned)
        .onAppear { withAnimation(.spring(duration: 0.55, bounce: 0.4)) { settled = true } }
    }
}

/// What the resident seal beside a name means, asked by tapping it.
struct ResidentSheet: View {
    let place: String?
    let close: () -> Void

    var body: some View {
        VStack(spacing: 14) {
            SheetBar(title: L10n.Account.residentVerified, close: close)
            Image(systemName: "checkmark.seal.fill").font(.system(size: 54)).foregroundStyle(Color.brand).padding(.top, 4)
            Text(place.map { L10n.Reputation.residentBody(place: $0) } ?? L10n.Reputation.residentBodyNoPlace)
                .type(.body, .ink2).multilineTextAlignment(.center).padding(.horizontal, 28)
            Spacer(minLength: 0)
        }
        .paperBackground()
        .presentationDetents([.height(300)])
        .presentationCornerRadius(Metrics.radiusPanel)
    }
}

/// Inviting: one flow in one sheet. The faces and the ask on top, sharing the link first (it
/// opens WhatsApp or whatever the person already uses), contacts as the second way, and the code
/// in one quiet row. Contacts is a step inside: Atrás comes back here, the X leaves.
struct InviteFlow: View {
    let reputation: Reputation
    let close: () -> Void
    @State private var path: [InviteStep] = []
    /// The invite sits at its own height; the contacts step takes the whole screen.
    @State private var homeHeight: CGFloat = 620
    @State private var detent: PresentationDetent = .height(620)

    enum InviteStep: Hashable { case contacts }

    var body: some View {
        NavigationStack(path: $path) {
            InviteHome(reputation: reputation, chooseContacts: { path.append(.contacts) }, close: close) { height in
                homeHeight = height
                if path.isEmpty { detent = .height(height) }
            }
                .toolbarVisibility(.hidden, for: .navigationBar)
                .navigationDestination(for: InviteStep.self) { _ in
                    ContactsInviteView(
                        message: L10n.Reputation.message(code: reputation.inviteCode, url: reputation.inviteUrl),
                        shareURL: URL(string: reputation.inviteUrl) ?? URL(string: "https://rutacibao.app")!,
                        back: { path.removeLast() },
                        close: close
                    )
                }
        }
        .onChange(of: path.isEmpty) { _, home in detent = home ? .height(homeHeight) : .large }
        .presentationDetents([.height(homeHeight), .large], selection: $detent)
        .presentationCornerRadius(Metrics.radiusPanel)
    }
}

private struct InviteHome: View {
    let reputation: Reputation
    let chooseContacts: () -> Void
    let close: () -> Void
    /// Reports the content's height, so the sheet can stop where the invite ends.
    let measured: (CGFloat) -> Void
    @State private var copied = false

    private var message: String { L10n.Reputation.message(code: reputation.inviteCode, url: reputation.inviteUrl) }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                FaceRow(size: 64)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 34)
                    .padding(.bottom, 26)
                    .background(Color.brandSoft)
                    .overlay(alignment: .topTrailing) {
                        IconButton(symbol: "xmark", label: L10n.Common.close, glass: true, action: close).padding(12)
                    }

                VStack(spacing: 10) {
                    Text(L10n.Reputation.inviteTitle)
                        .font(.system(size: 32, weight: .heavy))
                        .tracking(-0.8)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(reputation.hostEarned ? L10n.Reputation.invitePoints : L10n.Reputation.inviteBody)
                        .type(.body, .ink2).multilineTextAlignment(.center)
                }
                .padding(.horizontal, Metrics.gutter)
                .padding(.top, 20)

                VStack(spacing: 10) {
                    ShareLink(item: URL(string: reputation.inviteUrl) ?? URL(string: "https://rutacibao.app")!, message: Text(message)) {
                        Label(L10n.Reputation.shareLink, systemImage: "square.and.arrow.up")
                    }
                    .buttonStyle(.ink)
                    Button(action: chooseContacts) { Label(L10n.Reputation.chooseContacts, systemImage: "person.crop.circle.badge.plus") }
                        .buttonStyle(.pill(.outline))
                }
                .padding(.horizontal, Metrics.gutter)
                .padding(.top, 22)

                codeRow.padding(.horizontal, Metrics.gutter).padding(.top, 18)

                HStack(spacing: 10) {
                    if !reputation.joinedPeople.isEmpty { FacePile(people: reputation.joinedPeople, size: 24) }
                    Text(L10n.Reputation.joined(count: Int(reputation.joined))).type(.callout, .ink3)
                }
                .padding(.top, 12)
                .padding(.bottom, 24)
            }
            .onGeometryChange(for: CGFloat.self, of: { $0.size.height }) { measured($0) }
        }
        .scrollBounceBehavior(.basedOnSize)
        .paperBackground()
    }

    /// The code in one row: its label and value, a soft divider, and copying that confirms in place.
    private var codeRow: some View {
        HStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 2) {
                Text(L10n.Reputation.codeLabel).type(.caption, .ink3)
                Text(reputation.inviteCode).font(.system(size: 20, weight: .semibold, design: .monospaced)).tracking(2).foregroundStyle(Color.brandDeep)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Rectangle().fill(Color.line).frame(width: 1, height: 34)
            Button {
                UIPasteboard.general.string = reputation.inviteCode
                copied = true
                Task { try? await Task.sleep(for: .seconds(2)); copied = false }
            } label: {
                Label(copied ? L10n.Reputation.codeCopied : L10n.Reputation.copy, systemImage: copied ? "checkmark" : "doc.on.doc")
                    .contentTransition(.symbolEffect(.replace))
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.brandDeep)
                    .frame(minWidth: 120, minHeight: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(Pressable())
            .sensoryFeedback(.success, trigger: copied) { _, now in now }
        }
        .padding(.leading, 16)
        .padding(.vertical, 8)
        .background(Color.paper2, in: RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
    }
}

/// Entering who invited you: one field, checked on the phone first, answered in place, and the
/// inviter thanked by face and name.
struct RedeemSheet: View {
    let state: Redeem
    let submit: (String) -> Void
    let reset: () -> Void
    let close: () -> Void
    @State private var code = ""
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            SheetBar(title: L10n.Reputation.haveCode, close: close).padding(.horizontal, -16)
            switch onEnum(of: state) {
            case .done(let done):
                VStack(spacing: 14) {
                    PersonAvatar(name: done.inviterName, size: 76)
                        .overlay(alignment: .bottomTrailing) {
                            Seal().fill(Color.brand).frame(width: 30, height: 30)
                                .overlay { Image(systemName: "checkmark").font(.system(size: 13, weight: .bold)).foregroundStyle(Color.onInk) }
                                .offset(x: 4, y: 4)
                        }
                    VStack(spacing: 2) {
                        Text(L10n.Reputation.invitedBy).type(.caption, .ink3)
                        Text(done.inviterName).type(.title)
                    }
                    Text(L10n.Reputation.redeemedThanks(name: done.inviterName)).type(.body, .ink2).multilineTextAlignment(.center)
                    Button(L10n.Common.close, action: close).buttonStyle(.ink).padding(.top, 6)
                }
                .frame(maxWidth: .infinity)
                .padding(.top, 10)
                .sensoryFeedback(.success, trigger: true)
            default:
                Text(L10n.Reputation.redeemTitle).type(.title)
                Text(L10n.Reputation.redeemBody).type(.body, .ink2)
                TextField("", text: $code, prompt: Text(L10n.Reputation.redeemPlaceholder).foregroundStyle(Color.ink3))
                    .font(.system(size: 22, weight: .semibold, design: .monospaced))
                    .tracking(3)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .focused($focused)
                    .padding(.horizontal, 16)
                    .frame(height: 56)
                    .background(Color.paper2, in: RoundedRectangle(cornerRadius: Metrics.radiusField, style: .continuous))
                    .overlay { RoundedRectangle(cornerRadius: Metrics.radiusField, style: .continuous).strokeBorder(failure != nil ? Color.danger : (focused ? Color.action : .clear), lineWidth: 1.5) }
                    .onChange(of: code) { _, value in
                        let cleaned = String(value.uppercased().filter { $0.isLetter || $0.isNumber }.prefix(8))
                        if cleaned != value { code = cleaned }
                        if failure != nil { reset() }
                    }
                    .onSubmit { submit(code) }
                    .accessibilityLabel(L10n.Reputation.redeemPlaceholder)
                if let failure {
                    Label(failure, systemImage: "exclamationmark.circle").type(.callout, .danger)
                }
                Button { submit(code) } label: {
                    HStack(spacing: 10) {
                        if isWorking { ProgressView().tint(.onInk) }
                        Text(L10n.Reputation.redeemAction)
                    }
                }
                .buttonStyle(.ink)
                .disabled(code.count < 8 || isWorking)
                .padding(.top, 4)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Metrics.gutter)
        .paperBackground()
        .presentationDetents([.medium])
        .presentationCornerRadius(Metrics.radiusPanel)
        .onAppear { focused = true }
    }

    private var isWorking: Bool { if case .working = onEnum(of: state) { true } else { false } }

    private var failure: String? {
        guard case .failed(let failed) = onEnum(of: state) else { return nil }
        switch failed.error {
        case .invalidCode: return L10n.Reputation.errorInvalidCode
        case .unknownCode: return L10n.Reputation.errorUnknownCode
        case .ownCode: return L10n.Reputation.errorOwnCode
        case .alreadyRedeemed: return L10n.Reputation.errorAlreadyRedeemed
        case .rateLimited: return L10n.SignIn.rateLimited
        case .failed: return L10n.Common.errorTitle
        }
    }
}
