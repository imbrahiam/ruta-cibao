"use client";

import { useQuery } from "@tanstack/react-query";
import type { MunicipalBoundaries } from "@/lib/map/boundaries";

/**
 * The province's outline, fetched once and kept.
 *
 * Administrative boundaries are redrawn by law, not by traffic, so this never
 * goes stale within a session — and three components need the same 40 KB, which
 * is exactly the case a shared query cache exists for.
 */
export function useBoundaries() {
  return useQuery({
    queryKey: ["municipal-boundaries"],
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    queryFn: async (): Promise<MunicipalBoundaries> => {
      const response = await fetch("/api/municipalities/boundaries");
      if (!response.ok) throw new Error("boundaries unavailable");
      return response.json();
    },
  });
}
