"use client";

import { useSearchParams } from "next/navigation";
import { usePathname } from "@/i18n/navigation";

/**
 * Where to send someone who has to sign in to finish what they were doing.
 *
 * Nobody opens this app to sign in. They open it to add the water point on
 * their corner, or to report that a place has closed — and the sign-in screen
 * is a toll gate on the way. So it carries the way back: the exact address they
 * were on, query string and all, which on the map is the place they had open
 * and the filters they had set.
 *
 * `safeCallbackPath` on the other side refuses anything that is not one of this
 * app's own paths, so a crafted `callbackUrl` cannot turn sign-in into an open
 * redirect.
 */
export function useSignInHref(): string {
  const pathname = usePathname();
  const params = useSearchParams().toString();
  const back = params ? `${pathname}?${params}` : pathname;

  return `/entrar?callbackUrl=${encodeURIComponent(back)}`;
}
