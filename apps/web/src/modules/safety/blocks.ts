import { type AnyColumn, type SQL, sql } from "drizzle-orm";
import { userBlocks } from "@/db/schema";
import type { Viewer } from "@/modules/access/viewer";

/**
 * Leaves out raw contributions by authors the viewer has blocked.
 *
 * Applied to every personalised read of other people's content. A row with no
 * author (a seeded or institutional record) always passes: nobody can block
 * the institution, and an official response is never hidden as if the person
 * who opened the case owned it. Anonymous readers block nobody.
 */
export function notBlockedAuthor(
  author: AnyColumn,
  viewer: Viewer,
): SQL | undefined {
  if (viewer.kind === "anonymous") return undefined;
  return sql`(${author} is null or ${author} not in (select ${userBlocks.blockedUserId} from ${userBlocks} where ${userBlocks.blockingUserId} = ${viewer.userId}))`;
}
