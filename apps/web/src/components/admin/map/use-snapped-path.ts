"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { orpc } from "@/lib/web/api";
import type { LatLng, MapItem } from "./map-types";
import { pathKey, smoothPath } from "./road-stretch";

/**
 * A stretch laid on Google's road, without ever waiting for it.
 *
 * The first answer is the reported path with its corners rounded, so a map can
 * draw immediately; when the server has laid the stretch on the road
 * (`moderation.snapRoad`, Google Roads `snapToRoads`) the dense road geometry
 * replaces it in place. A failure, an offline desk or a stretch that does not
 * follow a road leaves the smoothed path, which is what the map shows anyway.
 *
 * Results are cached by path (a road does not move), and a request in flight
 * is aborted when its map goes away.
 */
const OPTIONS = {
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: 30 * 60_000,
  retry: 1,
  retryDelay: 4_000,
  refetchOnWindowFocus: false,
} as const;

function snapOptions(path: LatLng[] | null, mode: "stretch" | "trail") {
  return orpc.moderation.snapRoad.queryOptions({
    input: { path: path ?? [], mode },
    enabled: path !== null && path.length > 1,
    ...OPTIONS,
  });
}

export function useSnappedPath(
  path: LatLng[] | null,
  mode: "stretch" | "trail" = "stretch",
): {
  path: LatLng[] | null;
  /** Whether `path` is Google's road, not the reported geometry. */
  snapped: boolean;
} {
  const key = path ? pathKey(path) : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for `path`
  const smooth = useMemo(() => (path ? smoothPath(path) : null), [key]);
  const query = useQuery(snapOptions(path, mode));
  const snapped = query.data?.path ?? null;
  return { path: snapped ?? smooth, snapped: snapped !== null };
}

/**
 * The items of a map with their paths laid on the road: stretches on Google's
 * centreline, trails on the streets they run along.
 */
export function useSnappedItems(items: MapItem[]): MapItem[] {
  const snapped = useQueries({
    queries: items.map((item) =>
      item.kind === "place"
        ? snapOptions(null, "stretch")
        : snapOptions(item.path, item.kind === "route" ? "trail" : "stretch"),
    ),
    combine: (results) => results.map((result) => result.data?.path ?? null),
  });

  const signature = items
    .map((item) =>
      item.kind === "place"
        ? item.id
        : `${item.id}@${pathKey(item.path ?? [])}@${item.kind === "traffic" ? `${item.color}${item.cleared}` : ""}`,
    )
    .join("|");
  // biome-ignore lint/correctness/useExhaustiveDependencies: `signature` stands for the paths in `items`
  const smoothed = useMemo(
    () =>
      items.map((item) => {
        if (item.kind === "place" || !item.path) return item;
        return { ...item, path: smoothPath(item.path) };
      }),
    [signature],
  );

  return useMemo(
    () =>
      smoothed.map((item, index) => {
        const road = snapped[index];
        return item.kind !== "place" && road ? { ...item, path: road } : item;
      }),
    [smoothed, snapped],
  );
}
