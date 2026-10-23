import { Stack } from "expo-router";
import { useTranslations } from "use-intl";
import { largeTitleOptions } from "@/ui/navigation";

export default function ConsultationsLayout() {
  const t = useTranslations("tabs");
  return (
    <Stack screenOptions={largeTitleOptions()}>
      <Stack.Screen name="index" options={{ title: t("consultations") }} />
    </Stack>
  );
}
