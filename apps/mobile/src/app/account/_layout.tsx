import { router, Stack } from "expo-router";
import { Platform } from "react-native";
import { useTranslations } from "use-intl";
import { largeTitleOptions } from "@/ui/navigation";
import { useTheme } from "@/ui/theme";

/** The account, opened as a sheet from the avatar beside the map's search. */
export default function AccountLayout() {
  const t = useTranslations("tabs");
  const tc = useTranslations("common");
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        ...largeTitleOptions(),
        headerStyle: { backgroundColor: colors.grouped },
        contentStyle: { backgroundColor: colors.grouped },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: t("account"),
        }}
      >
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon={Platform.OS === "ios" ? "xmark" : undefined}
            accessibilityLabel={tc("close")}
            onPress={() => router.dismiss()}
          >
            {tc("close")}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      </Stack.Screen>
    </Stack>
  );
}
