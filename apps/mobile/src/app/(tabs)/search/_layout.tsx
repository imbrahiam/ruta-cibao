import { Stack } from "expo-router";
import { useTranslations } from "use-intl";
import { largeTitleOptions } from "@/ui/navigation";

/**
 * The search tab. On iOS 26 its tab-bar item is the system search field: tapping
 * it opens this screen with the keyboard up, apart from the map.
 */
export default function SearchLayout() {
  const t = useTranslations("search");
  return (
    <Stack screenOptions={largeTitleOptions()}>
      <Stack.Screen name="index" options={{ title: t("title") }} />
    </Stack>
  );
}
