import { Image } from "expo-image";
import { Camera, ImagePlus, X } from "lucide-react-native";
import {
  ActionSheetIOS,
  Alert,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { useTranslations } from "use-intl";
import { Icon } from "@/ui/icon";
import { PressableScale } from "@/ui/pressable";
import { IconButton } from "@/ui/surfaces";
import { Text } from "@/ui/text";
import { radius, space, useTheme } from "@/ui/theme";
import type { LocalPhoto } from "./photos";

const TILE = 92;

/**
 * The photos chosen for a contribution, plus a tile to add one. Choosing
 * between camera and library is a native action sheet; the permission prompt
 * comes only after that choice.
 */
export function PhotoStrip({
  photos,
  max,
  onAdd,
  onRemove,
  disabled,
}: {
  photos: LocalPhoto[];
  max: number;
  onAdd: (source: "camera" | "library") => void;
  onRemove: (photo: LocalPhoto) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("contribute.photos");
  const tc = useTranslations("common");
  const { colors } = useTheme();

  const choose = () => {
    const options = [t("camera"), t("library"), tc("cancel")];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 2, title: t("add") },
        (index) => {
          if (index === 0) onAdd("camera");
          if (index === 1) onAdd("library");
        },
      );
      return;
    }
    Alert.alert(t("add"), undefined, [
      { text: t("camera"), onPress: () => onAdd("camera") },
      { text: t("library"), onPress: () => onAdd("library") },
      { text: tc("cancel"), style: "cancel" },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.heading}>
        <Text variant="subhead" weight="600" tone="secondary">
          {t("title")}
        </Text>
        <Text variant="footnote" tone="tertiary">
          {t("helper", { max })}
        </Text>
      </View>
      <View style={styles.row}>
        {photos.map((photo, index) => (
          <View key={photo.requestId} style={styles.tile}>
            <Image
              source={{ uri: photo.uri }}
              style={[styles.image, { backgroundColor: colors.fill }]}
              contentFit="cover"
              accessibilityLabel={t("photoLabel", { n: index + 1 })}
            />
            <View style={styles.remove}>
              <IconButton
                icon={X}
                label={t("remove", { n: index + 1 })}
                size={28}
                variant="glass"
                haptic="light"
                onPress={() => onRemove(photo)}
                disabled={disabled}
              />
            </View>
          </View>
        ))}
        {photos.length < max ? (
          <PressableScale
            onPress={choose}
            disabled={disabled}
            haptic="light"
            scaleTo={0.96}
            accessibilityRole="button"
            accessibilityLabel={t("add")}
            style={[
              styles.tile,
              styles.add,
              {
                borderColor: colors.separator,
                backgroundColor: colors.surface,
              },
            ]}
          >
            <Icon
              as={photos.length === 0 ? Camera : ImagePlus}
              size={24}
              color="accent"
            />
            <Text variant="caption" tone="secondary">
              {t("addShort")}
            </Text>
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  heading: { gap: 2 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: radius.card,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  image: { width: TILE, height: TILE },
  remove: { position: "absolute", top: 4, right: 4 },
  add: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
});
