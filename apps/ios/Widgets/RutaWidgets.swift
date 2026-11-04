import ActivityKit
import SwiftUI
import WidgetKit

@main
struct RutaWidgets: WidgetBundle {
    var body: some Widget {
        NavigationLiveActivity()
    }
}

/// Navigation in the Lock Screen and Dynamic Island: the next maneuver is the
/// headline (glyph + distance + instruction), time and arrival below.
struct NavigationLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: NavigationAttributes.self) { context in
            LockScreenNavigation(state: context.state, destination: context.attributes.destination)
                .activityBackgroundTint(Color.black.opacity(0.82))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: context.state.symbol)
                        .font(.system(size: 30, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.stepDistance)
                        .font(.system(size: 26, weight: .bold))
                        .foregroundStyle(.white)
                        .contentTransition(.numericText())
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(context.state.instruction)
                            .font(.headline)
                            .lineLimit(2)
                        Text("\(context.state.remaining) · \(context.state.arrival)")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } compactLeading: {
                Image(systemName: context.state.symbol)
                    .font(.system(size: 15, weight: .bold))
            } compactTrailing: {
                Text(context.state.stepDistance)
                    .font(.system(size: 14, weight: .semibold))
                    .contentTransition(.numericText())
            } minimal: {
                Image(systemName: context.state.symbol)
                    .font(.system(size: 14, weight: .bold))
            }
            .keylineTint(.white)
        }
    }
}

private struct LockScreenNavigation: View {
    let state: NavigationAttributes.ContentState
    let destination: String

    var body: some View {
        HStack(alignment: .center, spacing: 14) {
            Image(systemName: state.arrived ? "mappin.and.ellipse" : state.symbol)
                .font(.system(size: 34, weight: .bold))
                .frame(width: 48)
            VStack(alignment: .leading, spacing: 2) {
                if !state.arrived {
                    Text(state.stepDistance)
                        .font(.system(size: 26, weight: .bold))
                        .contentTransition(.numericText())
                }
                Text(state.arrived ? destination : state.instruction)
                    .font(.headline)
                    .lineLimit(2)
                Text(state.arrived ? state.arrival : "\(state.remaining) · \(state.arrival)")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.7))
            }
            Spacer(minLength: 0)
        }
        .foregroundStyle(.white)
        .padding(16)
        .accessibilityElement(children: .combine)
    }
}
