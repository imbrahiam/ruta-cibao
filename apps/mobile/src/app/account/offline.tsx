import * as Network from "expo-network";
import { Stack } from "expo-router";
import {
  CircleAlert,
  CircleCheck,
  Clock,
  CloudDownload,
  Footprints,
  HardDrive,
  MapPin,
  RefreshCw,
  Route,
  Send,
  Smartphone,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react-native";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import {
  type OutboxItem,
  type OutboxProcedure,
  useOutbox,
} from "@/features/offline/outbox";
import {
  type OfflineValidationErrorCode,
  useOfflineStatus,
} from "@/features/offline/store";
import { api } from "@/lib/api";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { ListRow, ListSection } from "@/ui/list";
import { Skeleton } from "@/ui/states";
import { Card } from "@/ui/surfaces";
import { Badge } from "@/ui/tags";
import { Text } from "@/ui/text";
import { radius, space, useTheme } from "@/ui/theme";
import { useToast } from "@/ui/toast";

const PROCEDURE_KEY: Record<
  OutboxProcedure,
  | "places_submit"
  | "traffic_report"
  | "consultations_open"
  | "places_report"
  | "routes_submit"
> = {
  "places.submit": "places_submit",
  "traffic.report": "traffic_report",
  "consultations.open": "consultations_open",
  "places.report": "places_report",
  "routes.submit": "routes_submit",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("es-DO", { dateStyle: "medium" }).format(date);
}

