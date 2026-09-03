import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";

/**
 * A query client configured for how this app actually gets its data.
 *
 * `staleTime` is deliberately generous: the live stream pushes changes as they
 * happen, so refetching on a timer would spend a rural phone's data plan to
 * learn what a Server-Sent Event already said. Time-based refetching is the
 * fallback for when the stream is down, not the primary path.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        // The stream is the signal. Re-fetching every time a phone unlocks
        // would be noise on a metered connection.
        refetchOnWindowFocus: false,
        retry: 2,
      },
      dehydrate: {
        // Lets a server-prefetched query stream to the client while still
        // pending, instead of the client starting it over.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
    },
  });
}
