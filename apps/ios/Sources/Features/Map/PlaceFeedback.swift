import RutaKit
import SwiftUI

struct PlaceFeedbackView: View {
    let sheet: PlaceSheet
    let confirm: (PlacesConfirmInput.Verdict) -> Void
    let requestReport: () -> Void
    @Environment(\.palette) private var palette
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if sheet.cached {
                Label(L10n.Offline.mapNote, systemImage: "wifi.slash")
                    .font(.footnote).foregroundStyle(.secondary)
            } else if let detail = sheet.detail, !detail.isMine {
                Text(L10n.Place.stillThere).font(.headline)
                HStack(spacing: 10) {
                    verdictButton(chosen: detail.myVerdict == .exists, .exists, title: L10n.Place.exists, symbol: "checkmark.circle")
                    verdictButton(chosen: detail.myVerdict == .gone, .gone, title: L10n.Place.gone, symbol: "xmark.circle")
                }
                .disabled(sheet.confirming)
            }
            if let error = sheet.feedbackError {
                Label(error == .offline ? L10n.Common.offlineBody : L10n.Common.errorBody, systemImage: "exclamationmark.circle")
                    .font(.footnote).foregroundStyle(.secondary)
            }
        }
        #if DEBUG
        // `SIMCTL_CHILD_RUTA_DEBUG_PLACE=exists|gone|report` answers "¿Sigue aquí?" or opens the report form once the sheet is loaded.
        .task(id: sheet.detail?.id) {
            guard sheet.detail != nil, !sheet.cached else { return }
            switch ProcessInfo.processInfo.environment["RUTA_DEBUG_PLACE"] {
            case "exists": if sheet.detail?.isMine == false { confirm(.exists) }
            case "gone": if sheet.detail?.isMine == false { confirm(.gone) }
            case "report": requestReport()
            default: break
            }
        }
        #endif
    }

    /// The same tonal pair as the traffic sheet: the chosen one is filled with ink and an
    /// inverted label, and shows the filled icon, so state never rests on colour alone.
    private func verdictButton(chosen: Bool, _ verdict: PlacesConfirmInput.Verdict, title: String, symbol: String) -> some View {
        let shape = RoundedRectangle(cornerRadius: 14, style: .continuous)
        return Button { confirm(verdict) } label: {
            Label(title, systemImage: chosen ? "\(symbol).fill" : symbol)
                .font(.headline)
                .foregroundStyle(chosen ? palette.onAccent : Color.primary)
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(chosen ? palette.accent : (scheme == .dark ? palette.fillPressed : Color.primary.opacity(0.1)), in: shape)
                .contentShape(shape)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(chosen ? .isSelected : [])
    }
}

struct PlaceReportView: View {
    let report: PlaceReportState
    let updateReason: (PlacesReportInput.Reason) -> Void
    let updateDetails: (String) -> Void
    let submit: () -> Void
    let close: () -> Void

    var body: some View {
        NavigationStack {
            Group {
                if report.sent {
                    VStack(spacing: 16) {
                        Image(systemName: report.queued ? "clock.arrow.circlepath" : "checkmark.circle")
                            .font(.largeTitle)
                        Text(report.queued ? L10n.Offline.queuedToast : L10n.Place.reportSent).font(.title2.bold())
                        Text(report.queued ? L10n.Offline.queuedToastBody : L10n.Place.reportSentBody)
                            .foregroundStyle(.secondary).multilineTextAlignment(.center)
                        Button(L10n.Common.close, action: close).frame(minHeight: 44)
                    }.padding(24).frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    Form {
                        Picker(L10n.Place.reportTitle, selection: Binding(get: { report.reason }, set: updateReason)) {
                            ForEach(PlacesReportInput.Reason.allCases, id: \.self) { reason in
                                Text(Self.reasonText(reason)).tag(reason)
                            }
                        }
                        .pickerStyle(.inline)
                        Section(L10n.Place.reportDetails) {
                            TextField(L10n.Place.reportDetails, text: Binding(get: { report.details }, set: updateDetails), axis: .vertical)
                                .lineLimit(4...8)
                            if report.invalidDetails {
                                Label(L10n.Place.reportDetailsRequired, systemImage: "exclamationmark.circle")
                                    .font(.footnote)
                            }
                        }
                        if let error = report.error {
                            Label(error == .offline ? L10n.Common.offlineBody : L10n.Common.errorBody, systemImage: "exclamationmark.circle")
                        }
                    }
                    .disabled(report.submitting)
                    .scrollDismissesKeyboard(.interactively)
                    .safeAreaInset(edge: .bottom) {
                        SubmitBar(title: L10n.Safety.Report.submit, busy: report.submitting, enabled: !report.submitting, action: submit)
                    }
                }
            }
            #if DEBUG
            // `SIMCTL_CHILD_RUTA_DEBUG_PLACE_SEND=1`: pick "closed", add details and send.
            .task {
                guard ProcessInfo.processInfo.environment["RUTA_DEBUG_PLACE_SEND"] == "1" else { return }
                try? await Task.sleep(for: .seconds(1))
                updateReason(.closed)
                updateDetails("Ya no abre desde hace semanas, el local está vacío.")
                try? await Task.sleep(for: .milliseconds(500))
                submit()
            }
            #endif
            .navigationTitle(L10n.Place.reportTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L10n.Common.cancel, action: close).disabled(report.submitting)
                }
            }
        }
    }

    static func reasonText(_ reason: PlacesReportInput.Reason) -> String {
        switch reason {
        case .incorrectInformation: L10n.Place.Reasons.incorrect_information
        case .closed: L10n.Place.Reasons.closed
        case .duplicate: L10n.Place.Reasons.duplicate
        case .wrongLocation: L10n.Place.Reasons.wrong_location
        case .other: L10n.Place.Reasons.other
        }
    }
}
