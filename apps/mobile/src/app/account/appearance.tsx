import { Stack } from "expo-router";
import { Check } from "lucide-react-native";
import { ScrollView, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { setTheme } from "@/features/appearance/theme-store";
import { Icon } from "@/ui/icon";
import { haptic, PressableScale } from "@/ui/pressable";
import { Card } from "@/ui/surfaces";
import { Text } from "@/ui/text";
import {
  radius,
  space,
  THEMES,
  type ThemeId,
  useTheme,
  useThemeId,
} from "@/ui/theme";

const themeIds = Object.keys(THEMES) as ThemeId[];

export default function AppearanceScreen() {
  const t = useTranslations("appearance");
  const { colors, scheme } = useTheme();
  const selectedId = useThemeId();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      testID="appearance-screen"
    >
      <Stack.Screen
        options={{ title: t("title"), headerLargeTitleEnabled: false }}
      />
      {themeIds.map((id) => {
        const seed = THEMES[id][scheme];
        const map = THEMES[id].map[scheme];
        const selected = id === selectedId;
        return (
          <PressableScale
            key={id}
            testID={`appearance-${id}`}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={t(`${id}.name`)}
            accessibilityHint={t(`${id}.description`)}
            scaleTo={0.985}
            onPress={() => {
              setTheme(id);
              void haptic("selection");
            }}
          >
            <Card
              style={[
                styles.card,
                {
                  backgroundColor: colors.background,
                  borderColor: selected ? colors.accent : colors.hairline,
                },
              ]}
            >
              <View
                style={[styles.preview, { backgroundColor: seed.paper }]}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <View style={[styles.map, { backgroundColor: map.ground }]}>
                  <View style={[styles.park, { backgroundColor: map.park }]} />
                  <View style={[styles.road, { borderColor: map.road }]} />
                  <View
                    style={[
                      styles.pin,
                      {
                        backgroundColor: seed.accent,
                        borderColor: seed.paper,
                      },
                    ]}
                  />
                </View>
                <View
                  style={[styles.previewRow, { backgroundColor: seed.surface }]}
                >
                  <View style={styles.previewLines}>
                    <View
                      style={[
                        styles.previewLine,
                        { backgroundColor: seed.ink, width: "55%" },
                      ]}
                    />
                    <View
                      style={[
                        styles.previewLine,
                        { backgroundColor: seed.fill, width: "80%" },
                      ]}
                    />
                  </View>
                  <View
                    style={[
                      styles.previewButton,
                      { backgroundColor: seed.accent },
                    ]}
                  >
                    <Text
                      variant="footnote"
                      weight="600"
                      style={{ color: seed.onAccent }}
                    >
                      {t("previewAction")}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.labelRow}>
                <View style={styles.label}>
                  <Text variant="headline">{t(`${id}.name`)}</Text>
                  <Text variant="subhead" tone="secondary">
                    {t(`${id}.description`)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.check,
                    {
                      backgroundColor: selected
                        ? colors.accent
                        : colors.surface,
                      borderColor: selected ? colors.accent : colors.hairline,
                    },
                  ]}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  {selected ? (
                    <Icon as={Check} size={16} color="onAccent" />
                  ) : null}
                </View>
              </View>
            </Card>
          </PressableScale>
        );
      })}
      <Text variant="footnote" tone="tertiary" style={styles.footnote}>
        {t("systemFootnote")}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: space.md,
    gap: space.md,
    paddingBottom: space.xxl + space.xl,
  },
  card: { borderWidth: 2, gap: space.md },
  preview: { borderRadius: radius.input, overflow: "hidden" },
  map: { height: 88, overflow: "hidden" },
  park: {
    position: "absolute",
    width: "55%",
    height: 104,
    top: -space.lg,
    right: -space.md,
    borderRadius: radius.frame,
    transform: [{ rotate: "-25deg" }],
  },
  road: {
    position: "absolute",
    width: "120%",
    top: 42,
    left: -space.md,
    borderTopWidth: 8,
    transform: [{ rotate: "-12deg" }],
  },
  pin: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 3,
    top: 28,
    left: "46%",
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.sm,
  },
  previewLines: { flex: 1, gap: space.xs },
  previewLine: { height: 6, borderRadius: radius.pill },
  previewButton: {
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  labelRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  label: { flex: 1, gap: space.xs },
  check: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  footnote: { paddingHorizontal: space.md },
});
