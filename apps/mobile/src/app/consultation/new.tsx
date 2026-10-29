import { isDefinedError } from "@orpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { MapPin } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
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
import { Icon } from "@/ui/icon";
import { NativePicker } from "@/ui/native-picker";
import { Card } from "@/ui/surfaces";
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
            // expected: a failed local save keeps the case intact in memory.
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
        }}
      />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          accessibilityLabel={tc("cancel")}
          onPress={() => router.back()}
        >
          {tc("cancel")}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Text tone="secondary">{t("newLede")}</Text>

      <NativePicker
        label={t("category")}
        placeholder={tc("choose")}
        value={category}
        options={(categories.data ?? []).map((item) => ({
          value: item.id,
          label: item.name,
        }))}
        onChange={setCategory}
        error={errors.category}
        testID="consultation-category"
      />
      <NativePicker
        label={t("municipality")}
        placeholder={tc("choose")}
        value={municipality}
        options={(municipalities.data ?? []).map((item) => ({
          value: item.id,
          label: item.name,
        }))}
        onChange={setMunicipality}
        error={errors.municipality}
        testID="consultation-municipality"
      />

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
  location: { flexDirection: "row", alignItems: "center", gap: space.md - 4 },
});
