import { NativeTabs } from "expo-router/native-tabs";
import { DynamicColorIOS, Platform } from "react-native";
import { useTranslations } from "use-intl";
import { palettes, useThemeId } from "@/ui/theme";

/**
 * Four peers, always labelled, plus search. On iOS 26 the search item is the
 * system's own search field at the end of the tab bar (`role="search"`): it
 * opens its own screen with the keyboard already up. The system tab bar
 * (Liquid Glass) owns the transitions: tabs never slide.
 */
export default function TabsLayout() {
  const t = useTranslations("tabs");
  // The native tab bar reads its tint once, so a theme switch remounts it
  // (the switch happens in the account sheet, above the tabs).
  const themeId = useThemeId();
  const tint =
    Platform.OS === "ios"
      ? DynamicColorIOS({
          light: palettes.light.accent,
          dark: palettes.dark.accent,
        })
      : palettes.light.accent;
  return (
    <NativeTabs key={themeId} tintColor={tint} minimizeBehavior="never">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t("map")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "map", selected: "map.fill" }}
          md="map"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="consultations">
        <NativeTabs.Trigger.Label>
          {t("consultations")}
        </NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{
            default: "bubble.left.and.text.bubble.right",
            selected: "bubble.left.and.text.bubble.right.fill",
          }}
          md="forum"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="contributions">
        <NativeTabs.Trigger.Label>
          {t("contributions")}
        </NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "tray.full", selected: "tray.full.fill" }}
          md="inbox"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>{t("account")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{
            default: "person.crop.circle",
            selected: "person.crop.circle.fill",
          }}
          md="account_circle"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="search" role="search">
        <NativeTabs.Trigger.Label>{t("search")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
