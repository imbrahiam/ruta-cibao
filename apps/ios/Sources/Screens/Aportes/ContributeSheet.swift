import SwiftUI

/// The three ways to add to the map, offered from the add button in every header.
struct ContributeSheet: View {
    let choose: (ContributeAction) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            SheetBar(title: L10n.Contributions.contribute) { dismiss() }
            VStack(spacing: 10) {
                ForEach(Array(ContributeAction.allCases.enumerated()), id: \.element) { index, item in
                    Button { choose(item) } label: {
                        HStack(spacing: 14) {
                            GlyphDisc(symbol: item.symbol, size: 48)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.title).type(.bodyStrong)
                                Text(item.detail).type(.callout, .ink3).lineLimit(2).multilineTextAlignment(.leading)
                            }
                            Spacer(minLength: 8)
                            Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Color.ink4)
                        }
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.paper2, in: RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
                        .contentShape(RoundedRectangle(cornerRadius: Metrics.radiusCard, style: .continuous))
                    }
                    .buttonStyle(Pressable(scale: 0.98))
                    .rise(index)
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 6)
            Spacer(minLength: 0)
        }
        .paperBackground()
        .presentationDetents([.height(380), .large])
        .presentationCornerRadius(Metrics.radiusPanel)
    }
}
