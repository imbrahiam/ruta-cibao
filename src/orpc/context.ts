import { eq } from "drizzle-orm";
import { type Db, db } from "@/db";
import { memberProfiles } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { toViewer, type Viewer } from "@/modules/access/viewer";

/**
 * Per-request state every procedure can rely on.
 *
 * The viewer is resolved on first use, not up front: most requests that reach
 * these handlers — the OpenAPI reference, the spec, the health probe, public
 * map tiles — need no identity at all, and resolving one eagerly would put two
 * database round-trips in front of every one of them. Procedures that do need
 * it share the same promise, so asking twice in one request costs one lookup.
 */
export type AppContext = {
  db: Db;
  headers: Headers;
  getViewer: () => Promise<Viewer>;
};

export function createContext(request: Request): AppContext {
  let pending: Promise<Viewer> | undefined;

  return {
    db,
    headers: request.headers,
    getViewer: () => {
      pending ??= resolveViewer(request);
      return pending;
    },
  };
}

async function resolveViewer(request: Request): Promise<Viewer> {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session?.user) return { kind: "anonymous" };

  const [profile] = await db
    .select()
    .from(memberProfiles)
    .where(eq(memberProfiles.userId, session.user.id))
    .limit(1);

  return toViewer(session.user.id, profile);
}
