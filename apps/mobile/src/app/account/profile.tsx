import { router, Stack } from "expo-router";
import { StyleSheet } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useTranslations } from "use-intl";
import { ProfileForm } from "@/features/account/profile-form";
import { useMe } from "@/features/auth/session";
import { space, useTheme } from "@/ui/theme";

export default function ProfileScreen() {
  const t = useTranslations("profile");
  const { colors } = useTheme();
  const { me } = useMe();
  return (
    <KeyboardAwareScrollView
      bottomOffset={24}
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen
        options={{ title: t("title"), headerLargeTitleEnabled: false }}
      />
      {me ? (
        <ProfileForm
          initialName={me.displayName ?? ""}
          initialMunicipality={me.municipalityId}
          onDone={() => router.back()}
        />
      ) : null}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, paddingBottom: space.xxl },
});
