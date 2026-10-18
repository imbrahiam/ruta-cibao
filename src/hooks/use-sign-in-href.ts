"use client";

import { useSearchParams } from "next/navigation";
import { usePathname } from "@/i18n/navigation";

/**
 * Sign-in that brings you back to what you were doing: the exact path and
 * query, which on the map is the open place and the filters. The server only
 * honours this app's own paths, so it cannot become an open redirect.
 */
export function useSignInHref(): string {
  const pathname = usePathname();
  const params = useSearchParams().toString();
  const back = params ? `${pathname}?${params}` : pathname;
  return `/entrar?callbackUrl=${encodeURIComponent(back)}`;
}
