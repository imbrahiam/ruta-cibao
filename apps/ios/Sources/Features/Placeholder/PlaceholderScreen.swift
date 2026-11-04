import SwiftUI

/// Stand-in for a tab not migrated yet (see docs/NATIVE.md parity checklist).
struct PlaceholderScreen: View {
    let title: String

    var body: some View {
        NavigationStack {
            Color.clear.navigationTitle(title)
        }
    }
}
