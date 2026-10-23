import { directionsUrl } from "@ruta/shared/directions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  CircleCheck,
  CircleHelp,
  Clock,
  Flag,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Share2,
  ShieldCheck,
  Store,
} from "lucide-react-native";
import { useState } from "react";
import {
  FlatList,
  Linking,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { useMemberAction } from "@/features/auth/session";
import { focusOnMap } from "@/features/map/focus";
import { ContentMenu } from "@/features/safety/content-menu";
import { orpc } from "@/lib/api";
import { API_ORIGIN } from "@/lib/config";
import { mediaUrl } from "@/lib/ids";
import { Button } from "@/ui/button";
import { CategoryBadge } from "@/ui/category-badge";
import { categoryIcon, Icon } from "@/ui/icon";
import { haptic, PressableScale } from "@/ui/pressable";
import { EmptyState, Skeleton } from "@/ui/states";
import { Card, IconButton } from "@/ui/surfaces";
import { Badge, type BadgeTone } from "@/ui/tags";
import { Text } from "@/ui/text";
import { radius, space, useTheme } from "@/ui/theme";
import { useToast } from "@/ui/toast";

const HERO = 340;

const TRUST: Record<string, { tone: BadgeTone; icon: typeof ShieldCheck }> = {
  established: { tone: "success", icon: ShieldCheck },
  confirmed: { tone: "success", icon: CircleCheck },
  new: { tone: "accent", icon: MapPin },
  doubted: { tone: "warning", icon: CircleHelp },
};

export default function PlaceScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const t = useTranslations("place");
  const tc = useTranslations("common");
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const queryClient = useQueryClient();
  const asMember = useMemberAction();

  const detail = useQuery(orpc.places.detail.queryOptions({ input: { slug } }));
  const place = detail.data;
  const saved = useQuery({ ...orpc.places.saved.queryOptions(), retry: false });
  const isSaved = saved.data?.some((item) => item.slug === slug) ?? false;
  const business = useQuery({
    ...orpc.businesses.claimState.queryOptions({
      input: { placeId: place?.id ?? "" },
    }),
    enabled: Boolean(place),
  });
  const nearby = useQuery({
    ...orpc.places.nearby.queryOptions({
      input: {
        lng: place?.location.lng ?? 0,
        lat: place?.location.lat ?? 0,
        limit: 8,
      },
    }),
    enabled: Boolean(place),
  });

  const toggleSaved = useMutation(
    orpc.places.toggleSaved.mutationOptions({
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: orpc.places.saved.key() });
        toast.show({ title: result.saved ? t("saved") : t("unsaved") });
      },
      onError: () => toast.show({ title: tc("errorTitle"), tone: "error" }),
    }),
  );
  const confirm = useMutation(
    orpc.places.confirm.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.places.detail.key() });
        toast.show({ title: t("thanks") });
      },
      onError: () => toast.show({ title: tc("errorTitle"), tone: "error" }),
    }),
  );

  if (detail.isPending) return <PlaceSkeleton />;
  if (!place) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: "" }} />
        <EmptyState
          icon={MapPin}
          tone="danger"
          title={t("missingTitle")}
          body={t("missingBody")}
          action={{ label: tc("retry"), onPress: () => detail.refetch() }}
        />
      </View>
    );
  }

  const photos = [place.imageUrl, ...place.photos]
    .filter((url): url is string => Boolean(url))
    .filter((url, index, all) => all.indexOf(url) === index)
    .map((url) => mediaUrl(url, API_ORIGIN));
  const trust = TRUST[place.trust.state] ?? {
    tone: "accent" as const,
    icon: MapPin,
  };
  const directions = () => {
    const destination = { ...place.location, label: place.name };
    Linking.openURL(
      directionsUrl(destination, Platform.OS === "ios" ? "ios" : "android"),
    ).catch(() => Linking.openURL(directionsUrl(destination, "other")));
  };
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${place.location.lat},${place.location.lng}`;
  const owner = business.data;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xl }}
        showsVerticalScrollIndicator={false}
      >
        <Hero photos={photos} icon={place.category.icon} />

        <View style={[styles.body, { backgroundColor: colors.background }]}>
          <View style={styles.titleBlock}>
            <Text
              variant="title1"
              accessibilityRole="header"
              testID="place-name"
            >
              {place.name}
            </Text>
            <View style={styles.meta}>
              <CategoryBadge icon={place.category.icon} size={22} />
              <Text variant="subhead" tone="secondary">
                {place.category.name} · {place.municipality.name}
              </Text>
            </View>
            <Badge
              label={t(`trust.${place.trust.state}`)}
              tone={trust.tone}
              icon={trust.icon}
            />
          </View>

          <View style={styles.actions}>
            <Action
              icon={Navigation}
              label={t("directions")}
              onPress={directions}
              primary
            />
            <Action
              icon={isSaved ? BookmarkCheck : Bookmark}
              label={isSaved ? t("savedLabel") : t("save")}
              selected={isSaved}
              testID="place-save"
              onPress={() =>
                asMember(() =>
                  toggleSaved.mutate({ placeId: place.id, saved: !isSaved }),
                )
              }
            />
            <Action
              icon={Share2}
              label={tc("share")}
              onPress={() =>
                Share.share({
                  message: `${place.name} — ${place.municipality.name}\n${mapsLink}`,
                })
              }
            />
            <Action
              icon={MapIcon}
              label={t("onMap")}
              onPress={() => {
                focusOnMap("place", place.id);
                router.dismissTo("/");
              }}
            />
          </View>

          {place.description ? (
            <Text variant="body" tone="secondary" style={styles.paragraph}>
              {place.description}
            </Text>
          ) : null}

          {place.address ||
          owner?.openingHours ||
          owner?.contactPhone ||
          owner?.whatsapp ? (
            <Card padded={false}>
              {place.address ? (
                <InfoRow
                  icon={MapPin}
                  label={t("address")}
                  value={place.address}
                />
              ) : null}
              {owner?.openingHours ? (
                <InfoRow
                  icon={Clock}
                  label={t("hours")}
                  value={owner.openingHours}
                />
              ) : null}
              {owner?.contactPhone ? (
                <InfoRow
                  icon={Phone}
                  label={t("call")}
                  value={owner.contactPhone}
                  onPress={() => Linking.openURL(`tel:${owner.contactPhone}`)}
                />
              ) : null}
              {owner?.whatsapp ? (
                <InfoRow
                  icon={MessageCircle}
                  label="WhatsApp"
                  value={owner.whatsapp}
                  onPress={() =>
                    Linking.openURL(
                      `https://wa.me/${owner.whatsapp?.replace(/\D/g, "")}`,
                    )
                  }
                />
              ) : null}
            </Card>
          ) : null}

          {!place.isMine ? (
            <Card style={styles.block}>
              <Text variant="headline">{t("stillThere")}</Text>
              <Text variant="subhead" tone="secondary">
                {place.myVerdict ? t("answered") : t("stillThereBody")}
              </Text>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Button
                    label={t("exists")}
                    variant={
                      place.myVerdict === "exists" ? "primary" : "secondary"
                    }
                    size="md"
                    block
                    loading={
                      confirm.isPending &&
                      confirm.variables?.verdict === "exists"
                    }
                    onPress={() =>
                      asMember(() =>
                        confirm.mutate({
                          placeId: place.id,
                          verdict: "exists",
                        }),
                      )
                    }
                  />
                </View>
                <View style={styles.flex}>
                  <Button
                    label={t("gone")}
                    variant={
                      place.myVerdict === "gone" ? "destructive" : "secondary"
                    }
                    size="md"
                    block
                    loading={
                      confirm.isPending && confirm.variables?.verdict === "gone"
                    }
                    onPress={() =>
                      asMember(() =>
                        confirm.mutate({ placeId: place.id, verdict: "gone" }),
                      )
                    }
                  />
                </View>
              </View>
            </Card>
          ) : null}

          {owner?.claimable && !owner.claimed ? (
            <Card style={styles.block}>
              <View style={styles.row}>
                <Icon as={Store} size={20} color="accent" />
                <Text variant="headline">{t("claimTitle")}</Text>
              </View>
              <Text variant="subhead" tone="secondary">
                {owner.pending ? t("claimPending") : t("claimBody")}
              </Text>
              {owner.pending ? null : (
                <Button
                  label={t("claimAction")}
                  variant="secondary"
                  size="md"
                  onPress={() =>
                    asMember(() =>
                      router.push({
                        pathname: "/place/claim",
                        params: { placeId: place.id, name: place.name },
                      }),
                    )
                  }
                />
              )}
            </Card>
          ) : null}

          {(nearby.data ?? []).filter((item) => item.slug !== place.slug)
            .length > 0 ? (
            <View style={styles.block}>
              <Text variant="title3" accessibilityRole="header">
                {t("nearby")}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.nearby}
              >
                {(nearby.data ?? [])
                  .filter((item) => item.slug !== place.slug)
                  .map((item) => (
                    <Card
                      key={item.slug}
                      style={styles.nearbyCard}
                      onPress={() => router.push(`/place/${item.slug}`)}
                      accessibilityLabel={item.name}
                    >
                      <CategoryBadge icon={item.category.icon} size={36} />
                      <Text variant="subhead" weight="600" numberOfLines={2}>
                        {item.name}
                      </Text>
                      <Text variant="footnote" tone="tertiary">
                        {item.distanceMeters < 1000
                          ? t("meters", {
                              value: Math.round(item.distanceMeters),
                            })
                          : t("kilometers", {
                              value: (item.distanceMeters / 1000).toFixed(1),
                            })}
                      </Text>
                    </Card>
                  ))}
              </ScrollView>
            </View>
          ) : null}

          <Button
            label={t("report")}
            icon={Flag}
            variant="tertiary"
            size="md"
            onPress={() =>
              asMember(() =>
                router.push({
                  pathname: "/place/report",
                  params: { placeId: place.id },
                }),
              )
            }
          />
        </View>
      </ScrollView>

      <View
        style={[styles.floating, { top: insets.top + space.sm }]}
        pointerEvents="box-none"
      >
        <IconButton
          icon={ChevronLeft}
          label={tc("back")}
          variant="glass"
          onPress={() => router.back()}
          haptic="none"
        />
      </View>
      {place.isMine ? null : (
        <View
          style={[styles.floatingEnd, { top: insets.top + space.sm }]}
          pointerEvents="box-none"
        >
          <ContentMenu
            target={{ kind: "place", ref: place.slug }}
            variant="glass"
            onHidden={() => router.back()}
          />
        </View>
      )}
    </View>
  );
}

