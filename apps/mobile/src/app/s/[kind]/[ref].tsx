import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { openTarget } from "@/lib/targets";
import { useTheme } from "@/ui/theme";

/** Shared links (`rutacibao://s/place/…`, `https://…/s/place/…`) land here. */
export default function SharedTarget() {
  const { kind, ref } = useLocalSearchParams<{ kind: string; ref: string }>();
  const { colors } = useTheme();

  useEffect(() => {
    if (!openTarget(`/s/${kind}/${ref}`, { replace: true }))
      router.replace("/");
  }, [kind, ref]);

  return <View style={{ flex: 1, backgroundColor: colors.background }} />;
}
