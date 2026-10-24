import { StyleSheet, Text, View } from "react-native";
import { categoryIcon, Icon } from "@/ui/icon";
import { palettes, type Scheme } from "@/ui/theme";

/**
 * Marker bodies for the map. A place disc wears its category colour (data
 * from the taxonomy, editable by admins) with a white glyph, so a category
 * reads by colour, shape and the name beside it. They are plain views,
 * snapshotted by the native map once (`tracksViewChanges={false}` at the call
 * site), so keep them static.
 */

/** A single place: a small category-coloured disc with its glyph. */
export function PlaceDot({
  icon,
  color,
  name,
  scheme,
}: {
  icon: string;
  color: string;
  name?: string;
  scheme: Scheme;
}) {
  const colors = palettes[scheme];
  return (
    // A fixed width with the disc at the left edge, so the map can anchor the
    // disc's centre (13 / 180) on the spot whatever the name's length.
    <View
      style={[styles.dotRow, name ? styles.dotRowNamed : null]}
      pointerEvents="none"
    >
      <View
        style={[
          styles.dot,
          // White in both schemes: on a dark map a dark rim loses the pin.
          { backgroundColor: color, borderColor: colors.onStatus },
        ]}
      >
        <Icon
          as={categoryIcon(icon)}
          size={13}
          color={colors.onStatus}
          strokeWidth={2.4}
        />
      </View>
      {name ? (
        <Text
          numberOfLines={2}
          style={[
            styles.label,
            { color: colors.text, textShadowColor: colors.background },
          ]}
        >
          {name}
        </Text>
      ) : null}
    </View>
  );
}

/** A group of places at province scale; its size grows with the count. */
export function ClusterBubble({
  count,
  scheme,
}: {
  count: number;
  scheme: Scheme;
}) {
  const colors = palettes[scheme];
  const size = count >= 50 ? 44 : count >= 10 ? 38 : 32;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.cluster,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.pin,
          borderColor: colors.background,
        },
      ]}
    >
      <Text style={[styles.count, { color: colors.onPin }]}>{count}</Text>
    </View>
  );
}

/** A municipality name, drawn over its territory at province scale. */
export function AreaLabel({ name, scheme }: { name: string; scheme: Scheme }) {
  const colors = palettes[scheme];
  return (
    <Text
      pointerEvents="none"
      style={[
        styles.area,
        { color: colors.textSecondary, textShadowColor: colors.background },
      ]}
    >
      {name.toUpperCase()}
    </Text>
  );
}

/** A road report: severity colour plus its category glyph (never colour alone). */
export function ReportDot({
  icon,
  color,
  selected,
  scheme,
}: {
  icon: string;
  color: string;
  selected: boolean;
  scheme: Scheme;
}) {
  const colors = palettes[scheme];
  const size = selected ? 34 : 28;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.report,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          borderColor: colors.onStatus,
        },
      ]}
    >
      <Icon
        as={categoryIcon(icon)}
        size={selected ? 17 : 14}
        color={colors.onStatus}
        strokeWidth={2.4}
      />
    </View>
  );
}

/** A citizen case with a location: a small hollow ring, quieter than places. */
export function CaseDot({ scheme }: { scheme: Scheme }) {
  const colors = palettes[scheme];
  return (
    <View
      pointerEvents="none"
      style={[
        styles.case,
        { borderColor: colors.pin, backgroundColor: colors.background },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dotRow: { flexDirection: "row", alignItems: "center" },
  dotRowNamed: { width: 180 },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: "600",
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 0 },
    flexShrink: 1,
  },
  cluster: {
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  count: { fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] },
  area: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.3,
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 0 },
  },
  report: {
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  case: { width: 14, height: 14, borderRadius: 7, borderWidth: 3 },
});
