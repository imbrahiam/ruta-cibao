import { renderNotification } from "@ruta/shared/open-keys";
import { FlashList } from "@shopify/flash-list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import {
  Bell,
  CircleCheck,
  CircleDot,
  CircleX,
  Clock,
  Inbox,
  type LucideIcon,
  Plus,
  Sparkles,
  WifiOff,
} from "lucide-react-native";
import { useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { useMe } from "@/features/auth/session";
import { isNetworkError } from "@/features/offline/fallback";
import { useOutbox } from "@/features/offline/outbox";
import { useAgo } from "@/i18n/ago";
import { orpc } from "@/lib/api";
import { canOpenTarget, openTarget } from "@/lib/targets";
import { BrandMark } from "@/ui/brand";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { ListRow, ListSection } from "@/ui/list";
import { PressableScale } from "@/ui/pressable";
import { Segmented } from "@/ui/segmented";
import { EmptyState, Skeleton } from "@/ui/states";
import { Card, IconButton } from "@/ui/surfaces";
import { Badge, type BadgeTone } from "@/ui/tags";
import { Text } from "@/ui/text";
import { radius, space, useTheme } from "@/ui/theme";
import { useToast } from "@/ui/toast";

type Status =
  | "draft"
  | "pending"
  | "published"
  | "rejected"
  | "archived"
  | "resolved"
  | "dismissed"
  | "active"
  | "cleared"
  | "expired"
  | "removed"
  | "open"
  | "in_review"
  | "answered"
  | "approved";

const STATUS: Record<Status, { tone: BadgeTone; icon: LucideIcon }> = {
  draft: { tone: "neutral", icon: CircleDot },
  pending: { tone: "warning", icon: Clock },
  in_review: { tone: "warning", icon: Clock },
  open: { tone: "neutral", icon: CircleDot },
  published: { tone: "success", icon: CircleCheck },
  approved: { tone: "success", icon: CircleCheck },
  active: { tone: "success", icon: CircleCheck },
  answered: { tone: "accent", icon: CircleCheck },
  resolved: { tone: "success", icon: CircleCheck },
  cleared: { tone: "neutral", icon: CircleCheck },
  expired: { tone: "neutral", icon: Clock },
  archived: { tone: "neutral", icon: CircleDot },
  rejected: { tone: "danger", icon: CircleX },
  dismissed: { tone: "danger", icon: CircleX },
  removed: { tone: "danger", icon: CircleX },
};

export default function ContributionsScreen() {
  const t = useTranslations("contributions");
  const { colors } = useTheme();
  const { signedIn, isPending } = useMe();
  const [view, setView] = useState<"mine" | "inbox">("mine");

  if (!isPending && !signedIn) {
    return (
      <View style={[styles.signedOut, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: t("title") }} />
        <BrandMark size={64} />
        <Text variant="title2" align="center">
          {t("signedOutTitle")}
        </Text>
        <Text tone="secondary" align="center">
          {t("signedOutBody")}
        </Text>
        <Button
          label={t("signIn")}
          onPress={() => router.push("/sign-in")}
          testID="contributions-sign-in"
        />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t("title"),
          headerRight: () => (
            <IconButton
              icon={Plus}
              label={t("contribute")}
              variant="filled"
              size={36}
              onPress={() => router.push("/contribute")}
              testID="contribute-open"
            />
          ),
        }}
      />
      {view === "mine" ? (
        <MyContributions header={<Switcher view={view} onChange={setView} />} />
      ) : (
        <InboxList header={<Switcher view={view} onChange={setView} />} />
      )}
    </>
  );
}

function Switcher({
  view,
  onChange,
}: {
  view: "mine" | "inbox";
  onChange: (v: "mine" | "inbox") => void;
}) {
  const t = useTranslations("contributions");
  const unread = useQuery(
    orpc.notifications.list.queryOptions({ input: { limit: 50 } }),
  );
  const count = unread.data?.unread ?? 0;
  return (
    <View style={styles.switcher}>
      <Segmented
        accessibilityLabel={t("title")}
        value={view}
        onChange={onChange}
        options={[
          { value: "mine", label: t("mine") },
          {
            value: "inbox",
            label: count > 0 ? t("inboxCount", { count }) : t("inbox"),
          },
        ]}
      />
    </View>
  );
}

