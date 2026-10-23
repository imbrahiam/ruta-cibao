/**
 * What each queue actually does.
 *
 * One table, used by two callers: the worker binds every entry to pg-boss, and
 * `dispatch` runs one directly when there is no worker. That is the point of
 * keeping them here rather than inside the worker script — "the queue is off"
 * has to mean "this happens on the request instead", not "this never happens",
 * and two copies of the same logic would drift the first time one was edited.
 *
 * Handlers take ids and return a summary. Nothing here reads a request, a
 * session or a viewer: a job runs minutes later, on another machine, with no
 * one waiting, and anything that needs to know who asked has already been
 * decided by the service that queued it.
 */

import { db } from "@/db";
import { clearExpiredIdempotencyKeys } from "@/lib/idempotency";
import { clearExpiredRateLimits } from "@/lib/rate-limit";
import { clearExpiredRealtimeEvents } from "@/lib/realtime";
import { deliverNotification } from "@/modules/notifications/notify";
import { cleanupPhotoUploads } from "@/modules/places/photos";
import { renderWeeklyReportPdf } from "@/modules/reports/render-pdf";
import { buildWeeklyReports } from "@/modules/reports/weekly";
import { expireTrafficReports } from "@/modules/traffic/expire";
import { notifyNearbyOfTraffic } from "@/modules/traffic/notify-nearby";
import { type JobPayloads, QUEUES, type QueueName } from "./queues";

type Handlers = {
  [Q in QueueName]: (data: JobPayloads[Q]) => Promise<unknown>;
};

const handlers: Handlers = {
  [QUEUES.trafficNotifyNearby]: ({ reportId }) =>
    notifyNearbyOfTraffic(reportId),

  [QUEUES.trafficExpire]: () => expireTrafficReports(),

  [QUEUES.reportsWeekly]: ({ periodStart }) =>
    buildWeeklyReports(
      undefined,
      periodStart ? new Date(periodStart) : undefined,
    ),

  [QUEUES.reportsRender]: ({ reportId }) => renderWeeklyReportPdf(reportId),

  /**
   * Three sweeps, one job. They are all "drop rows past their expiry", they
   * all run on the same cadence, and separating them would mean three
   * schedules to explain in the runbook for no operational difference.
   */
  [QUEUES.platformCleanup]: async () => {
    const [realtime, idempotency, rateLimits, photoUploads] = await Promise.all(
      [
        clearExpiredRealtimeEvents(),
        clearExpiredIdempotencyKeys(),
        clearExpiredRateLimits(),
        cleanupPhotoUploads(db),
      ],
    );
    return { realtime, idempotency, rateLimits, photoUploads };
  },

  [QUEUES.notificationDeliver]: (input) => deliverNotification(input),
};

export function runJob<Q extends QueueName>(
  queue: Q,
  data: JobPayloads[Q],
): Promise<unknown> {
  return handlers[queue](data);
}

export { handlers };
