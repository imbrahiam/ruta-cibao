import { Redirect, useLocalSearchParams } from "expo-router";
import { targetRoute } from "@/lib/targets";

/** Shared links (`rutacibao://s/place/…`, `https://…/s/place/…`) land here. */
export default function SharedTarget() {
  const { kind, ref } = useLocalSearchParams<{ kind: string; ref: string }>();
  return <Redirect href={targetRoute(`/s/${kind}/${ref}`) ?? "/"} />;
}
