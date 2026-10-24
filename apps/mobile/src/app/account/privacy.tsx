import { Stack } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import { useTranslations } from "use-intl";
import { Card } from "@/ui/surfaces";
import { Text } from "@/ui/text";
import { space, useTheme } from "@/ui/theme";

const SECTIONS = [
  "account",
  "location",
  "contributions",
  "photos",
  "device",
  "providers",
] as const;

/** What the app keeps, why, and for how long — in plain words. */
export default function PrivacyScreen() {
  const t = useTranslations("privacy");
  const { colors } = useTheme();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Stack.Screen
        options={{ title: t("title"), headerLargeTitleEnabled: false }}
      />
      <Text tone="secondary">{t("lede")}</Text>
      {SECTIONS.map((section) => (
        <Card key={section} style={styles.card}>
          <Text variant="headline">{t(`${section}.title`)}</Text>
          <Text variant="subhead" tone="secondary" style={styles.body}>
            {t(`${section}.body`)}
          </Text>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, gap: space.md, paddingBottom: space.xxl },
  card: { gap: space.xs + 2 },
  body: { lineHeight: 21 },
});