function MyContributions({ header }: { header: React.ReactElement }) {
  const t = useTranslations("contributions");
  const tc = useTranslations("common");
  const ts = useTranslations("safety");
  const { colors } = useTheme();
  const ago = useAgo();
  const list = useQuery(orpc.places.contributions.queryOptions());

  return (
    <FlashList
      data={list.data ?? []}
      keyExtractor={(item) => `${item.kind}-${item.id}`}
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <>
          {header}
          <QueuedContributions />
        </>
      }
      ItemSeparatorComponent={() => <View style={styles.gap} />}
      refreshControl={
        <RefreshControl
          refreshing={list.isRefetching}
          onRefresh={() => void list.refetch()}
          tintColor={colors.accent}
        />
      }
      ListEmptyComponent={
        list.isPending ? (
          <View style={styles.gapList}>
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} height={96} rounded={radius.card} />
            ))}
          </View>
        ) : list.isError ? (
          isNetworkError(list.error) ? (
            <EmptyState
              icon={WifiOff}
              title={tc("offline")}
              body={tc("offlineBody")}
              action={{
                label: tc("retry"),
                onPress: () => void list.refetch(),
              }}
            />
          ) : (
            <EmptyState
              icon={Inbox}
              tone="danger"
              title={tc("errorTitle")}
              body={tc("errorBody")}
              action={{
                label: tc("retry"),
                onPress: () => void list.refetch(),
              }}
            />
          )
        ) : (
          <EmptyState
            icon={Sparkles}
            title={t("empty")}
            body={t("emptyBody")}
            action={{
              label: t("contribute"),
              onPress: () => router.push("/contribute"),
            }}
          />
        )
      }
      renderItem={({ item }) => {
        const status = STATUS[item.status];
        const href = item.href;
        return (
          <Card
            onPress={canOpenTarget(href) ? () => openTarget(href) : undefined}
            accessibilityLabel={`${t(`kind.${item.kind}`)}: ${item.name}. ${t(`status.${item.status}`)}`}
            style={styles.card}
          >
            <View style={styles.row}>
              <Text
                variant="footnote"
                tone="tertiary"
                uppercase
                style={styles.flex}
              >
                {t(`kind.${item.kind}`)} · {ago(item.createdAt)}
              </Text>
              <Badge
                label={t(`status.${item.status}`)}
                tone={status.tone}
                icon={status.icon}
              />
            </View>
            <Text variant="headline" numberOfLines={2}>
              {item.name}
            </Text>
            {item.publication && item.publication !== "published" ? (
              item.kind === "consultation" ? (
                <View style={styles.row}>
                  <Badge
                    label={ts(`publication.${item.publication}`)}
                    tone="warning"
                    icon={Clock}
                  />
                  <Text
                    variant="footnote"
                    tone="tertiary"
                    style={styles.flex}
                    numberOfLines={2}
                  >
                    {item.publication === "pending"
                      ? ts("publication.pendingCase")
                      : ts("publication.hiddenCase")}
                  </Text>
                </View>
              ) : item.kind === "traffic" ? (
                <Text variant="footnote" tone="tertiary">
                  {item.publication === "pending"
                    ? ts("publication.pendingText")
                    : ts("publication.hiddenText")}
                </Text>
              ) : null
            ) : null}
            {item.note ? (
              <View style={[styles.note, { backgroundColor: colors.inset }]}>
                <Text variant="footnote" tone="tertiary" weight="600">
                  {t("note")}
                </Text>
                <Text variant="subhead" tone="secondary">
                  {item.note}
                </Text>
              </View>
            ) : null}
          </Card>
        );
      }}
    />
  );
}

