import type { StyleProp, TextStyle } from "react-native";
import { useFormatter, useTranslations } from "use-intl";
import { Text } from "@/ui/text";

/** The timestamp belongs to the snapshot, not the failed request. */
export function SavedCopyNotice({
  date,
  style,
}: {
  date?: string;
  style?: StyleProp<TextStyle>;
}) {
  const t = useTranslations("offline");
  const format = useFormatter();
  if (!date) return null;
  return (
    <Text
      variant="footnote"
      tone="secondary"
      accessibilityLiveRegion="polite"
      style={style}
    >
      {t("savedCopyNotice", {
        date: format.dateTime(new Date(date), { dateStyle: "medium" }),
      })}
    </Text>
  );
}
