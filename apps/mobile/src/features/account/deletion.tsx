import { ORPCError } from "@orpc/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useFocusEffect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
  Building2,
  CheckCircle2,
  CircleAlert,
  Clock,
  ShieldAlert,
  Trash2,
  UserRoundX,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useTranslations } from "use-intl";
import { signOutLocally, useMe } from "@/features/auth/session";
import { clearOutboxForUser } from "@/features/offline/outbox";
import { api, orpc } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { requestId } from "@/lib/ids";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { Icon } from "@/ui/icon";
import { haptic } from "@/ui/pressable";
import { EmptyState, Skeleton } from "@/ui/states";
import { Card } from "@/ui/surfaces";
import { Badge } from "@/ui/tags";
import { Text } from "@/ui/text";
import { radius, space, useTheme } from "@/ui/theme";

/** Maximum session age accepted by `me.requestDeletion` on the server. */
export const FRESH_SESSION_MS = 5 * 60_000;

/**
 * Keychain slot where the deletion receipt UUID is written BEFORE sending
 * `me.requestDeletion`, so a lost acknowledgement or revoked session never
 * loses the receipt needed to poll `me.deletionStatus`.
 */
export const DELETION_RECEIPT_KEY = "account.deletion-receipt";

/**
 * Private device storage keys written by Better Auth and native push.
 * Public offline database keys are intentionally excluded so downloaded
 * provincial snapshots remain usable when signed out.
 */
export const PRIVATE_SECURE_STORE_KEYS = [
  "rutacibao_cookie",
  "rutacibao_session_data",
  "rutacibao_last_login_method",
  "notifications.installation-id",
  "notifications.contribution-prompted",
  "auth.last-viewer",
] as const;

const CHUNK_PREFIX = "ba-chunks:";

const REASONS = [
  "recent_authentication_required",
  "last_administrator",
  "rate_limited",
  "not_found",
] as const;

export type DeletionErrorKey = (typeof REASONS)[number] | "generic";

export function deletionErrorKey(error: unknown): DeletionErrorKey {
  if (!(error instanceof ORPCError)) return "generic";
  const reason = (error.data as { reason?: unknown } | undefined)?.reason;
  const matched = REASONS.find((known) => known === reason);
  if (matched) return matched;
  if (error.code === "TOO_MANY_REQUESTS") return "rate_limited";
  if (error.code === "NOT_FOUND") return "not_found";
  return "generic";
}

export function isSessionFresh(
  createdAt: Date | string | null | undefined,
  now = Date.now(),
): boolean {
  if (!createdAt) return false;
  const timestamp =
    createdAt instanceof Date
      ? createdAt.getTime()
      : new Date(createdAt).getTime();
  return Number.isFinite(timestamp) && now - timestamp <= FRESH_SESSION_MS;
}

export function matchesConfirmationWord(
  typed: string,
  expected: string,
): boolean {
  const cleanExpected = expected.trim().toLocaleUpperCase("es-DO");
  if (!cleanExpected) return false;
  return typed.trim().toLocaleUpperCase("es-DO") === cleanExpected;
}

export async function saveDeletionReceipt(receiptId: string): Promise<void> {
  await SecureStore.setItemAsync(DELETION_RECEIPT_KEY, receiptId);
}

export async function readDeletionReceipt(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(DELETION_RECEIPT_KEY);
  } catch {
    return null;
  }
}

export async function clearDeletionReceipt(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(DELETION_RECEIPT_KEY);
  } catch {
    // expected: keychain cleanup is best effort.
  }
}

async function deleteSecureStoreKeyAndChunks(key: string): Promise<void> {
  try {
    const raw = await SecureStore.getItemAsync(key);
    if (raw?.startsWith(CHUNK_PREFIX)) {
      const count = Number(raw.slice(CHUNK_PREFIX.length));
      if (Number.isInteger(count) && count > 0 && count <= 32) {
        for (let i = 0; i < count; i += 1) {
          await SecureStore.deleteItemAsync(`${key}.${i}`).catch(
            () => undefined,
          );
        }
      }
    }
    await SecureStore.deleteItemAsync(key);
  } catch {
    // expected: keychain entries may already be absent.
  }
}

/**
 * Removes what belongs to the account: session and push keys from the keychain,
 * and queued contribution payloads from the encrypted outbox. The public
 * offline snapshot is not private and stays.
 */