export default function OfflineScreen() {
  const t = useTranslations("offline");
  const { colors } = useTheme();
  const toast = useToast();
  const offline = useOfflineStatus();
  const outbox = useOutbox();

  const [checkingNetwork, setCheckingNetwork] = useState(false);
  const [localError, setLocalError] = useState<
    OfflineValidationErrorCode | "offline" | null
  >(null);

  const runDownload = async () => {
    setLocalError(null);
    try {
      await offline.download();
      toast.show({ title: t("downloadedToast") });
    } catch {
      // Error state is captured in `offline.error` and rendered inline.
    }
  };

  const handleRequestDownload = async () => {
    setLocalError(null);
    setCheckingNetwork(true);
    try {
      const net = await Network.getNetworkStateAsync();
      const connected =
        net.isConnected !== false && net.isInternetReachable !== false;
      if (!connected || net.type === Network.NetworkStateType.NONE) {
        setLocalError("offline");
        return;
      }

      const isUnmetered =
        net.type === Network.NetworkStateType.WIFI ||
        net.type === Network.NetworkStateType.ETHERNET;

      if (!isUnmetered) {
        let estimatedBytes = offline.snapshot?.sizeBytes ?? 3_100_000;
        try {
          const manifest = await api.offline.manifest();
          estimatedBytes = manifest.snapshotBytes;
        } catch {
          // Keep fallback estimate if manifest preflight fails.
        }
        Alert.alert(
          t("meteredTitle"),
          t("meteredBody", { size: formatBytes(estimatedBytes) }),
          [
            { text: t("meteredCancel"), style: "cancel" },
            { text: t("meteredConfirm"), onPress: () => void runDownload() },
          ],
        );
        return;
      }
    } finally {
      setCheckingNetwork(false);
    }

    await runDownload();
  };

  const handleRemove = async () => {
    setLocalError(null);
    await offline.remove();
    toast.show({ title: t("removedToast"), tone: "info" });
  };

  const handleFlushOutbox = async () => {
    const result = await outbox.flush();
    if (result.sent > 0) {
      toast.show({ title: t("outboxSentToast", { count: result.sent }) });
    }
  };

  const activeError = localError ?? offline.error;
  const percent = Math.round((offline.progress?.fraction ?? 0) * 100);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.grouped }}
      contentContainerStyle={styles.content}
    >
      <Stack.Screen options={{ title: t("title") }} />

      <Card
        style={[styles.heroCard, { backgroundColor: colors.groupedRow }]}
        testID="offline-status-card"
      >
        <View style={styles.badgeRow}>
          <Badge
            tone={offline.ready ? "success" : "neutral"}
            icon={offline.ready ? CircleCheck : CloudDownload}
            label={offline.ready ? t("readyBadge") : t("notDownloadedBadge")}
          />
          <Badge
            tone={
              offline.isOffline
                ? "warning"
                : offline.isMetered
                  ? "neutral"
                  : "accent"
            }
            icon={
              offline.isOffline
                ? WifiOff
                : offline.isMetered
                  ? Smartphone
                  : Wifi
            }
            label={
              offline.isOffline
                ? t("offlineBadge")
                : offline.isMetered
                  ? t("onlineCellular")
                  : t("onlineWifi")
            }
          />
        </View>

        <Text variant="title2">{t("provinceTitle")}</Text>
        <Text tone="secondary">{t("lede")}</Text>
        <Text variant="footnote" tone="tertiary">
          {t("mapNote")}
        </Text>

        {offline.downloading && offline.progress ? (
          <View style={styles.progressBox} testID="offline-progress">
            <View style={styles.progressHeader}>
              <Text variant="subhead" weight="600">
                {t(`progressStage.${offline.progress.stage}`, { percent })}
              </Text>
              <Text variant="footnote" tone="secondary" tabular>
                {percent}%
              </Text>
            </View>
            <View
              style={[styles.progressTrack, { backgroundColor: colors.fill }]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: colors.accent,
                    width: `${Math.max(4, Math.min(100, percent))}%`,
                  },
                ]}
              />
            </View>
          </View>
        ) : null}

        <Button
          label={
            offline.downloading
              ? t("downloadingAction")
              : offline.ready
                ? t("updateAction")
                : t("downloadAction")
          }
          icon={offline.ready ? RefreshCw : CloudDownload}
          variant={offline.ready ? "secondary" : "primary"}
          loading={offline.downloading || checkingNetwork}
          disabled={offline.downloading || checkingNetwork}
          onPress={() => void handleRequestDownload()}
          testID="offline-download-button"
          block
        />
      </Card>

      {activeError ? (
        <Card
          style={[
            styles.noticeCard,
            {
              backgroundColor: colors.groupedRow,
              borderColor: colors.hairline,
            },
          ]}
          testID="offline-error-card"
        >
          <View style={styles.noticeHeader}>
            <Icon as={CircleAlert} size={20} color="dangerInk" />
            <Text
              variant="subhead"
              weight="600"
              style={{ color: colors.dangerInk, flex: 1 }}
            >
              {t(`errors.${activeError}`)}
            </Text>
          </View>
          {offline.snapshot ? (
            <Text variant="footnote" style={{ color: colors.dangerInk }}>
              {t("keptPreviousNote", {
                date: formatDate(offline.snapshot.generatedAt),
              })}
            </Text>
          ) : null}
        </Card>
      ) : null}

      {offline.loading ? (
        <Skeleton height={160} rounded={radius.card} />
      ) : offline.snapshot ? (
        <>
          <ListSection title={t("snapshotSection")}>
            <ListRow
              title={t("versionDate")}
              value={formatDate(offline.snapshot.generatedAt)}
              icon={Clock}
              testID="offline-version-date"
            />
            <ListRow
              title={t("sizeLabel")}
              value={formatBytes(offline.snapshot.sizeBytes)}
              icon={HardDrive}
              testID="offline-version-size"
            />
            <ListRow
              title={t("placesRowTitle")}
              value={offline.snapshot.placeCount.toLocaleString("es-DO")}
              icon={MapPin}
            />
            <ListRow
              title={t("routesRowTitle")}
              value={offline.snapshot.routeCount.toLocaleString("es-DO")}
              icon={Footprints}
            />
            <ListRow
              title={t("roadsRowTitle")}
              value={offline.snapshot.roadCount.toLocaleString("es-DO")}
              icon={Route}
            />
          </ListSection>

          <ListSection footer={t("removeHint")}>
            <ListRow
              title={t("removeAction")}
              icon={Trash2}
              destructive
              onPress={() => void handleRemove()}
              testID="offline-remove"
            />
          </ListSection>
        </>
      ) : null}

      <ListSection title={t("outboxSection")}>
        {outbox.items.length === 0 ? (
          <ListRow title={t("outboxEmpty")} icon={Send} />
        ) : (
          outbox.items.map((item) => (
            <OutboxRowItem
              key={item.requestId}
              item={item}
              onRetry={() => void outbox.retry(item.requestId)}
              onRemove={async () => {
                await outbox.remove(item.requestId);
                toast.show({ title: t("outboxRemovedToast"), tone: "info" });
              }}
            />
          ))
        )}
      </ListSection>

      {outbox.pendingCount > 0 ? (
        <Button
          label={outbox.flushing ? t("outboxFlushing") : t("outboxFlushAction")}
          icon={Send}
          variant="secondary"
          loading={outbox.flushing}
          disabled={outbox.flushing || offline.isOffline}
          onPress={() => void handleFlushOutbox()}
          testID="offline-outbox-flush"
          block
        />
      ) : null}
    </ScrollView>
  );
}

