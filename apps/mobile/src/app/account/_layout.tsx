import { router, Stack } from "expo-router";
import { X } from "lucide-react-native";
import { useTranslations } from "use-intl";
import { largeTitleOptions } from "@/ui/navigation";
import { IconButton } from "@/ui/surfaces";
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
          headerRight: () => (
            <IconButton
              icon={X}
              label={tc("close")}
              onPress={() => router.dismiss()}
              size={36}
              haptic="none"
              testID="account-close"
            />
          ),
        }}
      />
    </Stack>
  );
}
