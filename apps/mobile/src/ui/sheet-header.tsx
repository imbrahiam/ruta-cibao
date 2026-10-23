import { router } from "expo-router";
import { X } from "lucide-react-native";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { IconButton } from "./surfaces";
import { Text } from "./text";
import { space } from "./theme";

/**
 * The top of every sheet: a title, an optional line under it, and a close
 * button in the same place and size as the map sheet's. One component so the
 * layers sheet, the contribute chooser and the report sheet cannot drift.
 */
export function SheetHeader({
  title,
  lede,
  onClose = () => router.back(),
  leading,
}: {
  title: string;
  lede?: string;
  onClose?: () => void;
  /** A badge or icon drawn before the title (e.g. a category disc). */
  leading?: ReactNode;
}) {
  const tc = useTranslations("common");
  return (
    <View style={styles.row}>
      {leading}
      <View style={styles.text}>
        <Text variant="title3" accessibilityRole="header">
          {title}
        </Text>
        {lede ? (
          <Text variant="subhead" tone="secondary">
            {lede}
          </Text>
        ) : null}
      </View>
      <IconButton
        icon={X}
        label={tc("close")}
        onPress={onClose}
        size={32}
        haptic="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.md - 4 },
  text: { flex: 1, gap: 2, paddingTop: 2 },
});
