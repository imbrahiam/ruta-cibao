import { type QueryClient, useQuery } from "@tanstack/react-query";
import { useMe } from "@/features/auth/session";
import { api } from "@/lib/api";

const PAGE = 250;

export type HiddenTargets = {
  places: Set<string>;
  traffic: Set<string>;
  routes: Set<string>;
  consultations: Set<string>;
};

const EMPTY: HiddenTargets = {
  places: new Set(),
  traffic: new Set(),
  routes: new Set(),
  consultations: new Set(),
};

async function fetchAllHiddenTargets(): Promise<HiddenTargets> {
  const hidden: HiddenTargets = {
    places: new Set(),
    traffic: new Set(),
    routes: new Set(),
    consultations: new Set(),
  };
  let cursor: string | undefined;
  do {
    const page = await api.safety.hiddenTargets({ cursor, limit: PAGE });
    for (const item of page.items) {
      if (item.kind === "place") hidden.places.add(item.ref);
      else if (item.kind === "traffic") hidden.traffic.add(item.ref);
      else if (item.kind === "route") hidden.routes.add(item.ref);
      else if (item.kind === "consultation") hidden.consultations.add(item.ref);
    }
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return hidden;
}

/**
 * Everything the signed-in person has hidden by blocking an author, grouped by
 * content kind (slugs for places/consultations, ids for traffic/routes).
 */
export function useHiddenTargets(): HiddenTargets {
  const { me, signedIn } = useMe();
  const userId = me?.kind === "member" ? me.userId : null;
  const query = useQuery({
    queryKey: ["safety", "hidden-targets", userId],
    queryFn: fetchAllHiddenTargets,
    enabled: signedIn && Boolean(userId),
    staleTime: 5 * 60_000,
  });
  return signedIn && query.data ? query.data : EMPTY;
}

/** Refetches the hidden set now, for after a block or an unblock. */
export function refreshHiddenTargets(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: ["safety", "hidden-targets"],
  });
}
