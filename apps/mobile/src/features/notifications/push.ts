import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { api } from "@/lib/api";
import { requestId } from "@/lib/ids";

const INSTALLATION_KEY = "notifications.installation-id";
const CONTRIBUTION_PROMPT_KEY = "notifications.contribution-prompted";
let installation: Promise<string> | undefined;
let registration: Promise<boolean> | undefined;
let unregistering = false;

/** Stable across sessions and account switches; never an account identifier. */
async function installationId(): Promise<string> {
  installation ??= (async () => {
    const saved = await SecureStore.getItemAsync(INSTALLATION_KEY);
    if (saved) return saved;
    const id = requestId();
    await SecureStore.setItemAsync(INSTALLATION_KEY, id);
    return id;
  })().catch((error: unknown) => {
    installation = undefined;
    throw error;
  });
  return installation;
}

export function permissionGranted(
  permission: Notifications.NotificationPermissionsStatus,
): boolean {
  return (
    permission.granted ||
    permission.ios?.status ===
      Notifications.IosAuthorizationStatus.PROVISIONAL ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

/** Only explicit channel activation or a first contribution may pass `true`. */
export async function registerPush(askPermission = false): Promise<boolean> {
  if (unregistering || (Platform.OS !== "ios" && Platform.OS !== "android")) {
    return false;
  }
  if (registration) return registration;
  registration = (async () => {
    try {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: Constants.expoConfig?.name ?? "Ruta Cibao",
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: null,
          enableVibrate: false,
        });
      }
      let permission = await Notifications.getPermissionsAsync();
      if (
        askPermission &&
        !permissionGranted(permission) &&
        permission.canAskAgain &&
        permission.status === "undetermined"
      ) {
        permission = await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: false, allowSound: false },
        });
      }
      if (!permissionGranted(permission)) return false;
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
      // Local builds and simulators can use settings without push credentials.
      if (typeof projectId !== "string" || !projectId) return false;
      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      if (unregistering) return false;
      const result = await api.notifications.subscribeNativePush({
        requestId: requestId(),
        installationId: await installationId(),
        platform: Platform.OS === "ios" ? "ios" : "android",
        token: token.data,
      });
      return result.enabled;
    } catch {
      // Token acquisition may be unavailable/offline; preferences remain valid.
      return false;
    }
  })();
  try {
    return await registration;
  } finally {
    registration = undefined;
  }
}

/** Call before authClient.signOut(), while the session cookie is still valid. */
export async function unregisterPush(): Promise<void> {
  unregistering = true;
  try {
    await registration;
    const id = await SecureStore.getItemAsync(INSTALLATION_KEY);
    if (id) {
      await api.notifications.unsubscribeNativePush({
        requestId: requestId(),
        installationId: id,
      });
    }
  } finally {
    unregistering = false;
  }
}

/** Call after an accepted first contribution, never on app launch/sign-in. */
export async function askForPushAfterContribution(): Promise<void> {
  try {
    if (await SecureStore.getItemAsync(CONTRIBUTION_PROMPT_KEY)) return;
    const preferences = await api.notifications.getPreferences();
    if (!preferences.caseUpdatesEnabled && !preferences.trafficEnabled) return;
    await SecureStore.setItemAsync(CONTRIBUTION_PROMPT_KEY, "1");
    await registerPush(true);
  } catch {
    // A successful contribution must not become an error because push failed.
  }
}
