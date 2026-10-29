import * as Notifications from "expo-notifications";
import { useRootNavigationState } from "expo-router";
import { useEffect } from "react";
import { openTarget } from "@/lib/targets";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let lastHandled: string | undefined;

/** Cold-start and foreground taps share the app's validated target resolver. */
export function NotificationResponseListener() {
  const navigation = useRootNavigationState();

  useEffect(() => {
    if (!navigation?.key) return;
    let active = true;
    function handle(response: Notifications.NotificationResponse | null) {
      if (!active || !response) return;
      const key = `${response.notification.request.identifier}:${response.actionIdentifier}`;
      if (lastHandled === key) return;
      lastHandled = key;
      const href: unknown = response.notification.request.content.data?.href;
      if (
        typeof href === "string" &&
        /^(?:\/contributions|\/s\/(?:place|route|consultation|traffic)\/[^/?#]+)$/.test(
          href,
        )
      ) {
        openTarget(href);
      }
      Notifications.clearLastNotificationResponse();
    }
    const subscription =
      Notifications.addNotificationResponseReceivedListener(handle);
    void Notifications.getLastNotificationResponseAsync()
      .then(handle)
      .catch(() => undefined); // expected: a stale notification response is ignored.
    return () => {
      active = false;
      subscription.remove();
    };
  }, [navigation?.key]);

  return null;
}
