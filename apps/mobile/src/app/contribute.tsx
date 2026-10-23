import { type Href, router } from "expo-router";
import {
  ChevronRight,
  type LucideIcon,
  MapPinPlus,
  MessageSquareText,
  TriangleAlert,
} from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { Icon } from "@/ui/icon";
import { PressableScale } from "@/ui/pressable";
import { Text } from "@/ui/text";
import { type Palette, radius, space, useTheme } from "@/ui/theme";

type Option = {
  key: "place" | "traffic" | "consultation";
  icon: LucideIcon;
  tint: keyof Palette;
  href: Href;
};

/** Every way to contribute, in one list: adding a kind means adding a row. */
const OPTIONS: Option[] = [
  {
    key: "traffic",
    icon: TriangleAlert,
    tint: "warning",
    href: "/contribute/traffic",
  },
  { key: "place", icon: MapPinPlus, tint: "accent", href: "/contribute/place" },
  {
    key: "consultation",
    icon: MessageSquareText,
    tint: "pine",
    href: "/consultation/new",
  },
];

export default function ContributeSheet() {
  const t = useTranslations("contribute");
  const { colors } = useTheme();
  return (
    <View style={[styles.sheet, { backgroundColor: colors.background }]}>
      <Text variant="title2" accessibilityRole="header">
        {t("title")}
      </Text>
      <Text tone="secondary">{t("lede")}</Text>
      <View style={styles.options}>
        {OPTIONS.map((option) => (
          <PressableScale
            key={option.key}
            testID={`contribute-${option.key}`}
            onPress={() => {
              router.back();
              router.push(option.href);
            }}
            haptic="light"
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel={`${t(`${option.key}.title`)}. ${t(`${option.key}.body`)}`}
            style={[
              styles.option,
              { backgroundColor: colors.surface, borderColor: colors.hairline },
            ]}
          >
            <View
              style={[styles.icon, { backgroundColor: colors[option.tint] }]}
            >
              <Icon as={option.icon} size={22} color="#FFFFFF" />
            </View>
            <View style={styles.text}>
              <Text variant="headline">{t(`${option.key}.title`)}</Text>
              <Text variant="subhead" tone="secondary">
                {t(`${option.key}.body`)}
              </Text>
            </View>
            <Icon as={ChevronRight} size={18} color="textDisabled" />
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    padding: space.md,
    paddingTop: space.lg,
    paddingBottom: space.xxl,
    gap: space.sm,
  },
  options: { gap: space.sm + 2, marginTop: space.md },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md - 2,
    padding: space.md - 2,
    borderRadius: radius.card,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: 2 },
});
