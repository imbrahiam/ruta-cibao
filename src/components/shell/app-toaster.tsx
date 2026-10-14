"use client";

import { Toaster } from "@/components/ui/sonner";
import { useMediaQuery } from "@/hooks/use-media-query";

/**
 * Where confirmations appear.
 *
 * On a phone, at the bottom just above the navigation — the snackbar position
 * every Android app uses, and where the thumb that caused the toast already
 * is. Top-centre covered the map's search row, the control someone is most
 * likely to reach for next. On a wider screen the top is free and reads first.
 *
 * Light, always: the app has one theme, and Sonner's `system` default gave a
 * phone in dark mode black toasts over a white app.
 */
export function AppToaster() {
  const isPhone = useMediaQuery("(max-width: 767px)");

  return (
    <Toaster
      theme="light"
      position={isPhone ? "bottom-center" : "top-center"}
      mobileOffset={{
        bottom: "calc(var(--mobile-nav-height) + 0.75rem)",
        left: "0.75rem",
        right: "0.75rem",
      }}
      gap={8}
    />
  );
}
