import { type Db, db } from "@/db";
import { type ResolvedSession, resolveSession } from "@/modules/access/session";
import { assertStaffSessionVerified } from "@/modules/access/staff-session";
import type { Viewer } from "@/modules/access/viewer";

/**
 * Per-request state every procedure can rely on.
 *
 * The session is resolved on first use, not up front: most requests that reach
 * these handlers — the OpenAPI reference, the spec, the health probe, public
 * map tiles — need no identity at all. Procedures that do need it share the
 * same promise, so asking twice in one request costs one lookup.
 */
export type AppContext = {
  db: Db;
  /** Correlates this request with its log lines and its response header. */
  requestId: string;
  headers: Headers;
  getSession: () => Promise<ResolvedSession>;
  getViewer: () => Promise<Viewer>;
  requireStaffSession: () => Promise<void>;
};

export function createContext(request: Request): AppContext {
  let pending: Promise<ResolvedSession> | undefined;
  const getSession = () => {
    pending ??= resolveSession(request.headers);
    return pending;
  };

  return {
    db,
    requestId: request.headers.get("x-request-id") ?? "unknown",
    headers: request.headers,
    getSession,
    getViewer: async () => (await getSession()).viewer,
    requireStaffSession: async () => {
      const resolved = await getSession();
      await assertStaffSessionVerified(resolved);
    },
  };
}
