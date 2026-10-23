import { formatPhone } from "@ruta/shared/phone";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { signInErrorKey } from "@/features/auth/errors";
import { authClient } from "@/lib/auth";
import { queryClient } from "@/lib/query";
import { Button } from "@/ui/button";
import { OtpInput } from "@/ui/field";
import { haptic } from "@/ui/pressable";
import { IconButton } from "@/ui/surfaces";
import { Text } from "@/ui/text";
import { space, useTheme } from "@/ui/theme";
import { useToast } from "@/ui/toast";

const RESEND_SECONDS = 60;

export default function VerifyScreen() {
  const t = useTranslations("signIn");
  const tc = useTranslations("common");
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { method, destination } = useLocalSearchParams<{
    method: "phone" | "email";
    destination: string;
  }>();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [wait, setWait] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const shown =
    method === "phone" ? `+1 ${formatPhone(destination)}` : destination;

  const verify = useCallback(
    async (otp: string) => {
      setVerifying(true);
      setError(null);
      const result =
        method === "phone"
          ? await authClient.phoneNumber.verify({
              phoneNumber: destination,
              code: otp,
            })
          : await authClient.signIn.emailOtp({ email: destination, otp });
      setVerifying(false);
      if (result.error) {
        haptic("medium");
        setCode("");
        setError(t(signInErrorKey(result.error)));
        return;
      }
      await queryClient.invalidateQueries();
      toast.show({ title: t("welcome") });
      router.dismissAll();
      router.back();
    },
    [destination, method, t, toast],
  );

  const resend = async () => {
    setError(null);
    const result =
      method === "phone"
        ? await authClient.phoneNumber.sendOtp({ phoneNumber: destination })
        : await authClient.emailOtp.sendVerificationOtp({
            email: destination,
            type: "sign-in",
          });
    if (result.error) return setError(t(signInErrorKey(result.error)));
    setWait(RESEND_SECONDS);
    toast.show({ title: t("resent"), tone: "info" });
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.back, { top: insets.top + space.sm }]}>
        <IconButton
          icon={ChevronLeft}
          label={tc("back")}
          onPress={() => router.back()}
          haptic="none"
        />
      </View>
      <KeyboardAwareScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.xxl + space.md },
        ]}
      >
        <View style={styles.heading}>
          <Text variant="largeTitle" accessibilityRole="header">
            {t("verifyTitle")}
          </Text>
          <Text variant="callout" tone="secondary">
            {t("verifyLede", { destination: shown })}{" "}
            <Text
              variant="callout"
              tone="accent"
              weight="600"
              accessibilityRole="link"
              onPress={() => router.back()}
            >
              {t("change")}
            </Text>
          </Text>
        </View>

        <OtpInput
          testID="sign-in-code"
          label={t("codeLabel")}
          value={code}
          error={Boolean(error)}
          autoFocus
          onChange={(next) => {
            setCode(next);
            if (error) setError(null);
            if (next.length === 6 && !verifying) verify(next);
          }}
        />
        {error ? (
          <Text
            tone="danger"
            variant="subhead"
            align="center"
            accessibilityLiveRegion="assertive"
          >
            {error}
          </Text>
        ) : null}

        <Button
          testID="sign-in-verify"
          label={t("verify")}
          onPress={() => verify(code)}
          loading={verifying}
          disabled={code.length !== 6}
          block
        />

        {wait > 0 ? (
          <Text variant="subhead" tone="tertiary" align="center" tabular>
            {t("resendIn", { seconds: wait })}
          </Text>
        ) : (
          <Button
            label={t("resend")}
            variant="tertiary"
            size="md"
            onPress={resend}
          />
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  back: { position: "absolute", left: space.md, zIndex: 2 },
  content: {
    paddingHorizontal: space.lg,
    gap: space.lg,
    paddingBottom: space.xl,
  },
  heading: { gap: space.sm },
});
