import { ChevronRight, type LucideIcon } from "lucide-react-native";
import { Children, Fragment, isValidElement, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Icon } from "./icon";
import { PressableScale } from "./pressable";
import { Text } from "./text";
import { type Palette, radius, space, TOUCH, useTheme } from "./theme";

export type ListSectionProps = {
  title?: string;
  footer?: string;
  children: ReactNode;
};

/** An inset grouped section, the way Settings lays out rows. */
export function ListSection({ title, footer, children }: ListSectionProps) {
  const { colors } = useTheme();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.section}>
      {title ? (
        <Text
          variant="footnote"
          tone="tertiary"
          uppercase
          style={styles.sectionTitle}
          accessibilityRole="header"
        >
          {title}
        </Text>
      ) : null}
      <View
        style={[
          styles.group,
          { backgroundColor: colors.surface, borderColor: colors.hairline },
        ]}
      >
        {rows.map((row, index) => (
          <Fragment key={row.key ?? index}>
            {index > 0 ? (
              <View
                style={[
                  styles.separator,
                  { backgroundColor: colors.separator },
                ]}
              />
            ) : null}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? (
        <Text variant="footnote" tone="tertiary" style={styles.footer}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

export type ListRowProps = {
  title: string;
  subtitle?: string;
  value?: string;
  icon?: LucideIcon;
  iconTint?: keyof Palette | (string & {});
  onPress?: () => void;
  destructive?: boolean;
  /** A trailing control (switch, badge) instead of the chevron. */
  accessory?: ReactNode;
  accessibilityHint?: string;
  testID?: string;
};

export function ListRow({
  title,
  subtitle,
  value,
  icon,
  iconTint = "accent",
  onPress,
  destructive,
  accessory,
  accessibilityHint,
  testID,
}: ListRowProps) {
  const { colors } = useTheme();
  const body = (
    <View style={styles.row}>
      {icon ? (
        <View
          style={[
            styles.iconWell,
            {
              backgroundColor:
                iconTint in colors
                  ? colors[iconTint as keyof Palette]
                  : (iconTint as string),
            },
          ]}
        >
          <Icon as={icon} size={17} color="#FFFFFF" />
        </View>
      ) : null}
      <View style={styles.rowText}>
        <Text tone={destructive ? "danger" : "primary"}>{title}</Text>
        {subtitle ? (
          <Text variant="footnote" tone="tertiary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text tone="tertiary" numberOfLines={1} style={styles.value}>
          {value}
        </Text>
      ) : null}
      {accessory ??
        (onPress && !destructive ? (
          <Icon as={ChevronRight} size={18} color="textDisabled" />
        ) : null)}
    </View>
  );

  if (!onPress) {
    return (
      <View
        accessible
        accessibilityLabel={[title, subtitle, value].filter(Boolean).join(", ")}
        testID={testID}
      >
        {body}
      </View>
    );
  }
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      scaleTo={0.985}
      accessibilityRole="button"
      accessibilityLabel={[title, value].filter(Boolean).join(", ")}
      accessibilityHint={accessibilityHint}
    >
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  sectionTitle: { paddingHorizontal: space.md, letterSpacing: 0.4 },
  group: {
    borderRadius: radius.card,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: space.md,
  },
  footer: { paddingHorizontal: space.md },
  row: {
    minHeight: TOUCH + 4,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md - 4,
  },
  iconWell: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, gap: 2 },
  value: { maxWidth: "45%" },
});
