import { trafficColor } from "@ruta/shared/traffic";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, Clock, Ruler, X } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useFormatter, useTranslations } from "use-intl";
import { useMemberAction } from "@/features/auth/session";
import { useAgo } from "@/i18n/ago";
import { orpc } from "@/lib/api";
import { Button } from "@/ui/button";
import { categoryIcon, Icon } from "@/ui/icon";
import { IconButton } from "@/ui/surfaces";
import { Badge } from "@/ui/tags";
import { Text } from "@/ui/text";
import { space } from "@/ui/theme";
import { useToast } from "@/ui/toast";
import type { TrafficReport } from "./data";

/** One road report in the map sheet: what, where, how fresh, and is it still there. */
export function TrafficSummary({
  report,
  onClose,
}: {
  report: TrafficReport;
  onClose: () => void;
}) {
  const t = useTranslations("traffic");
  const tc = useTranslations("common");
  const format = useFormatter();
  const ago = useAgo();
  const toast = useToast();
  const queryClient = useQueryClient();
  const asMember = useMemberAction();
  const color = trafficColor(report.state, report.severity);
  const cleared = report.state === "cleared";

  const confirm = useMutation(
    orpc.traffic.confirm.mutationOptions({
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: orpc.traffic.active.key() });
        toast.show({
          title:
            result.status === "cleared" ? t("thanksCleared") : t("thanksStill"),
        });
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
    <View style={styles.wrap} testID="traffic-summary">
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: color }]}>
          <Icon
            as={categoryIcon(report.categoryIcon)}
            size={22}
            color="#FFFFFF"
          />
        </View>
        <View style={styles.flex}>
          <Text variant="title3" accessibilityRole="header">
            {report.categoryName}
          </Text>
          <Text variant="subhead" tone="tertiary">
            {report.municipalityName} · {ago(report.createdAt)}
          </Text>
        </View>
        <IconButton
          icon={X}
          label={tc("close")}
          onPress={onClose}
          size={32}
          haptic="none"
        />
      </View>

      <View style={styles.badges}>
        <Badge
          label={
            cleared ? t("cleared") : t(`severity.${report.severity ?? "minor"}`)
          }
          tone={
            cleared
              ? "success"
              : report.severity === "blocking"
                ? "danger"
                : "warning"
          }
          icon={cleared ? CircleCheck : undefined}
        />
        {report.lengthMeters ? (
          <Badge
            label={t("length", { meters: report.lengthMeters })}
            icon={Ruler}
          />
        ) : null}
        <Badge
          label={t("expires", {
            time: format.dateTime(new Date(report.expiresAt), "time"),
          })}
          icon={Clock}
        />
      </View>

      {report.description ? <Text>{report.description}</Text> : null}

      {report.isMine || cleared ? null : (
        <View style={styles.ask}>
          <Text variant="headline">{t("ask")}</Text>
          <View style={styles.actions}>
            <View style={styles.flex}>
              <Button
                label={t("still")}
                variant={report.myVerdict === "still" ? "primary" : "secondary"}
                size="md"
                block
                loading={
                  confirm.isPending && confirm.variables?.verdict === "still"
                }
                onPress={() =>
                  asMember(() =>
                    confirm.mutate({ reportId: report.id, verdict: "still" }),
                  )
                }
              />
            </View>
            <View style={styles.flex}>
              <Button
                label={t("gone")}
                variant={
                  report.myVerdict === "cleared" ? "primary" : "secondary"
                }
                size="md"
                block
                loading={
                  confirm.isPending && confirm.variables?.verdict === "cleared"
                }
                onPress={() =>
                  asMember(() =>
                    confirm.mutate({ reportId: report.id, verdict: "cleared" }),
                  )
                }
              />
            </View>
          </View>
        </View>
      )}

      <Text variant="footnote" tone="tertiary">
        {[
          report.reportedBy
            ? t("reportedBy", { name: report.reportedBy })
            : t("reportedAnon"),
          report.reporterResidentVerified ? t("resident") : null,
          report.stillCount > 0
            ? t("stillVoices", { count: report.stillCount })
            : null,
          report.clearedCount > 0
            ? t("clearedVoices", { count: report.clearedCount })
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: space.md,
    gap: space.md - 2,
    paddingTop: space.xs,
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: space.md - 4 },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  flex: { flex: 1 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  ask: { gap: space.sm },
  actions: { flexDirection: "row", gap: space.sm },
});
