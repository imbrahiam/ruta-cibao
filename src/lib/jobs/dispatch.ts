/**
 * Handing work to the queue, or doing it here.
 *
 * Every caller of this is on a request path, finishing something a person is
 * waiting for. Whether a notification fan-out went to a worker or ran inline is
 * not their problem, and neither is a worker that is not running — which is the
 * ordinary state of affairs during development and on a single-container demo.
 *
 * So there are two behaviours and one signature. With a queue, the job is sent
 * and the request returns. Without one, the handler runs in-process, detached,
 * with its failure logged rather than raised: the mutation that caused it has
 * already committed, and failing the response now would tell the citizen their
 * report did not land when it did.
 */
import { getBoss } from "./boss";
import type { JobPayloads, QueueName } from "./queues";

export async function dispatch<Q extends QueueName>(
  queue: Q,
  data: JobPayloads[Q],
  options?: {
    /**
     * Collapses duplicates arriving inside this window into one job. Used where
     * the work is a sweep rather than a message — running it twice is harmless
     * but pointless.
     */
    singletonKey?: string;
    singletonSeconds?: number;
  },
): Promise<"queued" | "inline" | "failed"> {
  const boss = await getBoss("client");

  if (boss) {
    try {
      await boss.send(queue, data, {
        singletonKey: options?.singletonKey,
        singletonSeconds: options?.singletonSeconds,
      });
      return "queued";
    } catch (error) {
      console.warn(`could not queue ${queue}; running it in-process`, error);
    }
  }

  // Imported here rather than at the top of the file: the handlers import the
  // domain services, and several of those import this module to queue work of
  // their own. A static import would close that circle at load time.
  const { runJob } = await import("./handlers");

  void runJob(queue, data).catch((error: unknown) => {
    console.error(`in-process job ${queue} failed`, error);
  });

  return "inline";
}
