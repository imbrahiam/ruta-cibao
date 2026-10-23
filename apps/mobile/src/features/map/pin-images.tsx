import Mapbox from "@rnmapbox/maps";
import { StyleSheet, View } from "react-native";
import { categoryIcon, Icon } from "@/ui/icon";
import type { CategorySummary } from "./data";

/** Image id for a category pin, as the symbol layer looks it up. */
export function pinImage(category: string, selected = false): string {
  return `${selected ? "pin-selected" : "pin"}-${category}`;
}

const PIN = 30;
const SELECTED = 46;

/**
 * Category pins, drawn once as React views and handed to the map as images.
 * A coloured disc with a white glyph and a white ring, so a pin reads on any
 * basemap colour; the selected pin is larger and carries a stem.
 */
export function PinImages({ categories }: { categories: CategorySummary[] }) {
  return (
    <Mapbox.Images>
      {categories.flatMap((category) => [
        <Mapbox.Image key={pinImage(category.id)} name={pinImage(category.id)}>
          <View style={[styles.pin, { backgroundColor: category.color }]}>
            <Icon
              as={categoryIcon(category.icon)}
              size={16}
              color="#FFFFFF"
              strokeWidth={2.4}
            />
          </View>
        </Mapbox.Image>,
        <Mapbox.Image
          key={pinImage(category.id, true)}
          name={pinImage(category.id, true)}
        >
          <View style={styles.selectedWrap}>
            <View
              style={[styles.selected, { backgroundColor: category.color }]}
            >
              <Icon
                as={categoryIcon(category.icon)}
                size={22}
                color="#FFFFFF"
                strokeWidth={2.4}
              />
            </View>
            <View style={[styles.stem, { backgroundColor: category.color }]} />
          </View>
        </Mapbox.Image>,
      ])}
    </Mapbox.Images>
  );
}

const styles = StyleSheet.create({
  pin: {
    width: PIN,
    height: PIN,
    borderRadius: PIN / 2,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  selectedWrap: {
    alignItems: "center",
    width: SELECTED + 4,
    height: SELECTED + 14,
  },
  selected: {
    width: SELECTED,
    height: SELECTED,
    borderRadius: SELECTED / 2,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  stem: {
    width: 4,
    height: 12,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
});
