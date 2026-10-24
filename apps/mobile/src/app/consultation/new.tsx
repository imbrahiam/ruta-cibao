import { isDefinedError } from "@orpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { MapPin, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useTranslations } from "use-intl";
import { useMe } from "@/features/auth/session";
import {
  setPickedLocation,
  usePickedLocation,
} from "@/features/map/picked-location";
import { askForPushAfterContribution } from "@/features/notifications/push";
import { isNetworkError } from "@/features/offline/fallback";
import { enqueueOutbox } from "@/features/offline/outbox";
import { orpc } from "@/lib/api";
import { requestId } from "@/lib/ids";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { categoryIcon, Icon } from "@/ui/icon";
import { Card, IconButton } from "@/ui/surfaces";
import { Chip } from "@/ui/tags";
import { Text } from "@/ui/text";
import { space, useTheme } from "@/ui/theme";
import { useToast } from "@/ui/toast";

/**
 * Opening a case: what, where (municipality is required, a pin is optional),
 * and a description. Typed errors come back as sentences the person can act on.
 */
export default function NewConsultationScreen() {
  const t = useTranslations("consultations");
  const tc = useTranslations("common");
  const to = useTranslations("offline");
  const { me } = useMe();
  const { colors } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const id = useMemo(() => requestId(), []);
  const categories = useQuery(orpc.consultations.categories.queryOptions());
  const municipalities = useQuery(orpc.municipalities.list.queryOptions());
  const picked = usePickedLocation();

  const [category, setCategory] = useState<string | null>(null);
  const [municipality, setMunicipality] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => setPickedLocation(null), []);
  useEffect(() => {
    if (picked?.municipalityId) setMunicipality(picked.municipalityId);
  }, [picked]);

  const open = useMutation(
    orpc.consultations.open.mutationOptions({
      onSuccess: (result) => {
        queryClient.invalidateQueries({
          queryKey: orpc.consultations.browse.key(),
        });
        toast.show({ title: t("opened"), body: t("openedBody") });
        void askForPushAfterContribution();
        router.replace(`/consultation/${result.slug}`);
      },
      onError: async (error, input) => {
        if (isNetworkError(error) && me?.kind === "member" && me.userId) {
          try {
            await enqueueOutbox({
              userId: me.userId,
              procedure: "consultations.open",
              input,
            });
            toast.show({
              title: to("queuedToast"),
              body: to("queuedToastBody"),
            });
            router.back();
            return;
          } catch {
            // Keep the case intact when local persistence fails.
          }
        }
        if (isDefinedError(error) && error.code === "MUNICIPALITY_MISMATCH") {
          setServerError(t("mismatch"));
          return;
        }
        setServerError(tc("errorBody"));
      },
    }),
  );

  const errors = {
    category: submitted && !category ? t("errors.category") : undefined,
    municipality:
      submitted && !municipality ? t("errors.municipality") : undefined,
    title: submitted && title.trim().length < 8 ? t("errors.title") : undefined,
    body: submitted && body.trim().length < 40 ? t("errors.body") : undefined,
  };

  const submit = () => {
    setSubmitted(true);
    setServerError(null);
    if (
      !category ||
      !municipality ||
      title.trim().length < 8 ||
      body.trim().length < 40
    )
      return;
    open.mutate({
      requestId: id,
      categoryId: category,
      municipalityId: municipality,
      title: title.trim(),
      body: body.trim(),
      location: picked ? { lng: picked.lng, lat: picked.lat } : undefined,
    });
  };

  return (
    <KeyboardAwareScrollView
      bottomOffset={24}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen
        options={{
          title: t("newTitle"),
          headerLeft: () => (
            <IconButton
              icon={X}
              label={tc("cancel")}
              size={36}
              onPress={() => router.back()}
              haptic="none"
            />
          ),
        }}
      />
      <Text tone="secondary">{t("newLede")}</Text>

      <View style={styles.group}>
        <Text variant="subhead" weight="600" tone="secondary">
          {t("category")}
        </Text>
        <View style={styles.wrap}>
          {(categories.data ?? []).map((item) => (
            <Chip
              key={item.id}
              label={item.name}
              icon={categoryIcon(item.icon)}
              iconColor={item.color}
              selected={category === item.id}
              onPress={() => setCategory(item.id)}
            />
          ))}
        </View>
        {errors.category ? (
          <Text variant="footnote" tone="danger">
            {errors.category}
          </Text>
        ) : null}
      </View>

      <View style={styles.group}>
        <Text variant="subhead" weight="600" tone="secondary">
          {t("municipality")}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {(municipalities.data ?? []).map((item) => (
            <Chip
              key={item.id}
              label={item.name}
              selected={municipality === item.id}
              onPress={() => setMunicipality(item.id)}
            />
          ))}
        </ScrollView>
        {errors.municipality ? (
          <Text variant="footnote" tone="danger">
            {errors.municipality}
          </Text>
        ) : null}
      </View>

      <Field
        label={t("titleLabel")}
        helper={t("titleHelper")}
        error={errors.title}
        value={title}
        onChangeText={setTitle}
        maxLength={120}
        testID="consultation-title"
      />
      <Field
        label={t("bodyLabel")}
        helper={t("bodyHelper", { count: body.trim().length })}
        error={errors.body}
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={2000}
        testID="consultation-body"
      />

      <Card style={styles.location}>
        <Icon
          as={MapPin}
          size={20}
          color={picked ? "accent" : "textTertiary"}
        />
        <View style={styles.flex}>
          <Text variant="headline">{t("location")}</Text>
          <Text variant="footnote" tone="tertiary">
            {picked
              ? t("locationSet", {
                  place: picked.municipalityName ?? t("pinned"),
                })
              : t("locationOptional")}
          </Text>
        </View>
        <Button
          label={picked ? t("changeLocation") : t("addLocation")}
          variant="secondary"
          size="sm"
          onPress={() =>
            router.push({
              pathname: "/pick-location",
              params: picked
                ? { lng: String(picked.lng), lat: String(picked.lat) }
                : {},
            })
          }
        />
      </Card>

      {serverError ? (
        <Text tone="danger" accessibilityLiveRegion="assertive">
          {serverError}
        </Text>
      ) : null}

      <Button
        label={t("submit")}
        loading={open.isPending}
        onPress={submit}
        block
        testID="consultation-submit"
      />
      <Text variant="footnote" tone="tertiary" align="center">
        {t("publicNote")}
      </Text>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, gap: space.lg, paddingBottom: space.xxl },
  flex: { flex: 1 },
  group: { gap: space.sm },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  row: { gap: space.sm },
  location: { flexDirection: "row", alignItems: "center", gap: space.md - 4 },
});
