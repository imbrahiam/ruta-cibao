import { formatPhoneInput } from "@ruta/shared/phone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useTranslations } from "use-intl";
import { orpc } from "@/lib/api";
import { requestId } from "@/lib/ids";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { Text } from "@/ui/text";
import { space, useTheme } from "@/ui/theme";
import { useToast } from "@/ui/toast";

/** "This business is mine": evidence and the contact the owner wants shown. */
export default function ClaimBusinessScreen() {
  const { placeId, name } = useLocalSearchParams<{
    placeId: string;
    name: string;
  }>();
  const t = useTranslations("place");
  const tc = useTranslations("common");
  const { colors } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const id = useMemo(() => requestId(), []);
  const [evidence, setEvidence] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [hours, setHours] = useState("");

  const claim = useMutation(
    orpc.businesses.claim.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.businesses.claimState.key(),
        });
        toast.show({ title: t("claimSent"), body: t("claimSentBody") });
        router.back();
      },
      onError: () =>
        toast.show({
          title: tc("errorTitle"),
          body: tc("errorBody"),
          tone: "error",
        }),
    }),
  );

  const tooShort = evidence.trim().length < 20;

  return (
    <KeyboardAwareScrollView
      bottomOffset={24}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: t("claimTitle") }} />
      <Text variant="title2" accessibilityRole="header">
        {name}
      </Text>
      <Text tone="secondary">{t("claimLede")}</Text>
      <Field
        label={t("claimEvidence")}
        helper={t("claimEvidenceHelper")}
        value={evidence}
        onChangeText={setEvidence}
        multiline
        maxLength={600}
      />
      <Field
        label={t("claimPhone")}
        helper={tc("optional")}
        prefix="+1"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={(text) => setPhone(formatPhoneInput(text))}
      />
      <Field
        label="WhatsApp"
        helper={tc("optional")}
        prefix="+1"
        keyboardType="phone-pad"
        value={whatsapp}
        onChangeText={(text) => setWhatsapp(formatPhoneInput(text))}
      />
      <Field
        label={t("hours")}
        helper={t("hoursHelper")}
        value={hours}
        onChangeText={setHours}
        maxLength={240}
      />
      <Button
        label={tc("send")}
        disabled={tooShort}
        loading={claim.isPending}
        block
        onPress={() =>
          claim.mutate({
            requestId: id,
            placeId,
            evidence: evidence.trim(),
            contactPhone: phone,
            whatsapp,
            openingHours: hours.trim() || undefined,
          })
        }
      />
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, gap: space.lg, paddingBottom: space.xxl },
});
