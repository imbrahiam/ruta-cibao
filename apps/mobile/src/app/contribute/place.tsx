import { submitPlaceInput } from "@ruta/contracts";
import { formatPhoneInput } from "@ruta/shared/phone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { MapPin, X } from "lucide-react-native";
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
import { PhotoStrip } from "@/features/places/photo-strip";
import {
  type LocalPhoto,
  pickPhoto,
  uploadPlacePhoto,
} from "@/features/places/photos";
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

const MAX_PHOTOS = 4;

/** Suggest a place or a business. It is published after municipal review. */
export default function SubmitPlaceScreen() {
  const t = useTranslations("contribute");
  const tc = useTranslations("common");
  const to = useTranslations("offline");
  const { me } = useMe();
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
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number }>();
  const [failed, setFailed] = useState<{
    placeId: string;
    photos: LocalPhoto[];
  }>();

  useEffect(() => setPickedLocation(null), []);

  const kind = categories.data?.find((item) => item.id === category)?.kind;

  const finish = () => {
    queryClient.invalidateQueries({
      queryKey: orpc.places.contributions.key(),
    });
    toast.show({ title: t("place.sent"), body: t("place.sentBody") });
    router.back();
  };

  /**
   * Photos go up after the place is accepted, one at a time. A failed photo
   * never takes the place back with it: the place stays sent and the photos
   * can be retried (same request ids, so no duplicate reservation) or dropped.
   */
  const uploadPhotos = async (placeId: string, queue: LocalPhoto[]) => {
    setFailed(undefined);
    const missed: LocalPhoto[] = [];
    for (const [index, photo] of queue.entries()) {
      setProgress({ done: index, total: queue.length });
      try {
        await uploadPlacePhoto(placeId, photo);
      } catch {
        missed.push(photo);
      }
    }
    setProgress(undefined);
    if (missed.length === 0) finish();
    else setFailed({ placeId, photos: missed });
  };

  const submit = useMutation(
    orpc.places.submit.mutationOptions({
      onSuccess: (result) => {
        void askForPushAfterContribution();
        if (photos.length === 0) finish();
        else void uploadPhotos(result.id, photos);
      },
      onError: async (error, input) => {
        if (
          photos.length === 0 &&
          isNetworkError(error) &&
          me?.kind === "member" &&
          me.userId
        ) {
          try {
            await enqueueOutbox({
              userId: me.userId,
              procedure: "places.submit",
              input: submitPlaceInput.parse(input),
            });
            toast.show({
              title: to("queuedToast"),
              body: to("queuedToastBody"),
            });
            router.back();
            return;
          } catch {
            // Keep the form intact when local persistence fails.
          }
        }
        setServerError(tc("errorBody"));
      },
    }),
  );

  const addPhoto = async (source: "camera" | "library") => {
    const result = await pickPhoto(source);
    if (result.status === "denied") {
      toast.show({
        title: t("photos.denied"),
        body: t("photos.deniedBody"),
        tone: "info",
      });
    } else if (result.status === "picked") {
      setPhotos((current) => [...current, result.photo].slice(0, MAX_PHOTOS));
    }
  };
  const busy = submit.isPending || progress !== undefined;

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
        testID="place-name"
        label={t("place.name")}
        error={errors.name}
        value={name}
        onChangeText={setName}
        maxLength={100}
      />
      <Field
        testID="place-description"
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
          testID="place-location"
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

      <PhotoStrip
        photos={photos}
        max={MAX_PHOTOS}
        onAdd={addPhoto}
        onRemove={(photo) =>
          setPhotos((current) =>
            current.filter((item) => item.requestId !== photo.requestId),
          )
        }
        disabled={busy || failed !== undefined}
      />

      {serverError ? <Text tone="danger">{serverError}</Text> : null}
      {failed ? (
        <Card style={styles.failed}>
          <Text variant="headline">
            {t("photos.failed", { count: failed.photos.length })}
          </Text>
          <Text variant="subhead" tone="secondary">
            {t("photos.failedBody")}
          </Text>
          <View style={styles.actions}>
            <View style={styles.flex}>
              <Button
                label={t("photos.finish")}
                variant="secondary"
                block
                onPress={finish}
              />
            </View>
            <View style={styles.flex}>
              <Button
                label={t("photos.retry")}
                block
                onPress={() => uploadPhotos(failed.placeId, failed.photos)}
              />
            </View>
          </View>
        </Card>
      ) : (
        <Button
          label={
            progress
              ? t("photos.uploading", {
                  done: progress.done + 1,
                  total: progress.total,
                })
              : t("place.submit")
          }
          loading={busy}
          onPress={send}
          block
        />
      )}
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
  failed: { gap: space.sm },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.xs },
});
