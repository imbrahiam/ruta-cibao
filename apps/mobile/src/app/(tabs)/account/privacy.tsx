import { Stack } from "expo-router";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useTranslations } from "use-intl";
import { Icon } from "@/ui/icon";
import { ListRow, ListSection } from "@/ui/list";
import { Text } from "@/ui/text";
import { space, useTheme } from "@/ui/theme";

const SUMMARY_SECTIONS = [
  "account",
  "contributions",
  "location",
  "photos",
  "notifications",
  "backups",
] as const;

const DETAIL_SECTIONS = [...SUMMARY_SECTIONS, "device", "providers"] as const;

/** What the app keeps, why, and for how long — in plain words. */
export default function PrivacyScreen() {
  const t = useTranslations("privacy");
  const { colors } = useTheme();
  const [detailsVisible, setDetailsVisible] = useState(false);
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.grouped }}
      contentContainerStyle={styles.content}
    >
      <Stack.Screen
        options={{ title: t("title"), headerLargeTitleEnabled: false }}
      />
      <Text tone="secondary">{t("lede")}</Text>
      <ListSection>
        {SUMMARY_SECTIONS.map((section) => (
          <ListRow
            key={section}
            title={t(`${section}.title`)}
            subtitle={t(`${section}.summary`)}
          />
        ))}
      </ListSection>
      <ListSection>
        <ListRow
          title={t(detailsVisible ? "hideDetails" : "showDetails")}
          accessibilityHint={t(
            detailsVisible ? "hideDetailsHint" : "showDetailsHint",
          )}
          onPress={() => setDetailsVisible((visible) => !visible)}
          accessory={
            <Icon
              as={detailsVisible ? ChevronUp : ChevronDown}
              size={18}
              color="textDisabled"
            />
          }
        />
      </ListSection>
      {detailsVisible ? (
        <ListSection title={t("detailsTitle")}>
          {DETAIL_SECTIONS.map((section) => (
            <ListRow
              key={section}
              title={t(`${section}.title`)}
              subtitle={t(`${section}.body`)}
            />
          ))}
        </ListSection>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, gap: space.lg, paddingBottom: space.xxl },
});
