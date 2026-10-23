import { useMutation } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Check } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { orpc } from "@/lib/api";
import { requestId } from "@/lib/ids";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { Icon } from "@/ui/icon";
import { ListSection } from "@/ui/list";
import { PressableScale } from "@/ui/pressable";
import { Text } from "@/ui/text";
import { space, TOUCH, useTheme } from "@/ui/theme";
import { useToast } from "@/ui/toast";

const REASONS = [
  "incorrect_information",
  "closed",
  "duplicate",
  "wrong_location",
  "other",
] as const;
type Reason = (typeof REASONS)[number];

/** What is wrong with a place, sent to the municipal moderators. */
export default function ReportPlaceSheet() {
  const { placeId } = useLocalSearchParams<{ placeId: string }>();
  const t = useTranslations("place");
  const tc = useTranslations("common");
  const { colors } = useTheme();
  const toast = useToast();
  const [reason, setReason] = useState<Reason | null>(null);
  const [details, setDetails] = useState("");
  const id = useMemo(() => requestId(), []);

  const report = useMutation(
    orpc.places.report.mutationOptions({
      onSuccess: () => {
        toast.show({ title: t("reportSent"), body: t("reportSentBody") });
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

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text variant="title3" accessibilityRole="header">
        {t("reportTitle")}
      </Text>
      <ListSection>
        {REASONS.map((item) => (
          <PressableScale
            key={item}
            onPress={() => setReason(item)}
            haptic="selection"
            scaleTo={0.985}
            accessibilityRole="radio"
            accessibilityState={{ checked: reason === item }}
            accessibilityLabel={t(`reasons.${item}`)}
            style={styles.reason}
          >
            <Text style={styles.flex}>{t(`reasons.${item}`)}</Text>
            {reason === item ? (
              <Icon as={Check} size={20} color="accent" />
            ) : null}
          </PressableScale>
        ))}
      </ListSection>
      <Field
        label={t("reportDetails")}
        helper={tc("optional")}
        value={details}
        onChangeText={setDetails}
        multiline
        maxLength={500}
      />
      <View>
        <Button
          label={tc("send")}
          disabled={!reason}
          loading={report.isPending}
          block
          onPress={() =>
            reason &&
            report.mutate({
              requestId: id,
              placeId,
              reason,
              details: details.trim() || undefined,
            })
          }
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, paddingTop: space.lg, gap: space.lg },
  flex: { flex: 1 },
  reason: {
    minHeight: TOUCH + 4,
    paddingHorizontal: space.md,
    flexDirection: "row",
    alignItems: "center",
  },
});
