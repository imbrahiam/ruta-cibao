"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * One filter kept in the URL, so a reload, a shared link and the back button
 * land on the same view. The fallback is the value an absent parameter means,
 * and it is never written to the address.
 *
 * Changing it replaces the entry without scrolling: a reviewer who narrows the
 * list stays where they were.
 */
export function useUrlParam(
  name: string,
  fallback = "",
): readonly [string, (next: string) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const value = params.get(name) ?? fallback;

  const set = useCallback(
    (next: string) => {
      const query = new URLSearchParams(params);
      if (next === fallback) query.delete(name);
      else query.set(name, next);
      const search = query.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, {
        scroll: false,
      });
    },
    [fallback, name, params, pathname, router],
  );

  return [value, set] as const;
}
