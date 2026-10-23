import type { ContentTarget } from "@ruta/contracts";
import { useMutation } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Check } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { safetyErrorKey } from "@/features/safety/errors";
import { orpc } from "@/lib/api";
import { requestId } from "@/lib/ids";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { Icon } from "@/ui/icon";
import { ListSection } from "@/ui/list";
import { PressableScale } from "@/ui/pressable";
import { SheetHeader } from "@/ui/sheet-header";
import { Text } from "@/ui/text";
import { space, TOUCH, useTheme } from "@/ui/theme";
import { useToast } from "@/ui/toast";

const REASONS = ["abuse", "personal_information", "unsafe", "other"] as const;
type Reason = (typeof REASONS)[number];

/** Why someone's contribution should be reviewed by their municipality's team. */
export default function ReportContentSheet() {
  const { kind, ref } = useLocalSearchParams<{
    kind: ContentTarget["kind"];
    ref: string;
  }>();
  const t = useTranslations("safety");
  const { colors } = useTheme();
  const toast = useToast();
  const [reason, setReason] = useState<Reason | null>(null);
  const [details, setDetails] = useState("");
  // One id per opened sheet: a retry after a lost reply is the same report.
  const id = useMemo(() => requestId(), []);

  const report = useMutation(
    orpc.safety.report.mutationOptions({
      onSuccess: () => {
        toast.show({ title: t("report.sent"), body: t("report.sentHint") });
        router.back();
      },
      onError: (error) =>
        toast.show({
          title: t(`errors.${safetyErrorKey(error)}`),
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
      <SheetHeader title={t("report.title")} lede={t("report.subtitle")} />
      <ListSection title={t("report.reasonLabel")}>
        {REASONS.map((item) => (
          <PressableScale
            key={item}
            onPress={() => setReason(item)}
            haptic="selection"
            scaleTo={0.985}
            accessibilityRole="radio"
            accessibilityState={{ checked: reason === item }}
            accessibilityLabel={t(`reasons.${item}`)}
            testID={`report-reason-${item}`}
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
        label={t("report.detailsLabel")}
        helper={t("report.detailsHint")}
        value={details}
        onChangeText={setDetails}
        multiline
        maxLength={500}
      />
      <View>
        <Button
          label={t("report.submit")}
          disabled={!reason || !kind || !ref}
          loading={report.isPending}
          block
          testID="report-submit"
          onPress={() =>
            reason &&
            kind &&
            ref &&
            report.mutate({
              requestId: id,
              target: { kind, ref },
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