function QueuedContributions() {
  const t = useTranslations("offline");
  const tc = useTranslations("common");
  const outbox = useOutbox();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const act = async (id: string, action: "retry" | "remove") => {
    setBusy(id);
    try {
      if (action === "retry") await outbox.retry(id);
      else await outbox.remove(id);
    } catch {
      toast.show({
        title: tc("errorTitle"),
        body: tc("errorBody"),
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  };
  if (outbox.items.length === 0) return null;
  return (
    <ListSection title={t("outboxSection")}>
      {outbox.items.map((item) => {
        const reason = item.errorReason;
        const explanation =
          reason === "stale_report" ||
          reason === "duplicate" ||
          reason === "municipality_mismatch" ||
          reason === "outside_province" ||
          reason === "invalid_street" ||
          reason === "unauthenticated"
            ? t(`outboxErrors.${reason}`)
            : item.blocked
              ? t("outboxErrors.generic")
              : null;
        return (
          <View key={item.requestId}>
            <ListRow
              title={item.title}
              subtitle={[
                item.blocked
                  ? t("outboxStatusBlocked")
                  : t("outboxStatusWaiting"),
                explanation,
              ]
                .filter(Boolean)
                .join(". ")}
              icon={item.blocked ? CircleX : Clock}
            />
            {reason !== "stale_report" ? (
              <ListRow
                title={t("outboxRetryAction")}
                onPress={
                  busy || outbox.flushing
                    ? undefined
                    : () => void act(item.requestId, "retry")
                }
              />
            ) : null}
            <ListRow
              title={t("outboxRemoveAction")}
              destructive
              onPress={
                busy || outbox.flushing
                  ? undefined
                  : () => void act(item.requestId, "remove")
              }
            />
          </View>
        );
      })}
    </ListSection>
  );
}

function InboxList({ header }: { header: React.ReactElement }) {
  const t = useTranslations("contributions");
  const tc = useTranslations("common");
  const root = useTranslations();
  const { colors } = useTheme();
  const ago = useAgo();
  const queryClient = useQueryClient();
  const list = useQuery(
    orpc.notifications.list.queryOptions({ input: { limit: 50 } }),
  );
  const markRead = useMutation(
    orpc.notifications.markRead.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: orpc.notifications.list.key(),
        }),
    }),
  );

  return (
    <FlashList
      data={list.data?.items ?? []}
      keyExtractor={(item) => item.id}
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View>
          {header}
          {(list.data?.unread ?? 0) > 0 ? (
            <View style={styles.markAll}>
              <Button
                label={t("markAll")}
                variant="tertiary"
                size="sm"
                onPress={() => markRead.mutate({})}
              />
            </View>
          ) : null}
        </View>
      }
      refreshControl={
        <RefreshControl
          refreshing={list.isRefetching}
          onRefresh={() => void list.refetch()}
          tintColor={colors.accent}
        />
      }
      ListEmptyComponent={
        list.isPending ? null : list.isError ? (
          <EmptyState
            icon={Bell}
            tone="danger"
            title={tc("errorTitle")}
            action={{ label: tc("retry"), onPress: () => void list.refetch() }}
          />
        ) : (
          <EmptyState
            icon={Bell}
            title={t("inboxEmpty")}
            body={t("inboxEmptyBody")}
          />
        )
      }
      renderItem={({ item }) => {
        const unread = !item.readAt;
        return (
          <PressableScale
            onPress={() => {
              if (unread) markRead.mutate({ id: item.id });
              openTarget(item.href);
            }}
            scaleTo={0.985}
            accessibilityRole="button"
            accessibilityState={{ selected: unread }}
            style={styles.notice}
          >
            <View
              style={[
                styles.dot,
                { backgroundColor: unread ? colors.accent : "transparent" },
              ]}
            />
            <View style={styles.flex}>
              <Text weight={unread ? "600" : "400"}>
                {renderNotification(root, item.messageKey, item.params)}
              </Text>
              <Text variant="footnote" tone="tertiary">
                {ago(item.createdAt)}
              </Text>
            </View>
            <Icon as={Bell} size={16} color="textDisabled" />
          </PressableScale>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  signedOut: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
    padding: space.xl,
  },
  list: { paddingHorizontal: space.md, paddingBottom: space.xxl + space.xl },
  switcher: { paddingVertical: space.md },
  gap: { height: space.sm + 4 },
  gapList: { gap: space.sm + 4 },
  flex: { flex: 1 },
  card: { gap: space.sm },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  note: { borderRadius: radius.sm, padding: space.sm + 2, gap: 2 },
  markAll: {
    alignItems: "flex-end",
    marginTop: -space.sm,
    marginBottom: space.xs,
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md - 4,
    paddingVertical: space.md - 2,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
