import { Stack } from "expo-router";
import { useTheme } from "@/ui/theme";

/** A modal flow: enter a phone or email, then the code. */
export default function SignInLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
