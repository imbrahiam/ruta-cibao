import {
  Button,
  Host,
  HStack,
  Image,
  Text as NativeText,
  Spacer,
} from "@expo/ui/swift-ui";
import {
  buttonStyle,
  foregroundStyle,
  frame,
  padding,
} from "@expo/ui/swift-ui/modifiers";
import { router } from "expo-router";
import { Search } from "lucide-react-native";
import { Platform, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { Icon } from "@/ui/icon";
import { PressableScale } from "@/ui/pressable";
import { Text } from "@/ui/text";
import { floating, radius, space, useTheme } from "@/ui/theme";
import { CategoryFilter } from "./category-filter";

/**
 * The search field at the top of the map, with the place filter beside it.
 * On iOS both are SwiftUI glass controls (Liquid Glass on iOS 26+); tapping
 * the field opens search on its own screen with the keyboard up.
 */
export function MapSearchBar({
  categories,
  category,
  onCategoryChange,
}: {
  categories: ReadonlyArray<{ id: string; name: string }>;
  category: string | null;
  onCategoryChange: (value: string | null) => void;
}) {
  const t = useTranslations("map");
  const { colors, scheme } = useTheme();
  const open = () => router.push("/search");

  return (
    <View style={styles.row} pointerEvents="box-none">
      {Platform.OS === "ios" ? (
        <Host
          matchContents={{ vertical: true }}
          colorScheme={scheme}
          style={styles.flex}
        >
          <Button
            onPress={open}
            modifiers={[buttonStyle("glass"), frame({ maxWidth: 10_000 })]}
          >
            <HStack spacing={8} modifiers={[padding({ vertical: 6 })]}>
              <Image
                systemName="magnifyingglass"
                modifiers={[foregroundStyle(colors.textSecondary)]}
              />
              <NativeText modifiers={[foregroundStyle(colors.textSecondary)]}>
                {t("searchPlaceholder")}
              </NativeText>
              <Spacer />
            </HStack>
          </Button>
        </Host>
      ) : (
        <PressableScale
          onPress={open}
          accessibilityRole="search"
          accessibilityLabel={t("searchLabel")}
          containerStyle={styles.flex}
          style={[
            styles.fallback,
            floating(scheme),
            { backgroundColor: colors.elevated },
          ]}
        >
          <Icon as={Search} size={19} color="textSecondary" />
          <Text tone="secondary" numberOfLines={1}>
            {t("searchPlaceholder")}
          </Text>
        </PressableScale>
      )}
      <CategoryFilter
        categories={categories}
        value={category}
        onChange={onCategoryChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
  },
  flex: { flex: 1 },
  fallback: {
    height: 48,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
  },
});
