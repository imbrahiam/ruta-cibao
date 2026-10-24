import {
  Host as ComposeHost,
  Text as ComposeText,
  DropdownMenuItem,
  ExposedDropdownMenu,
  ExposedDropdownMenuBox,
  ListItem,
  RNHostView,
} from "@expo/ui/jetpack-compose";
import {
  testID as composeTestID,
  fillMaxWidth,
  menuAnchor,
  semantics,
} from "@expo/ui/jetpack-compose/modifiers";
import {
  Host,
  HStack,
  Text as NativeText,
  Picker,
  Spacer,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  foregroundStyle,
  frame,
  labelsHidden,
  pickerStyle,
  tag,
} from "@expo/ui/swift-ui/modifiers";
import { ChevronDown } from "lucide-react-native";
import { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Icon } from "./icon";
import { Text } from "./text";
import { radius, space, useTheme } from "./theme";

export type NativePickerProps = {
  label: string;
  value: string | null;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
  testID?: string;
};

/** One labelled choice: system menu picker on iOS, exposed dropdown on Android. */
export function NativePicker({
  label,
  value,
  options,
  onChange,
  placeholder,
  error,
  testID,
}: NativePickerProps) {
  const { colors, scheme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const current = options.find((option) => option.value === value)?.label;
  return (
    <View style={styles.field}>
      {Platform.OS === "ios" ? (
        <Host
          matchContents={{ vertical: true }}
          colorScheme={scheme}
          seedColor={colors.accent}
          style={[styles.row, { backgroundColor: colors.groupedRow }]}
        >
          <HStack spacing={space.sm} modifiers={[frame({ minHeight: 52 })]}>
            <NativeText modifiers={[foregroundStyle(colors.text)]}>
              {label}
            </NativeText>
            <Spacer />
            <Picker
              label={label}
              selection={value ?? ""}
              onSelectionChange={(next) => {
                if (next !== "") onChange(next);
              }}
              testID={testID}
              modifiers={[
                pickerStyle("menu"),
                labelsHidden(),
                accessibilityLabel(label),
              ]}
            >
              <NativeText modifiers={[tag("")]}>{placeholder}</NativeText>
              {options.map((option) => (
                <NativeText key={option.value} modifiers={[tag(option.value)]}>
                  {option.label}
                </NativeText>
              ))}
            </Picker>
          </HStack>
        </Host>
      ) : (
        <ComposeHost
          matchContents={{ vertical: true }}
          colorScheme={scheme}
          seedColor={colors.accent}
          style={styles.compose}
        >
          <ExposedDropdownMenuBox
            expanded={expanded}
            onExpandedChange={setExpanded}
            modifiers={[fillMaxWidth()]}
          >
            <ListItem
              colors={{
                containerColor: colors.groupedRow,
                contentColor: colors.text,
                trailingContentColor: colors.accent,
              }}
              modifiers={[
                fillMaxWidth(),
                menuAnchor(),
                semantics({
                  contentDescription: `${label}, ${current ?? placeholder}`,
                }),
                ...(testID ? [composeTestID(testID)] : []),
              ]}
            >
              <ListItem.HeadlineContent>
                <ComposeText>{label}</ComposeText>
              </ListItem.HeadlineContent>
              <ListItem.SupportingContent>
                <ComposeText>{current ?? placeholder}</ComposeText>
              </ListItem.SupportingContent>
              <ListItem.TrailingContent>
                <RNHostView matchContents>
                  <View style={styles.chevron}>
                    <Icon as={ChevronDown} size={20} color="accent" />
                  </View>
                </RNHostView>
              </ListItem.TrailingContent>
            </ListItem>
            <ExposedDropdownMenu
              expanded={expanded}
              onDismissRequest={() => setExpanded(false)}
            >
              {options.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => {
                    setExpanded(false);
                    onChange(option.value);
                  }}
                >
                  <DropdownMenuItem.Text>
                    <ComposeText>{option.label}</ComposeText>
                  </DropdownMenuItem.Text>
                </DropdownMenuItem>
              ))}
            </ExposedDropdownMenu>
          </ExposedDropdownMenuBox>
        </ComposeHost>
      )}
      {error ? (
        <Text variant="footnote" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.xs + 2 },
  row: {
    borderRadius: radius.input,
    paddingHorizontal: space.md,
    alignSelf: "stretch",
  },
  compose: { alignSelf: "stretch" },
  chevron: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
});
