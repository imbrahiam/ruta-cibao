import {
  Footprints,
  MapPin,
  MessageSquareText,
  TriangleAlert,
} from "lucide-react-native";
import { ScrollView, StyleSheet, Switch, View } from "react-native";
import { useTranslations } from "use-intl";
import {
  type MapLayers,
  setMapLayers,
  useMapLayers,
} from "@/features/map/layers";
import { ListRow, ListSection } from "@/ui/list";
import { haptic } from "@/ui/pressable";
import { Segmented } from "@/ui/segmented";
import { SheetHeader } from "@/ui/sheet-header";
import { Text } from "@/ui/text";
import { space, useTheme } from "@/ui/theme";

type Toggle = Exclude<keyof MapLayers, "basemap">;

/** What the map shows. Changes apply immediately and are remembered. */
export default function MapLayersSheet() {
  const t = useTranslations("mapLayers");
  const { colors } = useTheme();
  const layers = useMapLayers();

  const toggle = (key: Toggle) => (
    <Switch
      value={layers[key]}
      onValueChange={(value) => {
        haptic("selection");
        setMapLayers({ [key]: value });
      }}
      accessibilityLabel={t(key)}
    />
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <SheetHeader title={t("title")} />
      <View style={styles.block}>
        <Text
          variant="footnote"
          tone="tertiary"
          uppercase
          style={styles.label}
          accessibilityRole="header"
        >
          {t("basemap")}
        </Text>
        <Segmented
          accessibilityLabel={t("basemap")}
          value={layers.basemap}
          onChange={(basemap) => setMapLayers({ basemap })}
          options={[
            { value: "standard", label: t("standard") },
            { value: "satellite", label: t("satellite") },
          ]}
        />
      </View>
      <ListSection title={t("show")}>
        <ListRow
          title={t("places")}
          subtitle={t("placesHint")}
          icon={MapPin}
          accessory={toggle("places")}
        />
        <ListRow
          title={t("traffic")}
          subtitle={t("trafficHint")}
          icon={TriangleAlert}
          accessory={toggle("traffic")}
        />
        <ListRow
          title={t("routes")}
          subtitle={t("routesHint")}
          icon={Footprints}
          accessory={toggle("routes")}
        />
        <ListRow
          title={t("consultations")}
          subtitle={t("consultationsHint")}
          icon={MessageSquareText}
          accessory={toggle("consultations")}
        />
      </ListSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, paddingTop: space.lg, gap: space.lg },
  block: { gap: space.sm },
  /** Same inset and tracking as `ListSection` titles below it. */
  label: { paddingHorizontal: space.md, letterSpacing: 0.4 },
});
