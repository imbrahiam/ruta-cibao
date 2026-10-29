import { type QueryClient, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useCallback } from "react";
import { unregisterPush } from "@/features/notifications/push";
import { isNetworkError } from "@/features/offline/fallback";
import { api, orpc } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { queryClient as defaultQueryClient } from "@/lib/query";

/** The last answer to `me.get`, so a member without signal stays a member. */
export const LAST_VIEWER_KEY = "auth.last-viewer";

/** Who is using the app, from the server's point of view (`me.get`). */
export function useMe() {
  const session = authClient.useSession();
  const me = useQuery({
    queryKey: orpc.me.get.queryKey(),
    queryFn: async () => {
      try {
        const viewer = await api.me.get();
        await SecureStore.setItemAsync(
          LAST_VIEWER_KEY,
          JSON.stringify(viewer),
        ).catch(() => undefined); // expected: caching the last viewer is best effort.
        return viewer;
      } catch (error) {
        // No answer is not "signed out": keep who the person was, as long as
        // the session cookie is still on the device.
        const last = isNetworkError(error)
          ? await SecureStore.getItemAsync(LAST_VIEWER_KEY)
          : null;
        if (last && (await authClient.getCookie())) {
          return JSON.parse(last) as Awaited<ReturnType<typeof api.me.get>>;
        }
        throw error;
      }
    },
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

/**
 * Unbinds native push while the session cookie is still valid, signs out of
 * Better Auth, and resets TanStack Query observers so no private data lingers.
 */
export async function signOutLocally(
  client: QueryClient = defaultQueryClient,
): Promise<void> {
  try {
    await unregisterPush().catch(() => undefined); // expected: a remote unregister must not block sign-out.
    await authClient.signOut().catch(() => undefined); // expected: local sign-out completes even if the request fails.
    await SecureStore.deleteItemAsync(LAST_VIEWER_KEY).catch(() => undefined); // expected: the key may already be absent.
  } finally {
    await client.resetQueries();
  }
}
