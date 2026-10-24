import { File, Paths } from "expo-file-system";
import { clearPrivateStorage } from "@/features/account/deletion";

/**
 * iOS keeps keychain items after the app is deleted, so a reinstall would
 * come back signed in as whoever used the phone before. The app container is
 * wiped on uninstall, so a marker file there tells a fresh install apart: on
 * first launch without it, the private keychain entries go before anything
 * reads them.
 */
export async function forgetPreviousInstall(): Promise<void> {
  const marker = new File(Paths.document, ".installed");
  if (marker.exists) return;
  await clearPrivateStorage();
  marker.create();
}
