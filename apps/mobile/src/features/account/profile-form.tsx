import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Keyboard, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { orpc } from "@/lib/api";
import { requestId } from "@/lib/ids";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { NativePicker } from "@/ui/native-picker";
import { Text } from "@/ui/text";
import { space } from "@/ui/theme";
import { useToast } from "@/ui/toast";

/**
 * Name and home municipality. Used after the first sign-in and from Account.
 * The municipality is a choice, not a verification.
 */
export function ProfileForm({
  initialName,
  initialMunicipality,
  onDone,
  secondary,
}: {
  initialName: string;
  initialMunicipality: string | null;
  onDone: () => void;
  secondary?: { label: string; onPress: () => void };
}) {
  const t = useTranslations("profile");
  const tc = useTranslations("common");
  const toast = useToast();
  const queryClient = useQueryClient();
  const id = useMemo(() => requestId(), []);
  const municipalities = useQuery(orpc.municipalities.list.queryOptions());
  const [name, setName] = useState(initialName);
  const [municipality, setMunicipality] = useState<string | null>(
    initialMunicipality,
  );
  const [error, setError] = useState<string | null>(null);

  const save = useMutation(
    orpc.me.updateProfile.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.me.get.key() });
        toast.show({ title: t("saved") });
        onDone();
      },
      onError: () => setError(tc("errorBody")),
    }),
  );

  return (
    <View style={styles.form}>
      <Field
        label={t("name")}
        helper={t("nameHelper")}
        error={error && name.trim().length < 2 ? t("nameError") : undefined}
        value={name}
        onChangeText={setName}
        maxLength={80}
        autoCapitalize="words"
        textContentType="name"
        autoComplete="name"
        testID="profile-name"
      />
      <View style={styles.group}>
        <NativePicker
          label={t("municipality")}
          placeholder={tc("choose")}
          value={municipality ?? "__none"}
          options={[
            { value: "__none", label: tc("notSelected") },
            ...(municipalities.data ?? []).map((item) => ({
              value: item.id,
              label: item.name,
            })),
          ]}
          onChange={(value) => {
            Keyboard.dismiss();
            setMunicipality(value === "__none" ? null : value);
          }}
          testID="profile-municipality"
        />
        <Text variant="footnote" tone="tertiary">
          {t("municipalityHelper")}
        </Text>
      </View>
      {error && name.trim().length >= 2 ? (
        <Text tone="danger">{error}</Text>
      ) : null}
      <Button
        label={tc("save")}
        loading={save.isPending}
        block
        testID="profile-save"
        onPress={() => {
          if (name.trim().length < 2) {
            setError(t("nameError"));
            return;
          }
          save.mutate({
            requestId: id,
            displayName: name.trim(),
            municipalityId: municipality,
          });
        }}
      />
      {secondary ? (
        <Button
          label={secondary.label}
          variant="tertiary"
          onPress={secondary.onPress}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
  group: { gap: space.sm },
});
