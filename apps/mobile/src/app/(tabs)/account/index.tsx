import { formatPhone } from "@ruta/shared/phone";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Application from "expo-application";
import { router, Stack } from "expo-router";
import {
  BadgeCheck,
  Bell,
  Bookmark,
  EyeOff,
  Info,
  LogOut,
  ShieldCheck,
  Stamp,
  UserRound,
} from "lucide-react-native";
import { ScrollView, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { useMe } from "@/features/auth/session";
import { unregisterPush } from "@/features/notifications/push";
import { orpc } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { BrandMark } from "@/ui/brand";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { ListRow, ListSection } from "@/ui/list";
import { Skeleton } from "@/ui/states";
import { Text } from "@/ui/text";
import { radius, space, useTheme } from "@/ui/theme";
import { useToast } from "@/ui/toast";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function AccountScreen() {
  const t = useTranslations("account");
  const notificationSettings = useTranslations("notificationSettings");
  const ts = useTranslations("safety");
  const tu = useTranslations("safetyUi");
  const { colors } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { me, signedIn, isPending } = useMe();
  const municipalities = useQuery(orpc.municipalities.list.queryOptions());
  const municipalityName = municipalities.data?.find(
    (m) => m.id === me?.municipalityId,
  )?.name;

  const signOut = async () => {
    try {
      // While the session cookie is still valid, so the server can unbind
      // this phone from the account. Never blocks signing out.
      await unregisterPush().catch(() => undefined);
      await authClient.signOut();
    } finally {
      // Reset (not clear): drops every private result and refetches what is on
      // screen, so this tab re-renders as signed out instead of keeping the
      // last member data in its observers.
      await queryClient.resetQueries();
    }
    toast.show({ title: t("signedOut") });
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Stack.Screen options={{ title: t("title") }} />
      {isPending ? (
        <View style={styles.header}>
          <Skeleton width={72} height={72} rounded={36} />
          <Skeleton width={180} height={22} />
        </View>
      ) : signedIn && me?.kind === "member" ? (
        <View style={styles.header} testID="account-header">
          <View style={[styles.avatar, { backgroundColor: colors.pine }]}>
            <Text variant="title2" tone="onPine">
              {initials(me.displayName ?? "")}
            </Text>
          </View>
          <View style={styles.headerText}>
            <Text variant="title2" align="center">
              {me.displayName}
            </Text>
            <Text tone="secondary" align="center">
              {[
                me.phoneNumber ? `+1 ${formatPhone(me.phoneNumber)}` : null,
                me.email,
                municipalityName,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
          {me.residencyVerified ? (
            <View
              style={[styles.badge, { backgroundColor: colors.accentSoft }]}
            >
              <Icon as={BadgeCheck} size={15} color="accent" />
              <Text variant="footnote" tone="accent" weight="600">
                {t("resident", { place: municipalityName ?? "" })}
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View
          style={[
            styles.hero,
            { backgroundColor: colors.surface, borderColor: colors.hairline },
          ]}
        >
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
            testID="account-sign-in"
            block
          />
        </View>
      )}

      {signedIn ? (
        <ListSection title={t("yours")}>
          <ListRow
            title={t("profile")}
            icon={UserRound}
            onPress={() => router.push("/account/profile")}
            testID="account-profile"
          />
          <ListRow
            title={t("saved")}
            icon={Bookmark}
            onPress={() => router.push("/account/saved")}
          />
          <ListRow
            title={t("passport")}
            icon={Stamp}
            onPress={() => router.push("/account/passport")}
          />
          <ListRow
            title={notificationSettings("title")}
            icon={Bell}
            onPress={() => router.push("/account/notifications")}
            testID="account-notifications"
          />
          <ListRow
            title={ts("blocks.title")}
            subtitle={tu("blockedRowHint")}
            icon={EyeOff}
            onPress={() => router.push("/account/blocked")}
            testID="account-blocked"
          />
        </ListSection>
      ) : null}

      <ListSection title={t("about")}>
        <ListRow
          title={t("privacy")}
          icon={ShieldCheck}
          onPress={() => router.push("/account/privacy")}
        />
        <ListRow
          title={t("aboutApp")}
          icon={Info}
          value={Application.nativeApplicationVersion ?? undefined}
          onPress={() => router.push("/account/about")}
        />
      </ListSection>

      {signedIn ? (
        <ListSection>
          <ListRow
            title={t("signOut")}
            icon={LogOut}
            destructive
            onPress={signOut}
            testID="account-sign-out"
          />
        </ListSection>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: space.md,
    gap: space.lg,
    paddingBottom: space.xxl + space.xl,
  },
  header: {
    alignItems: "center",
    gap: space.sm + 4,
    paddingVertical: space.md,
  },
  headerText: { gap: 2, alignItems: "center" },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.sm + 4,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  hero: {
    alignItems: "center",
    gap: space.sm + 4,
    padding: space.lg,
    borderRadius: radius.panel,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
