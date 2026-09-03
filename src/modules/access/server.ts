import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { memberProfiles } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { toViewer, type Viewer } from "./viewer";

/**
 * The viewer for Server Components and Server Actions.
 *
 * Reads `headers()`, so anything calling it is dynamic by definition. Keep it
 * inside a Suspense boundary — or in an action, where dynamic is the point —
 * rather than at the top of a layout, which would drag the whole page out of
 * the static shell.
 */
export async function getServerViewer(): Promise<Viewer> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user) return { kind: "anonymous" };

  const [profile] = await db
    .select()
    .from(memberProfiles)
    .where(eq(memberProfiles.userId, session.user.id))
    .limit(1);

  return toViewer(session.user.id, profile);
}
