/**
 * Every background queue, and what travels on it.
 *
 * One file so the sender and the worker cannot disagree about a name or a
 * payload shape — the whole class of bug where a job is queued under
 * `traffic-expire` and consumed under `traffic.expire`, and nothing throws
 * because both are strings.
 *
 * Payloads carry ids, never rows. A job runs minutes after it was queued and
 * possibly on another machine; a copy of the data as it looked at send time
 * would already be stale by the time anybody read it.
 */
export const QUEUES = {
  /** Tell people near a fresh traffic report that it is there. */
  trafficNotifyNearby: "traffic.notify-nearby",
  /** Lapse reports nobody has vouched for. */
  trafficExpire: "traffic.expire",
  /** Build last week's figures for every municipality. */
  reportsWeekly: "reports.weekly",
  /** Render one report to PDF, once its figures exist. */
  reportsRender: "reports.render",
  /** Drop expired realtime events, idempotency keys and rate-limit buckets. */
  platformCleanup: "platform.cleanup",
  notificationDeliver: "notification.deliver",
  nativePushReceipts: "notification.native-push-receipts",
  /** Remove everything an account contributed, then the account itself. */
  accountDeletion: "account.deletion",
  /** Rebuild the versioned first-party offline snapshot artifact. */
  offlineSnapshot: "offline.snapshot",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/**
 * The payload each queue takes.
 *
 * `Record<string, never>` rather than `void` for the queues that need nothing:
 * pg-boss stores a JSON object either way, and an empty object is what comes
 * back out.
 */
export type JobPayloads = {
  [QUEUES.trafficNotifyNearby]: { reportId: string };
  [QUEUES.trafficExpire]: Record<string, never>;
  /** Omit the period to mean "the week that just ended". */
  [QUEUES.reportsWeekly]: { periodStart?: string; municipalityId?: string };
  [QUEUES.reportsRender]: { reportId: string };
  [QUEUES.platformCleanup]: Record<string, never>;
  [QUEUES.notificationDeliver]: {
    notificationId: string;
    push: boolean;
    email: boolean;
  };
  [QUEUES.nativePushReceipts]: Record<string, never>;
  [QUEUES.accountDeletion]: { deletionId: string };
  [QUEUES.offlineSnapshot]: Record<string, never>;
};

/**
 * When the unattended queues run, in `America/Santo_Domingo`.
 *
 * The province does not observe daylight saving, so a cron expression means the
 * same wall-clock time all year — which is why the weekly report can be
 * promised for Monday morning rather than "Monday morning, give or take an
 * hour, twice a year".
 */
export const SCHEDULES: ReadonlyArray<{
  queue: QueueName;
  cron: string;
  reason: string;
}> = [
  {
    queue: QUEUES.nativePushReceipts,
    cron: "*/5 * * * *",
    reason:
      "Check accepted native push tickets once their 15-minute receipt window opens.",
  },
  {
    queue: QUEUES.trafficExpire,
    cron: "*/10 * * * *",
    reason:
      "A lapsed report is a lie about a road. Ten minutes is the longest that lie is allowed to stand.",
  },
  {
    queue: QUEUES.reportsWeekly,
    cron: "0 6 * * 1",
    reason:
      "Monday at six, so the figures are waiting when the ayuntamiento opens rather than arriving mid-morning.",
  },
  {
    queue: QUEUES.platformCleanup,
    cron: "17 * * * *",
    reason:
      "Hourly, off the hour: nothing else in this system runs at :17, so the sweep never queues behind the reports.",
  },
  {
    queue: QUEUES.offlineSnapshot,
    cron: "30 4 * * *",
    reason:
      "Daily refresh of the versioned offline snapshot artifact during quiet hours.",
  },
];

export const SCHEDULE_TIMEZONE = "America/Santo_Domingo";
