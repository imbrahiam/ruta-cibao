"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { prefetchAdminRoute } from "./list-queries";
import type { Staff } from "./staff-context";

export function useAdminPrefetch(staff: Staff) {
  const client = useQueryClient();
  const router = useRouter();
  return (href: string) => {
    router.prefetch(href);
    void prefetchAdminRoute(client, href, staff);
  };
}
