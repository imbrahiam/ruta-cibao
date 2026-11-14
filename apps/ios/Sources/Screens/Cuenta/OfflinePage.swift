import RutaKit
import SwiftUI

/// The province in your pocket: whether a copy is saved, how fresh it is, and what waits to be sent.
struct OfflinePage: View {
    @Environment(\.graph) private var graph
    @State private var state: OfflineUiState?
    @State private var justUpdated = false

    private var ready: Bool { state?.version != nil }
    private var downloading: Bool { state?.downloading == true }

    var body: some View {
        Page(title: L10n.Offline.title) {
            VStack(spacing: 10) {
                Image(systemName: ready ? "checkmark" : "arrow.down")
                    .font(.system(size: 24, weight: .medium))
                    .foregroundStyle(ready ? Color.onInk : Color.ink)
                    .frame(width: 64, height: 64)
                    .background(ready ? Color.action : Color.paper3, in: Circle())
                    .contentTransition(.symbolEffect(.replace))
                Text(ready ? L10n.Offline.readyBadge : L10n.Offline.notDownloadedBadge).type(.title)
                if let saved = savedDate {
                    Text("\(L10n.Offline.versionDate) \(saved.formatted(.relative(presentation: .named)))").type(.callout, .ink3)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 26)
            .background(Color.paper2, in: RoundedRectangle(cornerRadius: Metrics.radiusPanel, style: .continuous))
            .accessibilityElement(children: .combine)

            Text(L10n.Offline.lede).type(.callout, .ink3)

            Button { graph?.offline.download() } label: {
                HStack(spacing: 10) {
                    if downloading { ProgressView().tint(.onInk) } else if justUpdated { Image(systemName: "checkmark") }
                    Text(downloading ? L10n.Offline.downloadingAction : (ready ? L10n.Offline.updateAction : L10n.Offline.downloadAction))
                }
            }
            .buttonStyle(.ink)
            .disabled(downloading)
            // The snapshot's date can stay the same after an update, so the button itself confirms it ran.
            .onChange(of: downloading) { was, now in
                guard was, !now, state?.error == nil else { return }
                withAnimation(Motion.quick) { justUpdated = true }
                Task { try? await Task.sleep(for: .seconds(2.5)); withAnimation(Motion.quick) { justUpdated = false } }
            }
            .sensoryFeedback(.success, trigger: justUpdated) { _, now in now }

            if let error = state?.error {
                Label(message(error), systemImage: "exclamationmark.circle").type(.callout, .danger)
            }
            if ready {
                Button(L10n.Offline.removeAction) { graph?.offline.removeSnapshot() }.buttonStyle(.pill(.danger))
                RowGroup {
                    RowLabel(symbol: "mappin", title: L10n.Offline.placesRowTitle, value: "\(state?.places ?? 0)", chevron: false)
                    RowLabel(symbol: "figure.hiking", title: L10n.Offline.routesRowTitle, value: "\(state?.routes ?? 0)", chevron: false)
                    RowLabel(symbol: "road.lanes", title: L10n.Offline.roadsRowTitle, value: "\(state?.roads ?? 0)", chevron: false, divider: false)
                }
                .padding(.top, 6)
            }

            if let pending = state?.pending, !pending.isEmpty {
                FormLabel(text: L10n.Offline.outboxSection)
                RowGroup {
                    ForEach(Array(pending.enumerated()), id: \.element.id) { index, entry in
                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(procedure(entry.procedure)).type(.bodyStrong)
                                Text(entry.blocked ? L10n.Offline.outboxStatusBlocked : L10n.Offline.outboxStatusWaiting).type(.callout, entry.blocked ? .danger : .ink3)
                            }
                            Spacer()
                            IconButton(symbol: "arrow.clockwise", label: L10n.Offline.outboxRetryAction) { graph?.offline.retry(id: entry.id) }
                            IconButton(symbol: "trash", label: L10n.Offline.outboxRemoveAction) { graph?.offline.discard(id: entry.id) }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        if index < pending.count - 1 { Hairline(inset: 16) }
                    }
                }
                Button(state?.syncing == true ? L10n.Offline.outboxFlushing : L10n.Offline.outboxFlushAction) { graph?.offline.flush() }
                    .buttonStyle(.quiet)
                    .disabled(state?.syncing == true)
            }
        }
        .animation(Motion.settle, value: ready)
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

    private func procedure(_ key: String) -> String {
        switch key {
        case "traffic_report": L10n.Offline.OutboxProcedure.traffic_report
        case "consultations_open": L10n.Offline.OutboxProcedure.consultations_open
        case "places_report": L10n.Offline.OutboxProcedure.places_report
        default: L10n.Offline.OutboxProcedure.places_submit
        }
    }

    private func message(_ error: String) -> String {
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
