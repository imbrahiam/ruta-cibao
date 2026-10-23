import { formatPhoneInput } from "@ruta/shared/phone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { MapPin, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useTranslations } from "use-intl";
import {
  setPickedLocation,
  usePickedLocation,
} from "@/features/map/picked-location";
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

/** Suggest a place or a business. It is published after municipal review. */
export default function SubmitPlaceScreen() {
  const t = useTranslations("contribute");
  const tc = useTranslations("common");
  const { colors } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const id = useMemo(() => requestId(), []);
  const categories = useQuery(orpc.places.categories.queryOptions());
  const picked = usePickedLocation();

  const [category, setCategory] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [hours, setHours] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => setPickedLocation(null), []);

  const kind = categories.data?.find((item) => item.id === category)?.kind;
  const submit = useMutation(
    orpc.places.submit.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.places.contributions.key(),
        });
        toast.show({ title: t("place.sent"), body: t("place.sentBody") });
        router.back();
      },
      onError: () => setServerError(tc("errorBody")),
    }),
  );

  const errors = {
    category: submitted && !category ? t("place.errors.category") : undefined,
    name:
      submitted && name.trim().length < 3 ? t("place.errors.name") : undefined,
    description:
      submitted && description.trim().length < 20
        ? t("place.errors.description")
        : undefined,
    location: submitted && !picked ? t("place.errors.location") : undefined,
  };

  const send = () => {
    setSubmitted(true);
    setServerError(null);
    if (
      !category ||
      name.trim().length < 3 ||
      description.trim().length < 20 ||
      !picked
    )
      return;
    submit.mutate({
      requestId: id,
      categoryId: category,
      name: name.trim(),
      description: description.trim(),
      address: address.trim() || undefined,
      location: { lng: picked.lng, lat: picked.lat },
      locationSource: "map",
      business:
        kind === "business"
          ? { contactPhone: phone, whatsapp, openingHours: hours.trim() }
          : undefined,
    });
  };

  const group = (kindName: "place" | "business") =>
    (categories.data ?? []).filter((item) => item.kind === kindName);

  return (
    <KeyboardAwareScrollView
      bottomOffset={24}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen
        options={{
          title: t("place.title"),
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
      <Text tone="secondary">{t("place.lede")}</Text>

      {(["place", "business"] as const).map((section) => (
        <View key={section} style={styles.group}>
          <Text variant="subhead" weight="600" tone="secondary">
            {t(`place.${section}Categories`)}
          </Text>
          <View style={styles.wrap}>
            {group(section).map((item) => (
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
        </View>
      ))}
      {errors.category ? (
        <Text variant="footnote" tone="danger">
          {errors.category}
        </Text>
      ) : null}

      <Field
        label={t("place.name")}
        error={errors.name}
        value={name}
        onChangeText={setName}
        maxLength={100}
      />
      <Field
        label={t("place.description")}
        helper={t("place.descriptionHelper")}
        error={errors.description}
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={600}
      />

      <Card style={styles.location}>
        <Icon
          as={MapPin}
          size={20}
          color={
            picked ? "accent" : errors.location ? "dangerInk" : "textTertiary"
          }
        />
        <View style={styles.flex}>
          <Text variant="headline">{t("place.location")}</Text>
          <Text
            variant="footnote"
            tone={errors.location ? "danger" : "tertiary"}
          >
            {picked
              ? t("place.locationSet", { place: picked.municipalityName ?? "" })
              : (errors.location ?? t("place.locationRequired"))}
          </Text>
        </View>
        <Button
          label={picked ? t("change") : t("mark")}
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

      <Field
        label={t("place.address")}
        helper={tc("optional")}
        value={address}
        onChangeText={setAddress}
        maxLength={240}
      />

      {kind === "business" ? (
        <View style={styles.group}>
          <Text variant="title3">{t("place.businessContact")}</Text>
          <Field
            label={t("place.phone")}
            helper={tc("optional")}
            prefix="+1"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={(text) => setPhone(formatPhoneInput(text))}
          />
          <Field
            label="WhatsApp"
            helper={tc("optional")}
            prefix="+1"
            keyboardType="phone-pad"
            value={whatsapp}
            onChangeText={(text) => setWhatsapp(formatPhoneInput(text))}
          />
          <Field
            label={t("place.hours")}
            helper={tc("optional")}
            value={hours}
            onChangeText={setHours}
            maxLength={240}
          />
        </View>
      ) : null}

      {serverError ? <Text tone="danger">{serverError}</Text> : null}
      <Button
        label={t("place.submit")}
        loading={submit.isPending}
        onPress={send}
        block
      />
      <Text variant="footnote" tone="tertiary" align="center">
        {t("reviewNote")}
      </Text>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, gap: space.lg, paddingBottom: space.xxl },
  flex: { flex: 1 },
  group: { gap: space.sm },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  location: { flexDirection: "row", alignItems: "center", gap: space.md - 4 },
});
