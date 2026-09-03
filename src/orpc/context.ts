import { type Db, db } from "@/db";
import { getAuth, type Session } from "@/lib/auth";

/**
 * Per-request state every procedure can rely on.
 *
 * The session is resolved on first use, not up front: most requests that reach
 * these handlers — the OpenAPI reference, the spec, the health probe — need no
 * session at all, and resolving one eagerly would put a database round-trip in
 * front of every one of them. Procedures that do need it get the same promise,
 * so asking twice in one request still costs one lookup.
 */
export type AppContext = {
  db: Db;
  headers: Headers;
  getSession: () => Promise<Session>;
};

export function createContext(request: Request): AppContext {
  let pending: Promise<Session> | undefined;

  return {
    db,
    headers: request.headers,
    getSession: () => {
      pending ??= getAuth().api.getSession({ headers: request.headers });
      return pending;
    },
  };
}
