/**
 * A ceiling on long-lived connections.
 *
 * Every open event stream holds a timer, a query every heartbeat and a slice of
 * the process's memory until the client goes away. Unlike a request, it can
 * stay away for hours, so the ordinary per-request rate limit is not enough:
 * one client opening streams in a loop would exhaust the process while staying
 * under a request budget.
 *
 * The limit is per process. Two app instances double the total, which is
 * acceptable for a province-sized service; the point is that no single client
 * and no single process can be driven without bound.
 */
export type ConnectionLimiter = {
  acquire(client: string): boolean;
  release(client: string): void;
  readonly active: number;
};

export function createConnectionLimiter(options: {
  perClient: number;
  total: number;
}): ConnectionLimiter {
  const byClient = new Map<string, number>();
  let active = 0;

  return {
    acquire(client) {
      if (active >= options.total) return false;
      const open = byClient.get(client) ?? 0;
      if (open >= options.perClient) return false;
      byClient.set(client, open + 1);
      active++;
      return true;
    },
    release(client) {
      const open = byClient.get(client);
      if (!open) return;
      active--;
      if (open === 1) byClient.delete(client);
      else byClient.set(client, open - 1);
    },
    get active() {
      return active;
    },
  };
}
