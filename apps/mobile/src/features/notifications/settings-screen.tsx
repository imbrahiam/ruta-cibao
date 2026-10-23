import type { ApiOutputs } from "@ruta/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import {
  Bell,
  Mail,
  MessageCircle,
  Settings,
  TrafficCone,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { useTranslations } from "use-intl";
import { useMe } from "@/features/auth/session";
import { useBoundaries } from "@/features/map/data";
import { orpc } from "@/lib/api";
import { requestId } from "@/lib/ids";
import { Button } from "@/ui/button";
import { ListRow, type ListRowProps, ListSection } from "@/ui/list";
import { EmptyState, Skeleton } from "@/ui/states";
import { Chip } from "@/ui/tags";
import { Text } from "@/ui/text";
import { space, useTheme } from "@/ui/theme";
import { useToast } from "@/ui/toast";
import { permissionGranted, registerPush } from "./push";

type Preferences = ApiOutputs["notifications"]["getPreferences"];
type ToggleKey = "caseUpdatesEnabled" | "trafficEnabled" | "emailEnabled";
type Permission = "granted" | "denied" | "undetermined" | "unknown";

function ToggleRow({
  title,
  subtitle,
  icon,
  value,
  disabled,
  onChange,
  testID,
}: Pick<ListRowProps, "title" | "subtitle" | "icon"> & {
  testID: string;
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  const { colors } = useTheme();
  // The visual row is hidden from assistive tech: the Switch carries the same
  // label/hint and is the single focusable, operable element.
  return (
    <View style={styles.toggleRow}>
      <View
        style={styles.rowLabel}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <ListRow title={title} subtitle={subtitle} icon={icon} />
      </View>
      <View style={styles.switchTarget}>
        <Switch
          testID={testID}
          accessibilityLabel={title}
          accessibilityHint={subtitle}
          value={value}
          disabled={disabled}
          onValueChange={onChange}
          trackColor={{ false: colors.fill, true: colors.accent }}
        />
      </View>
    </View>
  );
}

export default function NotificationSettingsScreen() {
  const t = useTranslations("notificationSettings");
  const { colors } = useTheme();
  const toast = useToast();
  const { signedIn, isPending: sessionPending } = useMe();
  const queryClient = useQueryClient();
  const options = orpc.notifications.getPreferences.queryOptions();
  const preferences = useQuery({ ...options, enabled: signedIn });
  const boundaries = useBoundaries();
  const categories = useQuery(orpc.traffic.categories.queryOptions());
  const [permission, setPermission] = useState<Permission>("unknown");
  const changing = useRef(false);

  const refreshPermission = useCallback(async () => {
    try {
      const result = await Notifications.getPermissionsAsync();
      setPermission(
        permissionGranted(result)
          ? "granted"
          : result.status === "undetermined"
            ? "undetermined"
            : "denied",
      );
    } catch {
      setPermission("unknown");
    }
  }, []);

  useEffect(() => {
    void refreshPermission();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshPermission();
        if (signedIn) void registerPush();
      }
    });
    if (signedIn) void registerPush();
    return () => subscription.remove();
  }, [refreshPermission, signedIn]);

  const mutation = useMutation({
    ...orpc.notifications.setPreferences.mutationOptions(),
    retry: false,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: options.queryKey });
      const previous = queryClient.getQueryData<Preferences>(options.queryKey);
      const { requestId: _id, ...next } = input;
      queryClient.setQueryData(options.queryKey, next);
      return { previous };
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(options.queryKey, saved);
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(options.queryKey, context.previous);
      }
      toast.show({ title: t("saveFailed"), tone: "error" });
    },
    onSettled: () => {
      changing.current = false;
    },
  });

  const save = (next: Preferences, askPermission = false) => {
    if (changing.current) return;
    changing.current = true;
    mutation.mutate(
      { ...next, requestId: requestId() },
      {
        onSuccess: () => {
          if (askPermission) {
            void registerPush(true).finally(refreshPermission);
          }
        },
      },
    );
  };

  const data = preferences.data;
  const toggle = (key: ToggleKey, enabled: boolean) => {
    if (data)
      save({ ...data, [key]: enabled }, enabled && key !== "emailEnabled");
  };
  const toggleSelection = (
    key: "municipalityIds" | "categoryIds",
    id: string,
  ) => {
    if (!data || changing.current) return;
    const selected = data[key].includes(id);
    if (!selected && key === "municipalityIds" && data[key].length >= 3) {
      toast.show({ title: t("municipalityLimit"), tone: "info" });
      return;
    }
    save({
      ...data,
      [key]: selected
        ? data[key].filter((item) => item !== id)
        : [...data[key], id],
    });
  };
  const permissionLabel = {
    granted: t("permissionGranted"),
    denied: t("permissionDenied"),
    undetermined: t("permissionUndetermined"),
    unknown: t("permissionUnknown"),
  }[permission];

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      testID="notification-settings"
    >
      <Stack.Screen
        options={{ title: t("title"), headerLargeTitleEnabled: false }}
      />
      {sessionPending || (signedIn && preferences.isPending) ? (
        <View style={styles.loading}>
          <Skeleton width="100%" height={100} />
          <Skeleton width="100%" height={150} />
        </View>
      ) : !signedIn ? (
        <EmptyState
          icon={Bell}
          title={t("signInTitle")}
          body={t("signInBody")}
          action={{
            label: t("signIn"),
            onPress: () => router.push("/sign-in"),
          }}
        />
      ) : !data ? (
        <EmptyState
          icon={Bell}
          tone="danger"
          title={t("loadFailed")}
          action={{
            label: t("retry"),
            onPress: () => void preferences.refetch(),
          }}
        />
      ) : (
        <>
          <Text tone="secondary" style={styles.intro}>
            {t("intro")}
          </Text>
          <ListSection title={t("activity")}>
            <ToggleRow
              title={t("caseUpdates")}
              subtitle={t("caseHint")}
              icon={MessageCircle}
              value={data.caseUpdatesEnabled}
              disabled={mutation.isPending}
              onChange={(value) => toggle("caseUpdatesEnabled", value)}
              testID="notifications-case"
            />
          </ListSection>
          <ListSection
            footer={data.trafficEnabled ? t("municipalitiesHint") : undefined}
          >
            <ToggleRow
              title={t("traffic")}
              subtitle={t("trafficHint")}
              icon={TrafficCone}
              value={data.trafficEnabled}
              disabled={mutation.isPending}
              onChange={(value) => toggle("trafficEnabled", value)}
              testID="notifications-traffic"
            />
            {data.trafficEnabled ? (
              <View style={styles.filters}>
                <Text variant="subhead" weight="600" accessibilityRole="header">
                  {t("municipalities")}
                </Text>
                {boundaries.isPending ? (
                  <Skeleton width="100%" height={48} />
                ) : boundaries.isError || !boundaries.data?.features.length ? (
                  <Button
                    label={t("retry")}
                    variant="tertiary"
                    onPress={() => void boundaries.refetch()}
                    accessibilityHint={t("filtersFailed")}
                  />
                ) : (
                  <View style={styles.chips}>
                    {boundaries.data.features.map(({ properties }) => (
                      <Chip
                        key={properties.id}
                        label={properties.name}
                        selected={data.municipalityIds.includes(properties.id)}
                        onPress={() =>
                          toggleSelection("municipalityIds", properties.id)
                        }
                        testID={`notifications-municipality-${properties.id}`}
                      />
                    ))}
                  </View>
                )}
                <Text variant="subhead" weight="600" accessibilityRole="header">
                  {t("categories")}
                </Text>
                <Text variant="footnote" tone="secondary">
                  {t("categoriesHint")}
                </Text>
                {categories.isPending ? (
                  <Skeleton width="100%" height={48} />
                ) : categories.isError ? (
                  <Button
                    label={t("retry")}
                    variant="tertiary"
                    onPress={() => void categories.refetch()}
                    accessibilityHint={t("filtersFailed")}
                  />
                ) : (
                  <View style={styles.chips}>
                    <Chip
                      label={t("allCategories")}
                      selected={data.categoryIds.length === 0}
                      onPress={() => save({ ...data, categoryIds: [] })}
                      testID="notifications-categories-all"
                    />
                    {categories.data?.map((category) => (
                      <Chip
                        key={category.id}
                        label={category.name}
                        selected={data.categoryIds.includes(category.id)}
                        onPress={() =>
                          toggleSelection("categoryIds", category.id)
                        }
                        testID={`notifications-category-${category.id}`}
                      />
                    ))}
                  </View>
                )}
              </View>
            ) : null}
          </ListSection>
          <ListSection>
            <ToggleRow
              title={t("email")}
              subtitle={t("emailHint")}
              icon={Mail}
              value={data.emailEnabled}
              disabled={mutation.isPending}
              onChange={(value) => toggle("emailEnabled", value)}
              testID="notifications-email"
            />
          </ListSection>
          <ListSection title={t("device")} footer={t("permissionHint")}>
            <ListRow
              title={t("permission")}
              subtitle={permissionLabel}
              icon={Settings}
              testID="notifications-permission"
            />
            {permission === "denied" ? (
              <ListRow
                title={t("openSettings")}
                onPress={() => {
                  void Linking.openSettings().catch(() => {
                    toast.show({ title: t("settingsFailed"), tone: "error" });
                  });
                }}
                testID="notifications-open-settings"
              />
            ) : null}
          </ListSection>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: space.md,
    gap: space.lg,
    paddingBottom: space.xxl + space.xl,
  },
  intro: { paddingHorizontal: space.md },
  loading: { gap: space.lg },
  toggleRow: { flexDirection: "row", alignItems: "center" },
  rowLabel: { flex: 1 },
  switchTarget: {
    minHeight: 48,
    minWidth: 48,
    justifyContent: "center",
    marginRight: space.md,
  },
  filters: { padding: space.md, gap: space.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
});
