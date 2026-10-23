import { StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { ProfileForm } from "@/features/account/profile-form";
import { closeSignIn, useMe } from "@/features/auth/session";
import { Text } from "@/ui/text";
import { space, useTheme } from "@/ui/theme";

/** After the very first sign-in: what to call you, and where you live. */
export default function ProfileStep() {
  const t = useTranslations("profile");
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { me } = useMe();
  const close = closeSignIn;

  return (
    <KeyboardAwareScrollView
      bottomOffset={24}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + space.xxl },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.heading}>
        <Text variant="largeTitle" accessibilityRole="header">
          {t("welcomeTitle")}
        </Text>
        <Text variant="callout" tone="secondary">
          {t("welcomeLede")}
        </Text>
      </View>
      <ProfileForm
        initialName=""
        initialMunicipality={me?.municipalityId ?? null}
        onDone={close}
        secondary={{ label: t("skip"), onPress: close }}
      />
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.lg,
    gap: space.xl,
    paddingBottom: space.xxl,
  },
  heading: { gap: space.sm },
});
