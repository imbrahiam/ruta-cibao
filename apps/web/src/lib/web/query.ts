import { QueryClient } from "@tanstack/react-query";

/**
 * Staff screens act on shared queues: a stale list is how two moderators
 * decide the same submission, so data is refetched when the window regains
 * focus, and a failed decision is never retried automatically.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 15_000, refetchOnWindowFocus: true, retry: 1 },
      mutations: { retry: false },
    },
  });
}
