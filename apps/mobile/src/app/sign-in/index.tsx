import { formatPhoneInput, normalizePhone } from "@ruta/shared/phone";
import { router } from "expo-router";
import { X } from "lucide-react-native";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
} from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { signInErrorKey } from "@/features/auth/errors";
import { authClient } from "@/lib/auth";
import { BrandMark } from "@/ui/brand";
import { Button } from "@/ui/button";
import { Field, type TextInputHandle } from "@/ui/field";
import { Segmented } from "@/ui/segmented";
import { IconButton } from "@/ui/surfaces";
import { Text } from "@/ui/text";
import { space, useTheme } from "@/ui/theme";

type Method = "phone" | "email";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function SignInScreen() {
  const t = useTranslations("signIn");
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [method, setMethod] = useState<Method>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const input = useRef<TextInputHandle>(null);

  const send = async () => {
    setError(null);
    if (method === "phone") {
      const e164 = normalizePhone(phone);
      if (!e164) return setError(t("phoneInvalid"));
      setSending(true);
      const result = await authClient.phoneNumber.sendOtp({
        phoneNumber: e164,
      });
      setSending(false);
      if (result.error) return setError(t(signInErrorKey(result.error)));
      router.push({
        pathname: "/sign-in/verify",
        params: { method, destination: e164 },
      });
      return;
    }
    const address = email.trim().toLowerCase();
    if (!EMAIL.test(address)) return setError(t("emailInvalid"));
    setSending(true);
    const result = await authClient.emailOtp.sendVerificationOtp({
      email: address,
      type: "sign-in",
    });
    setSending(false);
    if (result.error) return setError(t(signInErrorKey(result.error)));
    router.push({
      pathname: "/sign-in/verify",
      params: { method, destination: address },
    });
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.close, { top: insets.top + space.sm }]}>
        <IconButton
          icon={X}
          label={t("close")}
          onPress={() => router.back()}
          haptic="none"
        />
      </View>
      <KeyboardAwareScrollView
        bottomOffset={96}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.xxl + space.md },
        ]}
      >
        <BrandMark size={56} />
        <View style={styles.heading}>
          <Text variant="largeTitle" accessibilityRole="header">
            {t("title")}
          </Text>
          <Text variant="callout" tone="secondary">
            {t("lede")}
          </Text>
        </View>

        <Segmented<Method>
          accessibilityLabel={t("methodLabel")}
          value={method}
          onChange={(next) => {
            setMethod(next);
            setError(null);
            requestAnimationFrame(() => input.current?.focus());
          }}
          options={[
            { value: "phone", label: t("phone") },
            { value: "email", label: t("email") },
          ]}
        />

        {method === "phone" ? (
          <Field
            key="phone"
            ref={input}
            testID="sign-in-phone"
            label={t("phoneLabel")}
            helper={t("phoneHelper")}
            error={error ?? undefined}
            prefix="+1"
            placeholder={t("phonePlaceholder")}
            value={phone}
            onChangeText={(text) => setPhone(formatPhoneInput(text))}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel-national"
            autoFocus
            returnKeyType="send"
            onSubmitEditing={send}
          />
        ) : (
          <Field
            key="email"
            ref={input}
            testID="sign-in-email"
            label={t("emailLabel")}
            error={error ?? undefined}
            placeholder={t("emailPlaceholder")}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="send"
            onSubmitEditing={send}
          />
        )}

        <Text variant="footnote" tone="tertiary">
          {t("terms")}
        </Text>
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ opened: insets.bottom - space.sm }}>
        <View
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom + space.sm,
              backgroundColor: colors.background,
            },
          ]}
        >
          <Button
            testID="sign-in-send"
            label={t("sendCode")}
            onPress={send}
            loading={sending}
            disabled={
              method === "phone" ? phone.length < 12 : email.trim().length < 5
            }
            block
          />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  close: { position: "absolute", right: space.md, zIndex: 2 },
  content: {
    paddingHorizontal: space.lg,
    gap: space.lg,
    paddingBottom: space.xl,
  },
  heading: { gap: space.sm },
  footer: { paddingHorizontal: space.lg, paddingTop: space.sm },
});
