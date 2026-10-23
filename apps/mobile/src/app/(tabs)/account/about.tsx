import * as Application from "expo-application";
import { Stack } from "expo-router";
import { Code2, Map as MapIcon, Scale } from "lucide-react-native";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { BrandMark } from "@/ui/brand";
import { ListRow, ListSection } from "@/ui/list";
import { Text } from "@/ui/text";
import { space, useTheme } from "@/ui/theme";

const SOURCE_URL = process.env.EXPO_PUBLIC_SOURCE_URL;

export default function AboutScreen() {
  const t = useTranslations("about");
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
      <View style={styles.hero}>
        <BrandMark size={84} />
        <Text variant="title2">Ruta Cibao</Text>
        <Text tone="secondary" align="center">
          {t("tagline")}
        </Text>
        <Text variant="footnote" tone="tertiary">
          {t("version", {
            version: Application.nativeApplicationVersion ?? "",
            build: Application.nativeBuildVersion ?? "",
          })}
        </Text>
      </View>
      <ListSection title={t("credits")}>
        <ListRow
          title={t("license")}
          subtitle="MIT"
          icon={Scale}
          iconTint="textTertiary"
        />
        <ListRow
          title={t("maps")}
          subtitle={t("mapsCredit")}
          icon={MapIcon}
          iconTint="accent"
        />
        {SOURCE_URL ? (
          <ListRow
            title={t("source")}
            icon={Code2}
            iconTint="pine"
            onPress={() => Linking.openURL(SOURCE_URL)}
          />
        ) : null}
      </ListSection>
      <Text variant="footnote" tone="tertiary" align="center">
        {t("contest")}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, gap: space.lg, paddingBottom: space.xxl },
  hero: { alignItems: "center", gap: space.sm, paddingVertical: space.lg },
});
