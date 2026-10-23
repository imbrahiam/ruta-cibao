import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback } from "react";
import { orpc } from "@/lib/api";
import { authClient } from "@/lib/auth";

/** Who is using the app, from the server's point of view (`me.get`). */
export function useMe() {
  const session = authClient.useSession();
  const me = useQuery({
    ...orpc.me.get.queryOptions(),
    enabled: !session.isPending,
  });
  return {
    me: me.data,
    signedIn: me.data?.kind === "member",
    isPending: session.isPending || me.isPending,
    refetch: me.refetch,
  };
}

/**
 * Runs `action` for a member; otherwise opens sign-in. The screen stays where
 * it is, so whatever was typed survives the detour.
 */
export function useMemberAction() {
  const { signedIn } = useMe();
  return useCallback(
    (action: () => void) => {
      if (signedIn) action();
      else router.push("/sign-in");
    },
    [signedIn],
  );
}

/** Leaves the sign-in modal, wherever in its steps the person is. */
export function closeSignIn() {
  router.dismissAll();
  router.back();
}
