import {
  type ComponentRef,
  forwardRef,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { Text } from "./text";
import { radius, space, type, useTheme } from "./theme";

/** What a `ref` on a text input resolves to. */
export type TextInputHandle = ComponentRef<typeof TextInput>;

export type FieldProps = Omit<TextInputProps, "style"> & {
  label: string;
  helper?: string;
  error?: string;
  /** Content before the input, e.g. a country code. */
  prefix?: string;
};

/**
 * A labelled text input. 17pt text so iOS never zooms; the label is always
 * visible (never a placeholder standing in for it); errors are text, not just
 * a red border.
 */
export const Field = forwardRef<TextInputHandle, FieldProps>(function Field(
  { label, helper, error, prefix, onFocus, onBlur, multiline, ...input },
  ref,
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const textContentType =
    input.textContentType ??
    (input.keyboardType === "phone-pad"
      ? "telephoneNumber"
      : input.keyboardType === "email-address"
        ? "emailAddress"
        : undefined);
  const autoComplete =
    input.autoComplete ??
    (textContentType === "telephoneNumber"
      ? "tel-national"
      : textContentType === "emailAddress"
        ? "email"
        : textContentType === "oneTimeCode"
          ? "one-time-code"
          : textContentType === "name"
            ? "name"
            : undefined);
  const border = error
    ? colors.danger
    : focused
      ? colors.accent
      : colors.separator;

  return (
    <View style={styles.wrap}>
      <Text variant="subhead" weight="600" tone="secondary">
        {label}
      </Text>
      <View
        style={[
          styles.box,
          multiline && styles.multiline,
          {
            backgroundColor: colors.surface,
            borderColor: border,
            borderWidth: focused || error ? 1.5 : StyleSheet.hairlineWidth * 2,
          },
        ]}
      >
        {prefix ? (
          <Text tone="secondary" style={styles.prefix}>
            {prefix}
          </Text>
        ) : null}
        <TextInput
          ref={ref}
          clearButtonMode={multiline ? "never" : "while-editing"}
          {...input}
          textContentType={textContentType}
          autoComplete={autoComplete}
          multiline={multiline}
          accessibilityLabel={label}
          accessibilityHint={error ?? helper}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accent}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[
            type.body,
            styles.input,
            multiline && styles.inputMultiline,
            { color: colors.text },
          ]}
        />
      </View>
      {error ? (
        <Text variant="footnote" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : helper ? (
        <Text variant="footnote" tone="tertiary">
          {helper}
        </Text>
      ) : null}
    </View>
  );
});

export type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  label: string;
  error?: boolean;
  autoFocus?: boolean;
  testID?: string;
};

/**
 * One real input behind six drawn cells, so the system can autofill the code
 * from SMS or email and paste works.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  label,
  error,
  autoFocus,
  testID,
}: OtpInputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const input = useRef<TextInputHandle>(null);
  const cells = useMemo(
    () => Array.from({ length }, (_, index) => `digit-${index + 1}`),
    [length],
  );

  return (
    <Pressable
      onPress={() => input.current?.focus()}
      accessible={false}
      style={styles.otpRow}
    >
      {cells.map((cell, index) => {
        const char = value[index] ?? "";
        const active = focused && index === Math.min(value.length, length - 1);
        return (
          <View
            key={cell}
            style={[
              styles.otpCell,
              {
                backgroundColor: colors.surface,
                borderColor: error
                  ? colors.danger
                  : active
                    ? colors.accent
                    : colors.separator,
                borderWidth: active || error ? 2 : 1,
                transform: [{ scale: active ? 1.04 : 1 }],
              },
            ]}
          >
            <Text variant="title2" weight="600" tabular>
              {char}
            </Text>
          </View>
        );
      })}
      <TextInput
        ref={input}
        testID={testID}
        value={value}
        onChangeText={(text) =>
          onChange(text.replace(/\D/g, "").slice(0, length))
        }
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        autoFocus={autoFocus}
        caretHidden
        accessibilityLabel={label}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.otpHidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs + 2 },
  box: {
    minHeight: 52,
    borderRadius: radius.input,
    borderCurve: "continuous",
    paddingHorizontal: space.md - 2,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  multiline: { alignItems: "flex-start", paddingVertical: space.sm + 4 },
  prefix: { paddingRight: space.xs },
  input: { flex: 1, paddingVertical: space.sm + 4 },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: "top",
    paddingVertical: 0,
  },
  otpRow: { flexDirection: "row", gap: space.sm, justifyContent: "center" },
  otpCell: {
    width: 48,
    height: 58,
    borderRadius: radius.input,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  otpHidden: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.011,
    color: "transparent",
  },
});
