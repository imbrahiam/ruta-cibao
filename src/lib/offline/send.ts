import { ORPCError } from "@orpc/client";
import type { RouterClient } from "@orpc/server";
import { reportPlaceInput, submitPlaceInput } from "@/modules/places/contracts";
import { reportTrafficInput } from "@/modules/traffic/contracts";
import type { AppRouter } from "@/orpc/router";
import type { QueueProcedure } from "./procedures";
import type { QueuedMutation } from "./queue";

/**
 * Any typed client able to replay the queue.
 *
 * The page uses the shared one from `@/lib/orpc`; the service worker builds a
 * bare one, because the shared client drags TanStack Query along and a worker
 * has no use for a cache of anything.
 */
export type QueueClient = RouterClient<AppRouter, { expectedUserId?: string }>;

/**
 * Replays one queued mutation.
 *
 * The switch is the whole allow-list: a procedure not named here cannot be
 * sent from the queue, which is what stops a tampered IndexedDB row from
 * calling something it should not. `expectedUserId` rides along so the server
 * refuses to file a draft under whoever happens to be signed in now.
 */
export async function sendQueuedMutation(
  client: QueueClient,
  item: QueuedMutation,
  userId: string,
): Promise<void> {
  const options = { context: { expectedUserId: userId } };
  switch (item.procedure as QueueProcedure) {
    case "places.submit":
      await client.places.submit(submitPlaceInput.parse(item.input), options);
      return;
    case "places.report":
      await client.places.report(reportPlaceInput.parse(item.input), options);
      return;
    // The one queued mutation that is time-sensitive. It is sent anyway: the
    // server decides whether a six-hour-old report is still worth showing, and
    // the duplicate check catches the case where somebody else got there first.
    case "traffic.report":
      await client.traffic.report(
        reportTrafficInput.parse(item.input),
        options,
      );
      return;
    default:
      throw new ORPCError("BAD_REQUEST");
  }
}