function OutboxRowItem({
  item,
  onRetry,
  onRemove,
}: {
  item: OutboxItem;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations("offline");
  const procedureLabel = t(`outboxProcedure.${PROCEDURE_KEY[item.procedure]}`);

  const errorExplanation = item.blocked
    ? item.errorReason === "stale_report"
      ? t("outboxErrors.stale_report")
      : item.errorReason === "duplicate"
        ? t("outboxErrors.duplicate")
        : item.errorReason === "municipality_mismatch"
          ? t("outboxErrors.municipality_mismatch")
          : item.errorReason === "outside_province"
            ? t("outboxErrors.outside_province")
            : item.errorReason === "invalid_street"
              ? t("outboxErrors.invalid_street")
              : t("outboxErrors.generic")
    : item.errorReason === "unauthenticated"
      ? t("outboxErrors.unauthenticated")
      : null;

  return (
    <View style={styles.outboxItem} testID={`outbox-item-${item.requestId}`}>
      <View style={styles.outboxHeader}>
        <View style={styles.outboxText}>
          <Text variant="headline" numberOfLines={1}>
            {item.title}
          </Text>
          <Text variant="footnote" tone="tertiary">
            {procedureLabel}
          </Text>
        </View>
        <Badge
          tone={item.blocked ? "danger" : "warning"}
          icon={item.blocked ? CircleAlert : Clock}
          label={
            item.blocked ? t("outboxStatusBlocked") : t("outboxStatusWaiting")
          }
        />
      </View>

      {errorExplanation ? (
        <Text variant="footnote" tone="danger">
          {errorExplanation}
        </Text>
      ) : null}

      <View style={styles.outboxActions}>
        {item.errorReason !== "stale_report" ? (
          <Button
            label={t("outboxRetryAction")}
            variant="secondary"
            size="sm"
            onPress={onRetry}
            testID={`outbox-retry-${item.requestId}`}
          />
        ) : null}
        <Button
          label={t("outboxRemoveAction")}
          variant="destructive"
          size="sm"
          onPress={onRemove}
          testID={`outbox-remove-${item.requestId}`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: space.md,
    gap: space.lg,
    paddingBottom: space.xxl + space.xl,
  },
  heroCard: {
    gap: space.md,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  progressBox: {
    gap: space.xs + 2,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: space.sm,
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: radius.pill,
  },
  noticeCard: {
    gap: space.sm + 2,
  },
  noticeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  outboxItem: {
    padding: space.md,
    gap: space.sm,
  },
  outboxHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: space.sm,
  },
  outboxText: {
    flex: 1,
    gap: 2,
  },
  outboxActions: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.xxs,
  },
});
