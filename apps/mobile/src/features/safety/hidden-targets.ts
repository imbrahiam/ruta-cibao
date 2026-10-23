import type { ContentTarget } from "@ruta/contracts";
import { type QueryClient, useQuery } from "@tanstack/react-query";
import { useMe } from "@/features/auth/session";
import { api } from "@/lib/api";

const PAGE = 250;
const EMPTY: ReadonlySet<string> = new Set();

/** The lookup key of one piece of content in the hidden set. */
export function targetKey(kind: ContentTarget["kind"], ref: string): string {
  return `${kind}:${ref}`;
}

async function fetchAllHiddenTargets(): Promise<ReadonlySet<string>> {
  const hidden = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await api.safety.hiddenTargets({ cursor, limit: PAGE });
    for (const item of page.items) hidden.add(targetKey(item.kind, item.ref));
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return hidden;
}

/**
 * Everything the signed-in person has hidden by blocking an author, as a set
 * of `kind:ref` keys. The server omits that content from personalised reads,
 * but the place map is one shared, cached payload, so the app removes these
 * itself. Signed out, the set is empty and nothing is fetched. While a refresh
 * is in flight (or fails) the previous set stays in force.
 */
export function useHiddenTargets(): ReadonlySet<string> {
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
