import RutaKit
import SwiftUI

struct OfflineScreen: View {
    @Environment(\.graph) private var graph
    @State private var justUpdated = false
    @State private var state: OfflineUiState?
    @State private var query = ""

    var body: some View {
        List {
            Section {
                // The state first, as one glance: an icon, a word, when it was saved.
                let ready = state?.version != nil
                VStack(spacing: 10) {
                    Image(systemName: ready ? "checkmark.circle.fill" : "arrow.down.circle.fill")
                        .font(.system(size: 52))
                        .foregroundStyle(ready ? Color(.systemGreen) : Color(.tertiaryLabel))
                        .contentTransition(.symbolEffect(.replace))
                        .accessibilityHidden(true)
                    Text(ready ? L10n.Offline.readyBadge : L10n.Offline.notDownloadedBadge)
                        .font(.title3.weight(.semibold))
                    if let saved = savedDate {
                        Text("\(L10n.Offline.versionDate) \(saved.formatted(.relative(presentation: .named)))")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .accessibilityElement(children: .combine)
            } footer: {
                Text(L10n.Offline.lede)
            }
            Section {
                Button { graph?.offline.download() } label: {
                    HStack {
                        Text(state?.downloading == true ? L10n.Offline.downloadingAction : (state?.version == nil ? L10n.Offline.downloadAction : L10n.Offline.updateAction))
                        Spacer()
                        if state?.downloading == true {
                            ProgressView()
                        } else if justUpdated {
                            Image(systemName: "checkmark").fontWeight(.semibold).foregroundStyle(.green).transition(.scale.combined(with: .opacity))
                        }
                    }
                }
                .disabled(state?.downloading == true)
                // The snapshot's date can stay the same after an update, so the row itself confirms it ran.
                .onChange(of: state?.downloading == true) { was, now in
                    guard was, !now, state?.error == nil else { return }
                    withAnimation(.snappy) { justUpdated = true }
                    Task { try? await Task.sleep(for: .seconds(2.5)); withAnimation(.snappy) { justUpdated = false } }
                }
                .sensoryFeedback(.success, trigger: justUpdated) { _, now in now }
                if state?.version != nil {
                    Button(L10n.Offline.removeAction, role: .destructive) { graph?.offline.removeSnapshot() }
                }
            } footer: {
                if let error = state?.error {
                    Text(offlineMessage(error)).foregroundStyle(.red)
                }
            }
            if state?.pending.isEmpty == false {
                Section { PendingOutboxView() }
            }
            if state?.version != nil, let offline = graph?.offline {
                Section(L10n.Offline.placesRowTitle) {
                    ForEach(offline.cachedPlaces().filter { matches("\($0.name) \($0.category) \($0.municipality) \($0.description)") }, id: \.id) { place in
                        DisclosureGroup {
                            if !place.description.isEmpty { Text(place.description) }
                            if let address = place.address { Text(address) }
                            Text(verbatim: "\(place.latitude), \(place.longitude)").font(.caption)
                        } label: {
                            VStack(alignment: .leading) {
                                Text(place.name).font(.headline)
                                Text("\(place.category) · \(place.municipality)").font(.footnote).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                Section(L10n.Offline.routesRowTitle) {
                    ForEach(offline.cachedRoutes().filter { matches("\($0.name) \($0.description) \($0.municipalityName)") }, id: \.id) { route in
                        DisclosureGroup(route.name) {
                            Text(route.description)
                            Text(route.municipalityName)
                        }
                    }
                }
                Section(L10n.Offline.roadsRowTitle) {
                    ForEach(offline.cachedRoads().filter { matches($0.name ?? $0.kind) }, id: \.id) { road in Text(road.name ?? road.kind) }
                }
            }
        }
        .readableWidth()
        .searchable(text: $query, prompt: L10n.Search.placeholder)
        .navigationTitle(L10n.Offline.title)
        .task {
            guard let graph else { return }
            state = graph.offline.state.value
            for await next in graph.offline.state { state = next }
        }
    }

    /// The snapshot's ISO timestamp as a date, so it reads "ayer" or "hace 3 días".
    private var savedDate: Date? {
        guard let raw = state?.generatedAt else { return nil }
        let precise = ISO8601DateFormatter()
        precise.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return precise.date(from: raw) ?? ISO8601DateFormatter().date(from: raw)
    }

    private func matches(_ text: String) -> Bool { query.isEmpty || text.localizedStandardContains(query) }
    private func offlineMessage(_ error: String) -> String {
        switch error {
        case "checksum_mismatch": L10n.Offline.Errors.checksum_mismatch
        case "size_mismatch": L10n.Offline.Errors.size_mismatch
        case "schema_invalid": L10n.Offline.Errors.schema_invalid
        case "version_mismatch": L10n.Offline.Errors.version_mismatch
        case "origin_mismatch": L10n.Offline.Errors.origin_mismatch
        case "invalid_manifest": L10n.Offline.Errors.invalid_manifest
        default: L10n.Offline.Errors.network
        }
    }
}

struct PendingOutboxView: View {
    var hidesWhenEmpty = false
    @Environment(\.graph) private var graph
    @State private var state: OfflineUiState?

    var body: some View {
        Group {
            if hidesWhenEmpty && state?.pending.isEmpty != false { Color.clear.frame(height: 0) } else { content.padding(hidesWhenEmpty ? 16 : 0) }
        }
        .task {
            guard let graph else { return }
            state = graph.offline.state.value
            for await next in graph.offline.state { state = next }
        }
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(L10n.Offline.outboxSection).font(.headline)
            if state?.pending.isEmpty != false { Text(L10n.Offline.outboxEmpty).foregroundStyle(.secondary) }
            else {
                Button(state?.syncing == true ? L10n.Offline.outboxFlushing : L10n.Offline.outboxFlushAction) { graph?.offline.flush() }
                    .disabled(state?.syncing == true)
                ForEach(state?.pending ?? [], id: \.id) { entry in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(procedure(entry.procedure)).font(.subheadline.bold())
                        Text(entry.blocked ? L10n.Offline.outboxStatusBlocked : L10n.Offline.outboxStatusWaiting).font(.footnote)
                        if entry.blocked { Text(reason(entry.error)).font(.footnote).foregroundStyle(.red) }
                        HStack {
                            Button(L10n.Offline.outboxRetryAction) { graph?.offline.retry(id: entry.id) }
                            Button(L10n.Offline.outboxRemoveAction, role: .destructive) { graph?.offline.discard(id: entry.id) }
                        }
                        .disabled(state?.syncing == true)
                    }
                }
            }
        }
    }

    private func procedure(_ value: String) -> String {
        switch value {
        case "traffic_report": L10n.Offline.OutboxProcedure.traffic_report
        case "consultations_open": L10n.Offline.OutboxProcedure.consultations_open
        case "places_report": L10n.Offline.OutboxProcedure.places_report
        default: L10n.Offline.OutboxProcedure.places_submit
        }
    }
    private func reason(_ value: String?) -> String {
        switch value {
        case "stale_report": L10n.Offline.OutboxErrors.stale_report
        case "duplicate": L10n.Offline.OutboxErrors.duplicate
        case "municipality_mismatch": L10n.Offline.OutboxErrors.municipality_mismatch
        case "outside_province": L10n.Offline.OutboxErrors.outside_province
        case "invalid_street": L10n.Offline.OutboxErrors.invalid_street
        case "unauthorized", "unauthenticated": L10n.Offline.OutboxErrors.unauthenticated
        default: L10n.Offline.OutboxErrors.generic
        }
    }
}
