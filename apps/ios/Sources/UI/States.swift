import RutaKit
import SwiftUI

/// Loading, empty and error states, shared by every screen.
struct ErrorStateView: View {
    let error: UiError
    let retry: () -> Void

    var body: some View {
        let offline = error == .offline
        ContentUnavailableView {
            Label(
                offline ? L10n.Common.offline : L10n.Common.errorTitle,
                systemImage: offline ? "wifi.slash" : "exclamationmark.triangle"
            )
        } description: {
            Text(offline ? L10n.Common.offlineBody : L10n.Common.errorBody)
        } actions: {
            Button(L10n.Common.retry, action: retry)
                .buttonStyle(.glass)
        }
    }
}

struct LoadingStateView: View {
    var body: some View {
        ProgressView()
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .accessibilityLabel(L10n.Common.loading)
    }
}
