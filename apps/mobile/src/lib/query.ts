import {
  focusManager,
  onlineManager,
  QueryClient,
} from "@tanstack/react-query";
import * as Network from "expo-network";
import { AppState, Platform } from "react-native";

/**
 * Server state. Queries refetch when the app returns to the foreground and when
 * the connection comes back, which is what "always current" means on a phone.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: (count, error) => count < 2 && !isClientError(error),
    },
    mutations: { retry: false },
  },
});

function isClientError(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  return typeof status === "number" && status >= 400 && status < 500;
}

let wired = false;

/** Connects TanStack Query to the app lifecycle and the network. Idempotent. */
export function wireQueryLifecycle() {
  if (wired) return;
  wired = true;

  focusManager.setEventListener((setFocused) => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (Platform.OS !== "web") setFocused(state === "active");
    });
    return () => subscription.remove();
  });

  onlineManager.setEventListener((setOnline) => {
    const subscription = Network.addNetworkStateListener((state) => {
      setOnline(
        state.isConnected !== false && state.isInternetReachable !== false,
      );
    });
    return () => subscription.remove();
  });
}
