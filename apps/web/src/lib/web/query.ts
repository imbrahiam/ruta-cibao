import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { orpc } from "./api";
import { failureKind } from "./errors";

/**
 * Staff screens act on shared queues: a stale list is how two moderators
 * decide the same submission, so data is refetched when the window regains
 * focus, and a failed decision is never retried automatically.
 *
 * Offline is a result, not a wait: with `networkMode: "always"` a request made
 * without a connection fails at once (so an optimistic change is rolled back
 * and says why) instead of hanging until the line returns, and data already on
 * screen stays on screen when its refetch fails.
 *
 * A session that ended is noticed wherever it is first met: the next call to
 * answer "unauthorized" makes the shell re-read who is signed in.
 */
export function makeQueryClient() {
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => endSession(client, error),
    }),
    mutationCache: new MutationCache({
      onError: (error) => endSession(client, error),
    }),
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: true,
        retry: 1,
        networkMode: "always",
      },
      mutations: { retry: false, networkMode: "always" },
    },
  });
  return client;
}

function endSession(client: QueryClient, error: unknown) {
  if (failureKind(error) !== "unauthorized") return;
  void client.invalidateQueries({ queryKey: orpc.me.get.key() });
}