function Hero({ photos, icon }: { photos: string[]; icon: string }) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const t = useTranslations("place");
  const [page, setPage] = useState(0);

  if (photos.length === 0) {
    return (
      <View
        style={[
          styles.hero,
          styles.heroEmpty,
          { backgroundColor: colors.surface },
        ]}
      >
        <View style={styles.heroIcon}>
          <Icon
            as={categoryIcon(icon)}
            size={56}
            color={colors.textTertiary}
            strokeWidth={1.6}
          />
        </View>
        <Text variant="footnote" tone="secondary">
          {t("noPhotos")}
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.hero}>
      <FlatList
        data={photos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(url) => url}
        onMomentumScrollEnd={(event) =>
          setPage(Math.round(event.nativeEvent.contentOffset.x / width))
        }
        renderItem={({ item }) => (
          <Image
            source={item}
            contentFit="cover"
            transition={200}
            style={{ width, height: HERO, backgroundColor: colors.fill }}
            accessibilityIgnoresInvertColors
          />
        )}
      />
      {photos.length > 1 ? (
        <View style={styles.pager}>
          <Text variant="caption" weight="600" style={styles.pagerText} tabular>
            {page + 1} / {photos.length}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Action({
  icon,
  label,
  onPress,
  primary,
  selected,
  testID,
}: {
  icon: typeof Navigation;
  label: string;
  onPress: () => void;
  primary?: boolean;
  selected?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      testID={testID}
      containerStyle={styles.flex}
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[
        styles.action,
        {
          backgroundColor: primary
            ? colors.accent
            : selected
              ? colors.accentSoft
              : colors.surface,
          borderColor: colors.hairline,
        },
      ]}
    >
      <Icon as={icon} size={21} color={primary ? "onAccent" : "accent"} />
      <Text
        variant="caption"
        weight="600"
        tone={primary ? "onAccent" : "accent"}
        numberOfLines={1}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

function InfoRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: typeof Navigation;
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.info}>
      <Icon as={icon} size={19} color="textSecondary" />
      <View style={styles.flex}>
        <Text variant="footnote" tone="tertiary">
          {label}
        </Text>
        <Text tone={onPress ? "accent" : "primary"}>{value}</Text>
      </View>
    </View>
  );
  if (!onPress) return content;
  return (
    <PressableScale
      onPress={() => {
        haptic("light");
        onPress();
      }}
      scaleTo={0.985}
      accessibilityRole="link"
      accessibilityLabel={`${label}: ${value}`}
    >
      {content}
    </PressableScale>
  );
}

function PlaceSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <Skeleton height={HERO} rounded={0} />
      <View style={[styles.body, { gap: space.md }]}>
        <Skeleton width="75%" height={30} />
        <Skeleton width="45%" height={16} />
        <View style={styles.actions}>
          {[0, 1, 2, 3].map((key) => (
            <View key={key} style={styles.flex}>
              <Skeleton height={64} rounded={radius.card} />
            </View>
          ))}
        </View>
        <Skeleton height={80} rounded={radius.card} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, justifyContent: "center" },
  flex: { flex: 1 },
  hero: { height: HERO },
  heroEmpty: { alignItems: "center", justifyContent: "center", gap: space.md },
  heroIcon: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  pager: {
    position: "absolute",
    right: space.md,
    bottom: space.xl + space.md,
    backgroundColor: "rgba(18,18,17,0.6)",
    borderRadius: radius.pill,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 3,
  },
  pagerText: { color: "#FFFFFF" },
  body: {
    marginTop: -space.lg,
    borderTopLeftRadius: radius.panel,
    borderTopRightRadius: radius.panel,
    borderCurve: "continuous",
    paddingHorizontal: space.md,
    paddingTop: space.lg,
    gap: space.lg,
  },
  titleBlock: { gap: space.sm },
  meta: { flexDirection: "row", alignItems: "center", gap: space.sm },
  actions: { flexDirection: "row", gap: space.sm },
  action: {
    minHeight: 64,
    borderRadius: radius.card,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 4,
  },
  paragraph: { lineHeight: 24 },
  info: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md - 4,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 4,
  },
  block: { gap: space.sm + 2 },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  nearby: { gap: space.sm, paddingRight: space.md },
  nearbyCard: { width: 156, gap: space.sm },
  floating: { position: "absolute", left: space.md },
  floatingEnd: { position: "absolute", right: space.md },
});