export async function clearPrivateStorage(): Promise<void> {
  await Promise.all([
    ...PRIVATE_SECURE_STORE_KEYS.map((key) =>
      deleteSecureStoreKeyAndChunks(key),
    ),
    clearOutboxForUser(),
  ]);
}

type ActiveReceipt = {
  deletionId: string;
  status: "pending" | "completed";
};

export function DeleteAccountScreen() {
  const t = useTranslations("accountDeletion");
  const tc = useTranslations("common");
  const ta = useTranslations("account");
  const delErrors = useTranslations("errors.deletion");
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { me, signedIn, isPending: mePending } = useMe();
  const session = authClient.useSession();

  const [receipt, setReceipt] = useState<ActiveReceipt | null>(null);
  const [checkingReceipt, setCheckingReceipt] = useState(true);
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<DeletionErrorKey | null>(null);

  const pendingRequestIdRef = useRef<string | null>(null);
  const awaitingReauthUserIdRef = useRef<string | null>(null);
  const runningRef = useRef(false);

  const confirmWord = t("confirmWord");
  const confirmed = matchesConfirmationWord(confirmText, confirmWord);
  const sessionFresh = isSessionFresh(session.data?.session.createdAt);

  // Restore an in-flight receipt if the previous request lost its acknowledgement.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const savedId = await readDeletionReceipt();
      if (!savedId) {
        if (!cancelled) setCheckingReceipt(false);
        return;
      }
      try {
        const res = await api.me.deletionStatus({ deletionId: savedId });
        if (cancelled) return;
        setReceipt({ deletionId: savedId, status: res.status });
        await signOutLocally(queryClient);
        await clearPrivateStorage();
        if (res.status === "completed") {
          await clearDeletionReceipt();
        }
      } catch (error) {
        if (deletionErrorKey(error) === "not_found") {
          await clearDeletionReceipt();
        }
      } finally {
        if (!cancelled) setCheckingReceipt(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  const statusQuery = useQuery({
    ...orpc.me.deletionStatus.queryOptions({
      input: { deletionId: receipt?.deletionId ?? "" },
    }),
    enabled: Boolean(receipt?.deletionId),
    refetchInterval: (query) =>
      query.state.data?.status === "completed" ||
      receipt?.status === "completed"
        ? false
        : 2000,
  });

  const currentStatus =
    statusQuery.data?.status ?? receipt?.status ?? "pending";

  useEffect(() => {
    if (receipt && currentStatus === "completed") {
      void clearDeletionReceipt();
    }
  }, [receipt, currentStatus]);

  const executeDeletion = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setSubmitting(true);
    setErrorKey(null);

    const id = pendingRequestIdRef.current ?? requestId();
    pendingRequestIdRef.current = id;

    try {
      // Persist the receipt UUID before sending so a dropped response after
      // session revocation still leaves the status receipt on the device.
      await saveDeletionReceipt(id);
      const out = await api.me.requestDeletion({ requestId: id });
      await saveDeletionReceipt(out.deletionId).catch(() => undefined); // expected: the receipt is already in memory for this session.
      setReceipt({ deletionId: out.deletionId, status: out.status });
      await signOutLocally(queryClient);
      await clearPrivateStorage();
      haptic("success");
    } catch (error) {
      const key = deletionErrorKey(error);
      if (key === "recent_authentication_required") {
        await clearDeletionReceipt();
        setErrorKey("recent_authentication_required");
        awaitingReauthUserIdRef.current =
          me?.userId ?? session.data?.user.id ?? null;
        router.push("/sign-in");
      } else if (key === "last_administrator") {
        await clearDeletionReceipt();
        haptic("medium");
        setErrorKey("last_administrator");
      } else {
        // Check if the server committed the deletion before the connection failed.
        const recovered = await api.me
          .deletionStatus({ deletionId: id })
          .catch(() => null);
        if (recovered) {
          setReceipt({ deletionId: id, status: recovered.status });
          await signOutLocally(queryClient);
          await clearPrivateStorage();
          if (recovered.status === "completed") {
            await clearDeletionReceipt();
          }
          return;
        }
        haptic("medium");
        setErrorKey(key);
      }
    } finally {
      runningRef.current = false;
      setSubmitting(false);
    }
  }, [me?.userId, queryClient, session.data?.user.id]);

  // Resume deletion automatically once `/sign-in` re-verifies the same account.
  const checkReauthAndResume = useCallback(async () => {
    const expectedUserId = awaitingReauthUserIdRef.current;
    if (!expectedUserId || runningRef.current) return;
    const latest = await authClient.getSession().catch(() => null);
    const latestSession = latest?.data?.session;
    const latestUser = latest?.data?.user;
    if (
      latestUser?.id === expectedUserId &&
      isSessionFresh(latestSession?.createdAt)
    ) {
      awaitingReauthUserIdRef.current = null;
      await executeDeletion();
    }
  }, [executeDeletion]);

  useFocusEffect(
    useCallback(() => {
      void checkReauthAndResume();
    }, [checkReauthAndResume]),
  );

  useEffect(() => {
    if (
      awaitingReauthUserIdRef.current &&
      session.data?.user.id === awaitingReauthUserIdRef.current &&
      isSessionFresh(session.data.session.createdAt)
    ) {
      awaitingReauthUserIdRef.current = null;
      void executeDeletion();
    }
  }, [executeDeletion, session.data?.session.createdAt, session.data?.user.id]);

  const handleSubmit = async () => {
    if (!confirmed || submitting) return;
    setErrorKey(null);
    const latest = await authClient.getSession().catch(() => null);
    const createdAt =
      latest?.data?.session?.createdAt ?? session.data?.session.createdAt;
    if (!isSessionFresh(createdAt)) {
      awaitingReauthUserIdRef.current =
        latest?.data?.user?.id ?? me?.userId ?? session.data?.user.id ?? null;
      router.push("/sign-in");
      return;
    }
    await executeDeletion();
  };

  const errorMessage =
    errorKey === "recent_authentication_required"
      ? delErrors("recent_authentication_required")
      : errorKey === "last_administrator"
        ? delErrors("last_administrator")
        : errorKey === "rate_limited"
          ? delErrors("rate_limited")
          : errorKey === "not_found"
            ? delErrors("not_found")
            : errorKey === "generic"
              ? tc("errorBody")
              : null;

  return (
    <>
      <Stack.Screen
        options={{ title: t("title"), headerLargeTitleEnabled: false }}
      />
      {receipt ? (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ backgroundColor: colors.grouped }}
          contentContainerStyle={styles.content}
        >
          <View
            style={styles.completionHeader}
            accessible
            accessibilityRole="summary"
            testID="delete-account-completion"
          >
            <View
              style={[
                styles.statusIconWrap,
                {
                  backgroundColor:
                    currentStatus === "completed"
                      ? colors.successSoft
                      : colors.accentSoft,
                },
              ]}
            >
              <Icon
                as={currentStatus === "completed" ? CheckCircle2 : Clock}
                size={28}
                color={currentStatus === "completed" ? "successInk" : "accent"}
              />
            </View>
            <Text variant="title2" align="center">
              {currentStatus === "completed"
                ? t("receiptTitleCompleted")
                : t("receiptTitlePending")}
            </Text>
            <Text tone="secondary" align="center" style={styles.body}>
              {currentStatus === "completed"
                ? t("receiptBodyCompleted")
                : t("receiptBodyPending")}
            </Text>
          </View>

          <Card
            style={[styles.receiptCard, { backgroundColor: colors.groupedRow }]}
            testID="delete-account-receipt-card"
          >
            <View style={styles.receiptRow}>
              <Text variant="subhead" weight="600" tone="secondary">
                {t("receiptLabel")}
              </Text>
              <Badge
                label={
                  currentStatus === "completed"
                    ? t("statusCompleted")
                    : t("statusPending")
                }
                tone={currentStatus === "completed" ? "success" : "neutral"}
                icon={currentStatus === "completed" ? CheckCircle2 : Clock}
              />
            </View>
            <Text
              variant="footnote"
              tone="secondary"
              tabular
              selectable
              testID="delete-account-receipt-id"
            >
              {receipt.deletionId}
            </Text>
          </Card>

          <View style={styles.actions}>
            {currentStatus !== "completed" ? (
              <Button
                label={t("checkStatusAction")}
                variant="secondary"
                size="md"
                loading={statusQuery.isFetching}
                onPress={() => void statusQuery.refetch()}
                testID="delete-account-refresh-status"
                block
              />
            ) : null}
            <Button
              label={t("backToAccountAction")}
              variant="primary"
              onPress={() => router.replace("/account")}
              testID="delete-account-done"
              block
            />
          </View>
        </ScrollView>
      ) : checkingReceipt || mePending ? (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ backgroundColor: colors.grouped }}
          contentContainerStyle={styles.content}
        >
          <Skeleton height={88} rounded={radius.card} />
          <Skeleton height={160} rounded={radius.card} />
          <Skeleton height={160} rounded={radius.card} />
        </ScrollView>
      ) : !signedIn ? (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ backgroundColor: colors.grouped }}
          contentContainerStyle={styles.content}
        >
          <EmptyState
            icon={UserRoundX}
            title={t("signedOutTitle")}
            body={t("signedOutBody")}
            action={{
              label: ta("signIn"),
              onPress: () => router.push("/sign-in"),
            }}
          />
        </ScrollView>
      ) : (
        <KeyboardAwareScrollView
          bottomOffset={32}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          style={{ backgroundColor: colors.grouped }}
          contentContainerStyle={styles.content}
        >
          <Text tone="secondary" style={styles.body}>
            {t("lede")}
          </Text>

          <Card style={[styles.card, { backgroundColor: colors.groupedRow }]}>
            <View style={styles.cardHeader}>
              <Icon as={Trash2} size={18} color="danger" />
              <Text variant="headline">{t("deletedTitle")}</Text>
            </View>
            <Text variant="subhead" tone="secondary" style={styles.body}>
              • {t("deletedAccount")}
            </Text>
            <Text variant="subhead" tone="secondary" style={styles.body}>
              • {t("deletedContributions")}
            </Text>
            <Text variant="subhead" tone="secondary" style={styles.body}>
              • {t("deletedDevice")}
            </Text>
          </Card>

          <Card style={[styles.card, { backgroundColor: colors.groupedRow }]}>
            <View style={styles.cardHeader}>
              <Icon as={Building2} size={18} color="textSecondary" />
              <Text variant="headline">{t("keptTitle")}</Text>
            </View>
            <Text variant="subhead" tone="secondary" style={styles.body}>
              • {t("keptResponses")}
            </Text>
            <Text variant="subhead" tone="secondary" style={styles.body}>
              • {t("keptDirectory")}
            </Text>
            <Text variant="subhead" tone="secondary" style={styles.body}>
              • {t("keptAudit")}
            </Text>
            <Text variant="footnote" tone="tertiary" style={styles.body}>
              {t("offlineNote")}
            </Text>
          </Card>

          {!sessionFresh ? (
            <Card
              style={[styles.card, { backgroundColor: colors.groupedRow }]}
              testID="delete-account-reauth-notice"
            >
              <View style={styles.cardHeader}>
                <Icon as={ShieldAlert} size={18} color="warningInk" />
                <Text variant="headline">{t("reauthNoticeTitle")}</Text>
              </View>
              <Text variant="subhead" tone="secondary" style={styles.body}>
                {t("reauthNoticeBody")}
              </Text>
            </Card>
          ) : null}

          {errorMessage ? (
            <View
              accessible
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
              testID="delete-account-error"
              style={[
                styles.errorBanner,
                {
                  backgroundColor: colors.dangerSoft,
                  borderColor: colors.danger,
                },
              ]}
            >
              <Icon as={CircleAlert} size={20} color="dangerInk" />
              <View style={styles.errorTextWrap}>
                {errorKey === "last_administrator" ? (
                  <Text variant="subhead" weight="600" tone="danger">
                    {t("lastAdminTitle")}
                  </Text>
                ) : null}
                <Text variant="subhead" tone="danger" style={styles.body}>
                  {errorMessage}
                </Text>
              </View>
            </View>
          ) : null}

          <Field
            testID="delete-account-confirm-input"
            label={t("confirmLabel", { word: confirmWord })}
            helper={t("confirmHelper")}
            placeholder={confirmWord}
            value={confirmText}
            onChangeText={(next) => {
              setConfirmText(next);
              if (errorKey) setErrorKey(null);
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => void handleSubmit()}
          />

          <Button
            testID="delete-account-submit"
            label={
              sessionFresh ? t("submitAction") : t("reauthAndSubmitAction")
            }
            variant="destructive"
            icon={Trash2}
            loading={submitting}
            disabled={!confirmed || submitting}
            onPress={() => void handleSubmit()}
            block
          />
        </KeyboardAwareScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: space.md,
    gap: space.md,
    paddingBottom: space.xxl + space.xl,
  },
  card: {
    gap: space.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  body: {
    lineHeight: 21,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  errorTextWrap: {
    flex: 1,
    gap: space.xxs,
  },
  completionHeader: {
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.lg,
  },
  statusIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  receiptCard: {
    gap: space.sm,
  },
  receiptRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  actions: {
    gap: space.sm,
    paddingTop: space.sm,
  },
});
