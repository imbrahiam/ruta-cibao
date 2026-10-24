import {
  Host as ComposeHost,
  Text as ComposeText,
  DropdownMenu,
  DropdownMenuItem,
  RNHostView,
} from "@expo/ui/jetpack-compose";
import { semantics } from "@expo/ui/jetpack-compose/modifiers";
import {
  Host,
  Label,
  Menu,
  Text as NativeText,
  Picker,
} from "@expo/ui/swift-ui";
import {
  frame,
  labelStyle,
  pickerStyle,
  tag,
} from "@expo/ui/swift-ui/modifiers";
import { ListFilter } from "lucide-react-native";
import { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { Icon } from "@/ui/icon";
import { useTheme } from "@/ui/theme";

const ALL = "__all__";

/**
 * Which kind of place the map shows, as the platform's own filter menu: a
 * SwiftUI menu with a checked list on iOS, a Material dropdown on Android.
 * Plain names, no icons: the pins already carry them.
 */
export function CategoryFilter({
  categories,
  value,
  onChange,
}: {
  categories: ReadonlyArray<{ id: string; name: string }>;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const t = useTranslations("map");
  const { colors, scheme } = useTheme();
  const [open, setOpen] = useState(false);
  const label = t("filterPlaces");

  if (Platform.OS === "ios") {
    return (
      <Host matchContents colorScheme={scheme} style={styles.host}>
        <Menu
          label={
            <Label
              title={label}
              systemImage={
                value
                  ? "line.3.horizontal.decrease.circle.fill"
                  : "line.3.horizontal.decrease.circle"
              }
              modifiers={[
                labelStyle("iconOnly"),
                frame({ width: 48, height: 48 }),
              ]}
            />
          }
          testID="map-filter"
        >
          <Picker
            label={label}
            selection={value ?? ALL}
            onSelectionChange={(next) => onChange(next === ALL ? null : next)}
            modifiers={[pickerStyle("inline")]}
          >
            <NativeText modifiers={[tag(ALL)]}>{t("allCategories")}</NativeText>
            {categories.map((category) => (
              <NativeText key={category.id} modifiers={[tag(category.id)]}>
                {category.name}
              </NativeText>
            ))}
          </Picker>
        </Menu>
      </Host>
    );
  }

  return (
    <ComposeHost matchContents colorScheme={scheme} seedColor={colors.accent}>
      <DropdownMenu expanded={open} onDismissRequest={() => setOpen(false)}>
        <DropdownMenu.Trigger>
          <RNHostView matchContents>
            <View
              style={styles.trigger}
              accessible
              accessibilityRole="button"
              accessibilityLabel={label}
              onTouchEnd={() => setOpen(true)}
            >
              <Icon as={ListFilter} size={20} color="text" />
            </View>
          </RNHostView>
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          {[{ id: ALL, name: t("allCategories") }, ...categories].map(
            (category) => (
              <DropdownMenuItem
                key={category.id}
                modifiers={[semantics({ contentDescription: category.name })]}
                onClick={() => {
                  setOpen(false);
                  onChange(category.id === ALL ? null : category.id);
                }}
              >
                <DropdownMenuItem.Text>
                  <ComposeText>
                    {(value ?? ALL) === category.id
                      ? `✓  ${category.name}`
                      : category.name}
                  </ComposeText>
                </DropdownMenuItem.Text>
              </DropdownMenuItem>
            ),
          )}
        </DropdownMenu.Items>
      </DropdownMenu>
    </ComposeHost>
  );
}

const styles = StyleSheet.create({
  host: { width: 48, height: 48 },
  trigger: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
});
