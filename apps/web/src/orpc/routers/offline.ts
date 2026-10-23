import { getOfflineManifest } from "@/modules/offline/snapshot";
import { impl } from "../base";

export const offlineRouter = {
  manifest: impl.offline.manifest.handler(() => getOfflineManifest()),
};
