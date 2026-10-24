import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { EyeOff, UserRound } from "lucide-react-native";
import { Alert, RefreshControl, ScrollView, StyleSheet } from "react-native";
import { useTranslations } from "use-intl";
import { useMe } from "@/features/auth/session";
import { orpc } from "@/lib/api";
import { requestId } from "@/lib/ids";
import { Button } from "@/ui/button";
import { ListRow, ListSection } from "@/ui/list";
import { EmptyState, Skeleton } from "@/ui/states";
import { space, useTheme } from "@/ui/theme";
import { useToast } from "@/ui/toast";
import { refreshHiddenTargets } from "./hidden-targets";

/** The authors this person hid, with a way to undo each. Reached from Account. */
export function BlockedScreen() {
  const t = useTranslations("safety");
  const tu = useTranslations("safetyUi");
  const tc = useTranslations("common");
  const { colors } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { signedIn } = useMe();
  const blocks = useQuery({
    ...orpc.safety.blocks.queryOptions(),
    enabled: signedIn,
  });

  const unblock = useMutation(
    orpc.safety.unblock.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: orpc.safety.blocks.key(),
          }),
          refreshHiddenTargets(queryClient),
        ]);
        // What was hidden may now be shown again.
        for (const key of [
          orpc.places.key(),
          orpc.traffic.key(),
          orpc.routes.key(),
          orpc.consultations.key(),
        ]) {
          void queryClient.invalidateQueries({ queryKey: key });
        }
        toast.show({ title: t("blocks.unblocked") });
      },
      onError: () =>
        toast.show({ title: tu("unblockedFailed"), tone: "error" }),
    }),
  );

  const confirmUnblock = (id: string, name: string) =>
    Alert.alert(tu("unblockTitle", { name }), tu("unblockBody"), [
      { text: tc("cancel"), style: "cancel" },
      {
        text: t("blocks.unblock"),
        onPress: () => unblock.mutate({ requestId: requestId(), blockId: id }),
      },
    ]);

  const items = blocks.data ?? [];

  return (
    <>
      <Stack.Screen
        options={{ title: t("blocks.title"), headerLargeTitleEnabled: false }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.grouped }}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={blocks.isRefetching}
            onRefresh={() => void blocks.refetch()}
            tintColor={colors.accent}
          />
        }
      >
        {blocks.isPending ? (
          <Skeleton height={56} />
        ) : blocks.isError ? (
          <EmptyState
            icon={EyeOff}
            tone="danger"
            title={tc("errorTitle")}
            body={tc("errorBody")}
            action={{
              label: tc("retry"),
              onPress: () => void blocks.refetch(),
            }}
          />
        ) : items.length === 0 ? (
          <EmptyState icon={EyeOff} title={t("blocks.empty")} />
        ) : (
          <ListSection footer={t("blocks.intro")}>
            {items.map((item) => {
              const name = item.displayName ?? t("blocks.unnamed");
              return (
                <ListRow
                  key={item.id}
                  title={name}
                  icon={UserRound}
                  testID={`blocked-${item.id}`}
                  accessory={
                    <Button
                      label={t("blocks.unblock")}
                      variant="secondary"
                      size="sm"
                      disabled={unblock.isPending}
                      testID={`unblock-${item.id}`}
                      onPress={() => confirmUnblock(item.id, name)}
                    />
                  }
                />
              );
            })}
          </ListSection>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, gap: space.md },
});
