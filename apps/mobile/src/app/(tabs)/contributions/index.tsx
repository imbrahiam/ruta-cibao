import { ScrollView } from "react-native";
import { useTheme } from "@/ui/theme";

export default function ContributionsScreen() {
  const { colors } = useTheme();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
    />
  );
}
